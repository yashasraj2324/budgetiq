// BudgetIQ API gateway — one backend function routing the REST contract the
// frontend already uses (${API}/dashboard, /budget-lines, /recommendations, ...).
// Auth: JWT or API key (X-API-Key). Uses the service-role client, so RLS stays
// enabled and authorization lives server-side. Helpers are modularized under ./_lib.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

import { corsHeaders, PREFIX, ADMIN_ROLES, SUPPORTED_ROLES } from "./_lib/constants.ts";
import { json, csvResponse, HttpError, num, money, pageItems } from "./_lib/helpers.ts";
import { generateToken, generateKey, hashKey } from "./_lib/tokens.ts";
import { parseCsv } from "./_lib/csv.ts";
import {
  detectVelocityAnomaly, median, structuralAnomalies, calculateTransfer,
  validateCustomAmount, forecastSpend, backtestForecast,
} from "./_lib/engine.ts";
import { recOut, apiKeyOut, scenarioOut, sourceRemainingSafetyCheck } from "./_lib/serializers.ts";
import { loadMetrics, liveRemaining, usersByEmail, logAudit } from "./_lib/metrics.ts";
import { loadApprovalPolicy, actorEligible, acceptInvitation } from "./_lib/approvals.ts";
import { resolveAuth, requiredScope } from "./_lib/auth.ts";
import { groqReasoning } from "./_lib/reasoning.ts";
import type { Ctx, Supabase } from "./_lib/types.ts";

// ---------------------------------------------------------------------------
// Request handlers
// ---------------------------------------------------------------------------
async function handleRequest(req: Request, supabase: Supabase, ctx: Ctx, path: string, method: string) {
  const url = new URL(req.url);
  const query = url.searchParams;
  const { org_id, role, user_id, display_name } = ctx;
  const isAdmin = ADMIN_ROLES.has(role);

  const seg = path.split("/").filter(Boolean);
  const first = seg[0] ?? "";

  // API keys: enforce the scopes granted at creation time (server-side only).
  if (ctx.auth_mode === "key") {
    const scope = requiredScope(seg, method);
    if (!scope) throw new HttpError(404, "Not found");
    const granted = ctx.scopes ?? [];
    if (!granted.includes("*") && !granted.includes(scope)) {
      throw new HttpError(403, `API key does not grant scope '${scope}' for this operation`);
    }
  }

  // ---- Dashboard ---------------------------------------------------------
  if (first === "dashboard" && seg.length === 1 && method === "GET") {
    const { data: depts } = await supabase.from("departments").select("*").eq("organization_id", org_id).order("id", { ascending: true });
    const { data: allLines } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).order("id", { ascending: true });
    const { data: recs } = await supabase.from("recommendations").select("id, status").eq("organization_id", org_id).eq("status", "pending");
    const metrics = await loadMetrics(supabase, org_id);

    const departmentId = query.get("department_id") ? Number(query.get("department_id")) : null;
    const category = query.get("category");
    const search = query.get("search");
    const scenario = query.get("scenario");
    const page = query.get("page") ? Number(query.get("page")) : null;
    const pageSize = query.get("page_size") ? Number(query.get("page_size")) : null;

    let lines = allLines ?? [];
    if (departmentId) lines = lines.filter((l) => Number(l.department_id) === departmentId);
    if (category && !["over-allocated", "variance", "scenario"].includes(category)) lines = lines.filter((l) => l.category === category);
    if (search) lines = lines.filter((l) => String(l.name).toLowerCase().includes(search.toLowerCase()));

    const decorated = lines.map((l) => ({ ...l, remaining_budget: liveRemaining(l, metrics) }));
    const activeScenario = scenario || (category && ["over-allocated", "variance"].includes(category) ? category : null);
    let visible = decorated;
    if (activeScenario === "over-allocated") visible = decorated.filter((l) => l.remaining_budget < 0);
    else if (activeScenario === "variance") {
      visible = decorated.filter((l) => {
        const alloc = num(l.allocated_amount);
        return alloc > 0 && Math.abs((alloc - l.remaining_budget) / alloc - 1) > 0.05;
      });
    }

    const totalBudget = visible.reduce((a, l) => a + num(l.allocated_amount), 0);
    const totalRemaining = visible.reduce((a, l) => a + l.remaining_budget, 0);
    const reallocatable = visible.reduce((a, l) => a + Math.max(0, l.remaining_budget - num(l.necessary_future_spend) - num(l.safety_reserve)), 0);

    const medianAllocation = median((allLines ?? []).map((l) => num(l.allocated_amount)));
    // Single-pass anomaly scan: fetch all spend once, group by line, then run
    // the detectors in memory instead of one query per line (N+1).
    const { data: spendRows } = await supabase
      .from("spend_entries")
      .select("budget_line_id, amount_spent")
      .eq("organization_id", org_id)
      .order("period", { ascending: true });
    const spendByLine = new Map<number, number[]>();
    for (const s of spendRows ?? []) {
      const lineId = Number(s.budget_line_id);
      if (!spendByLine.has(lineId)) spendByLine.set(lineId, []);
      spendByLine.get(lineId)!.push(num(s.amount_spent));
    }
    let anomalyCount = 0;
    for (const l of visible) {
      const velocity = detectVelocityAnomaly(spendByLine.get(Number(l.id)) ?? []);
      const structural = structuralAnomalies(l, l.remaining_budget, medianAllocation);
      if (velocity.detected || structural.length) anomalyCount += 1;
    }

    const paged = pageItems(visible, page, pageSize);
    const visibleLines = Array.isArray(paged) ? paged : paged.items;
    const deptOuts = (depts ?? []).map((d) => ({
      id: Number(d.id),
      name: d.name,
      priority_weight: Number(d.priority_weight),
      budget_lines: visibleLines.filter((l) => Number(l.department_id) === Number(d.id)),
    }));

    return json({
      total_budget: money(totalBudget),
      total_remaining: money(totalRemaining),
      reallocatable: money(reallocatable),
      pending_recommendations: recs?.length ?? 0,
      anomaly_count: anomalyCount,
      departments: deptOuts,
      budget_lines: visibleLines,
      pagination: Array.isArray(paged) ? null : paged,
      scenario: activeScenario,
    });
  }

  // ---- Dashboard / budget-lines CSV export --------------------------------
  if ((seg.join("/") === "dashboard/export.csv" || seg.join("/") === "budget-lines/export.csv" || seg.join("/") === "export/budget-lines.csv" || seg.join("/") === "reports/budget-lines.csv") && method === "GET") {
    const { data: allLines } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).order("id", { ascending: true });
    const { data: depts } = await supabase.from("departments").select("id, name").eq("organization_id", org_id);
    const metrics = await loadMetrics(supabase, org_id);
    const deptName = new Map((depts ?? []).map((d) => [Number(d.id), d.name as string]));
    const rows = (allLines ?? []).map((l) => {
      const remaining = liveRemaining(l, metrics);
      return {
        id: Number(l.id),
        department_id: Number(l.department_id),
        department_name: deptName.get(Number(l.department_id)) ?? "",
        name: l.name,
        category: l.category,
        allocated_amount: num(l.allocated_amount),
        remaining_budget: remaining,
        priority_weight: Number(l.priority_weight),
        necessary_future_spend: num(l.necessary_future_spend),
        safety_reserve: num(l.safety_reserve),
        policy_maximum_transfer: num(l.policy_maximum_transfer),
      };
    });
    return csvResponse(rows, "budgetiq_budget_lines.csv");
  }

  // ---- Anomalies ----------------------------------------------------------
  if (first === "anomalies" && method === "GET") {
    const { data: lines } = await supabase.from("budget_lines").select("id, name, department_id, allocated_amount, priority_weight, necessary_future_spend, safety_reserve").eq("organization_id", org_id);
    const { data: depts } = await supabase.from("departments").select("id, name").eq("organization_id", org_id);
    const deptName = new Map((depts ?? []).map((d) => [Number(d.id), d.name as string]));
    const metrics = await loadMetrics(supabase, org_id);
    const medianAllocation = median((lines ?? []).map((l) => num(l.allocated_amount)));
    const out = [];
    for (const line of lines ?? []) {
      const lineId = Number(line.id);
      const { data: entries } = await supabase.from("spend_entries").select("amount_spent").eq("organization_id", org_id).eq("budget_line_id", lineId).order("period", { ascending: true });
      const velocity = detectVelocityAnomaly((entries ?? []).map((e) => num(e.amount_spent)));
      const remaining = liveRemaining(line, metrics);
      const structural = structuralAnomalies(line, remaining, medianAllocation);
      const base = {
        budget_line_id: lineId,
        budget_line_name: line.name,
        department_name: deptName.get(Number(line.department_id)) ?? "",
      };
      if (velocity.detected) {
        out.push({
          ...base,
          anomaly_type: "velocity",
          anomaly_types: ["velocity"],
          velocity_multiplier: velocity.velocity_multiplier,
          recent_rate: money(velocity.recent_rate),
          baseline_rate: money(velocity.baseline_rate),
          period_remaining: velocity.period_remaining,
        });
      } else if (structural.length) {
        out.push({
          ...base,
          anomaly_type: structural[0].type,
          anomaly_types: structural.map((s) => s.type),
          deficit: structural[0].deficit,
          remaining_budget: money(remaining),
          velocity_multiplier: velocity.velocity_multiplier,
        });
      }
    }
    return json(out);
  }

  // ---- Budget lines -------------------------------------------------------
  if (first === "budget-lines" && method === "GET" && seg.length === 1) {
    const { data: lines } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).order("id", { ascending: true });
    const metrics = await loadMetrics(supabase, org_id);
    const out = (lines ?? []).map((l) => ({
      id: Number(l.id),
      name: l.name,
      department_id: Number(l.department_id),
      allocated_amount: num(l.allocated_amount),
      remaining_budget: liveRemaining(l, metrics),
      priority_weight: Number(l.priority_weight),
      category: l.category,
      necessary_future_spend: num(l.necessary_future_spend),
      safety_reserve: num(l.safety_reserve),
      policy_maximum_transfer: num(l.policy_maximum_transfer),
    }));
    return json(pageItems(out, query.get("page") ? Number(query.get("page")) : null, query.get("page_size") ? Number(query.get("page_size")) : null));
  }

  if (first === "budget-lines" && seg.length === 2 && method === "GET") {
    const { data: line } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const metrics = await loadMetrics(supabase, org_id);
    const { data: dept } = await supabase.from("departments").select("name").eq("organization_id", org_id).eq("id", Number(line.department_id)).maybeSingle();
    const { data: entries } = await supabase.from("spend_entries").select("period, amount_spent").eq("organization_id", org_id).eq("budget_line_id", Number(line.id)).order("period", { ascending: true });
    const remaining = liveRemaining(line, metrics);
    const velocity = detectVelocityAnomaly((entries ?? []).map((e) => num(e.amount_spent)));
    const { data: allLines } = await supabase.from("budget_lines").select("allocated_amount").eq("organization_id", org_id);
    const structural = structuralAnomalies(line, remaining, median((allLines ?? []).map((l) => num(l.allocated_amount))));
    return json({
      id: Number(line.id),
      name: line.name,
      department_id: Number(line.department_id),
      department_name: dept?.name ?? "",
      allocated_amount: num(line.allocated_amount),
      remaining_budget: remaining,
      priority_weight: Number(line.priority_weight),
      category: line.category,
      spend_entries: (entries ?? []).map((e) => ({ period: e.period, amount_spent: num(e.amount_spent) })),
      anomaly: velocity.detected
        ? { type: "velocity", velocity_multiplier: velocity.velocity_multiplier, recent_rate: money(velocity.recent_rate), baseline_rate: money(velocity.baseline_rate) }
        : structural.length
          ? { type: structural[0].type, deficit: structural[0].deficit }
          : null,
    });
  }

  // ---- CSV import template -------------------------------------------------
  if (first === "budget-lines" && seg.join("/") === "budget-lines/import/template" && method === "GET") {
    // The template uses department_name: fresh workspaces have no departments
    // yet, and the importer auto-creates departments named in the CSV.
    const template = [
      "department_name,name,allocated_amount,priority_weight,category,necessary_future_spend,safety_reserve,policy_maximum_transfer",
      "Marketing,Regional Events,5000000,35,Events,800000,100000,1000000",
      "Product,Customer Onboarding,1200000,92,Automation,300000,50000,400000",
    ].join("\n");
    return new Response(template, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="budgetiq_budget_lines_template.csv"',
      },
    });
  }

  if (first === "budget-lines" && seg.length === 2 && method === "POST" && seg[1] === "import") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "CSV file required");
    const raw = await file.text();
    const rows = parseCsv(raw);
    if (!rows.length) throw new HttpError(422, "CSV file is empty");
    // department_id (must exist) OR department_name (auto-created) is accepted.
    const required = ["name", "allocated_amount", "priority_weight", "category"];
    for (const col of required) if (!(col in rows[0])) throw new HttpError(422, `CSV must include columns: ${[...required].sort().join(", ")}`);
    if (!("department_id" in rows[0]) && !("department_name" in rows[0])) {
      throw new HttpError(422, "CSV must include a department_id or department_name column");
    }
    const { data: depts } = await supabase.from("departments").select("id, name").eq("organization_id", org_id);
    const deptIds = new Set((depts ?? []).map((d) => Number(d.id)));
    const deptByName = new Map<string, number>((depts ?? []).map((d) => [String(d.name).trim().toLowerCase(), Number(d.id)]));
    const { data: existing } = await supabase.from("budget_lines").select("department_id, name").eq("organization_id", org_id);
    const seen = new Set((existing ?? []).map((l) => `${Number(l.department_id)}|${l.name}`));
    const errors: { row: number; error: string }[] = [];
    const pending: Record<string, unknown>[] = [];
    // Pass 1 — validate every row with no side effects. Collect department
    // names that would need to be auto-created.
    const newDeptNames: string[] = [];
    for (const [idx, row] of rows.entries()) {
      const rowNumber = idx + 2;
      try {
        const byName = String(row.department_name ?? "").trim();
        const byId = Number(row.department_id);
        let departmentId: number | null = null;
        if (byName) {
          const existingId = deptByName.get(byName.toLowerCase());
          if (existingId) {
            departmentId = existingId;
          } else {
            if (!newDeptNames.some((n) => n.toLowerCase() === byName.toLowerCase())) newDeptNames.push(byName);
          }
        } else if (Number.isInteger(byId) && deptIds.has(byId)) {
          departmentId = byId;
        }
        if (departmentId === null && !byName) {
          throw new Error(`department ${row.department_id || "(empty)"} not found — use a department_name column to auto-create departments`);
        }
        const name = String(row.name ?? "").trim();
        if (!name) throw new Error("name is required");
        const allocated = Number(row.allocated_amount);
        if (!Number.isFinite(allocated) || allocated < 0) throw new Error("allocated_amount must be a non-negative number");
        const priority = Number(row.priority_weight);
        if (!Number.isInteger(priority) || priority < 0 || priority > 100) throw new Error("priority_weight must be between 0 and 100");
        const category = String(row.category ?? "").trim();
        if (!category) throw new Error("category is required");
        const key = `${byName.toLowerCase() || byId}|${name}`;
        if (seen.has(key)) throw new Error("duplicate budget line");
        seen.add(key);
        pending.push({ rowNumber, byName, byId, departmentId, name, allocated, priority, category, row });
      } catch (e) {
        errors.push({ row: rowNumber, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (errors.length) throw new HttpError(422, JSON.stringify({ errors }));
    // Create any new departments now that validation passed.
    const createdDepts: string[] = [];
    for (const name of newDeptNames) {
      const { data: created, error } = await supabase.from("departments").insert({
        organization_id: org_id,
        name,
        priority_weight: 50,
      }).select("id").single();
      if (error) throw new HttpError(500, `Unable to create department ${name}: ${error.message}`);
      deptByName.set(name.toLowerCase(), Number(created.id));
      createdDepts.push(name);
    }
    // Pass 2 — resolve department ids and build the insert rows.
    const linesToInsert = pending.map((item) => {
      const row = item.row as Record<string, string>;
      const departmentId = (item.departmentId as number | null) ?? deptByName.get(String(item.byName).toLowerCase())!;
      return {
        organization_id: org_id,
        department_id: departmentId,
        name: String(item.name),
        allocated_amount: money(item.allocated as number),
        priority_weight: Number(item.priority),
        category: String(item.category),
        necessary_future_spend: money(Number(row.necessary_future_spend) || 0),
        safety_reserve: money(Number(row.safety_reserve) || 0),
        policy_maximum_transfer: money(Number(row.policy_maximum_transfer) || 0),
      };
    });
    const { error } = await supabase.from("budget_lines").insert(linesToInsert);
    if (error) throw new HttpError(500, `Import failed: ${error.message}`);
    await logAudit(supabase, ctx, "budget_line_import", { created: linesToInsert.length, departments_created: createdDepts, errors: 0 });
    return json({ ok: true, created: linesToInsert.length, departments_created: createdDepts, errors: [] });
  }

  if (first === "budget-lines" && seg.length === 2 && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const departmentId = Number(body.department_id);
    const { data: dept } = await supabase.from("departments").select("id").eq("organization_id", org_id).eq("id", departmentId).maybeSingle();
    if (!dept) throw new HttpError(404, `Department ${departmentId} not found`);
    const { data: dup } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("department_id", departmentId).eq("name", String(body.name).trim()).maybeSingle();
    if (dup) throw new HttpError(409, "Budget line already exists in this department");
    const allocated = money(body.allocated_amount);
    const { data: created, error } = await supabase.from("budget_lines").insert({
      organization_id: org_id,
      department_id: departmentId,
      name: String(body.name).trim(),
      allocated_amount: allocated,
      priority_weight: Number(body.priority_weight) || 50,
      category: String(body.category ?? ""),
      necessary_future_spend: money(body.necessary_future_spend) || 0,
      safety_reserve: money(body.safety_reserve) || 0,
      policy_maximum_transfer: money(body.policy_maximum_transfer) || 0,
    }).select().single();
    if (error) throw new HttpError(409, error.message.includes("duplicate") ? "Budget line already exists" : `Create failed: ${error.message}`);
    await logAudit(supabase, ctx, "budget_line_create", { budget_line_id: Number(created.id), department_id: departmentId });
    return json({ id: Number(created.id), name: created.name, department_id: Number(created.department_id), allocated_amount: num(created.allocated_amount), remaining_budget: allocated, priority_weight: Number(created.priority_weight), category: created.category, necessary_future_spend: num(created.necessary_future_spend), safety_reserve: num(created.safety_reserve), policy_maximum_transfer: num(created.policy_maximum_transfer) }, 201);
  }

  if (first === "budget-lines" && seg.length === 3 && method === "PATCH" && seg[2] === "policy") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: line } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const body = await req.json();
    const updates: Record<string, number> = {};
    if (body.policy_maximum_transfer !== undefined) {
      if (Number(body.policy_maximum_transfer) < 0) throw new HttpError(422, "policy_maximum_transfer cannot be negative");
      updates.policy_maximum_transfer = money(body.policy_maximum_transfer);
    }
    if (body.safety_reserve !== undefined) {
      if (Number(body.safety_reserve) < 0) throw new HttpError(422, "safety_reserve cannot be negative");
      updates.safety_reserve = money(body.safety_reserve);
    }
    if (body.necessary_future_spend !== undefined) {
      if (Number(body.necessary_future_spend) < 0) throw new HttpError(422, "necessary_future_spend cannot be negative");
      updates.necessary_future_spend = money(body.necessary_future_spend);
    }
    if (Object.keys(updates).length) await supabase.from("budget_lines").update(updates).eq("organization_id", org_id).eq("id", Number(seg[1]));
    await logAudit(supabase, ctx, "policy_update", { budget_line_id: Number(seg[1]), fields: Object.keys(updates) });
    const { data: updated } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).single();
    const metrics = await loadMetrics(supabase, org_id);
    return json({ id: Number(updated.id), name: updated.name, department_id: Number(updated.department_id), allocated_amount: num(updated.allocated_amount), remaining_budget: liveRemaining(updated, metrics), priority_weight: Number(updated.priority_weight), category: updated.category, necessary_future_spend: num(updated.necessary_future_spend), safety_reserve: num(updated.safety_reserve), policy_maximum_transfer: num(updated.policy_maximum_transfer) });
  }

  if (first === "budget-lines" && seg.length === 2 && method === "PATCH") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: line } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const body = await req.json();
    const metrics = await loadMetrics(supabase, org_id);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.category !== undefined) updates.category = String(body.category).trim();
    if (body.priority_weight !== undefined) updates.priority_weight = Number(body.priority_weight);
    if (body.allocated_amount !== undefined) {
      const amount = money(body.allocated_amount);
      const committed = num(line.allocated_amount) - liveRemaining(line, metrics);
      if (amount < committed) throw new HttpError(422, "allocated_amount cannot be below committed spend");
      updates.allocated_amount = amount;
    }
    for (const field of ["necessary_future_spend", "safety_reserve", "policy_maximum_transfer"]) {
      if (body[field] !== undefined) updates[field] = money(body[field]);
    }
    if (Object.keys(updates).length) await supabase.from("budget_lines").update(updates).eq("organization_id", org_id).eq("id", Number(seg[1]));
    await logAudit(supabase, ctx, "budget_line_update", { budget_line_id: Number(seg[1]), fields: Object.keys(updates) });
    const { data: updated } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).single();
    const metrics2 = await loadMetrics(supabase, org_id);
    return json({ id: Number(updated.id), name: updated.name, department_id: Number(updated.department_id), allocated_amount: num(updated.allocated_amount), remaining_budget: liveRemaining(updated, metrics2), priority_weight: Number(updated.priority_weight), category: updated.category, necessary_future_spend: num(updated.necessary_future_spend), safety_reserve: num(updated.safety_reserve), policy_maximum_transfer: num(updated.policy_maximum_transfer) });
  }

  if (first === "budget-lines" && seg.length === 2 && method === "DELETE") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: line } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const { count: spendCount } = await supabase.from("spend_entries").select("id", { count: "exact", head: true }).eq("organization_id", org_id).eq("budget_line_id", Number(seg[1]));
    const { count: recCount } = await supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("organization_id", org_id).or(`source_line_id.eq.${Number(seg[1])},target_line_id.eq.${Number(seg[1])}`);
    if (spendCount || recCount) throw new HttpError(409, "Budget line has spend or recommendations and cannot be deleted");
    await supabase.from("budget_lines").delete().eq("organization_id", org_id).eq("id", Number(seg[1]));
    await logAudit(supabase, ctx, "budget_line_delete", { budget_line_id: Number(seg[1]) });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---- Spend + forecast ---------------------------------------------------
  if (first === "budget-lines" && seg.length === 3 && seg[2] === "spend" && method === "GET") {
    const { data: line } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const { data: entries } = await supabase.from("spend_entries").select("period, amount_spent").eq("organization_id", org_id).eq("budget_line_id", Number(seg[1])).order("period", { ascending: true });
    // Use the real velocity detector, never a hardcoded amount threshold.
    const values = (entries ?? []).map((e) => num(e.amount_spent));
    const anomaly = detectVelocityAnomaly(values);
    const anomalyWindowStart = anomaly.detected ? Math.max(0, values.length - 2) : values.length;
    return json((entries ?? []).map((e, idx) => {
      const parts = String(e.period).split("-");
      return { name: parts.length > 1 ? parts[1] : e.period, spend: num(e.amount_spent), anomaly: idx >= anomalyWindowStart, projected: false };
    }));
  }

  if (first === "budget-lines" && seg.length === 3 && seg[2] === "spend" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const lineId = Number(seg[1]);
    const { data: line } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("id", lineId).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const body = await req.json();
    const period = String(body.period ?? "").trim();
    const amountSpent = money(body.amount_spent);
    if (!period) throw new HttpError(422, "period is required (e.g. FY25-Q2 or FY25-W09)");
    if (amountSpent < 0) throw new HttpError(422, "amount_spent must be non-negative");
    const { data: existing } = await supabase.from("spend_entries").select("id").eq("organization_id", org_id).eq("budget_line_id", lineId).eq("period", period).maybeSingle();
    if (existing) {
      await supabase.from("spend_entries").update({ amount_spent: amountSpent }).eq("id", existing.id);
    } else {
      const { error } = await supabase.from("spend_entries").insert({ organization_id: org_id, budget_line_id: lineId, period, amount_spent: amountSpent });
      if (error) throw new HttpError(422, `Unable to record spend: ${error.message}`);
    }
    await logAudit(supabase, ctx, "spend_entry_added", { budget_line_id: lineId, period, amount_spent: amountSpent });
    return json({ ok: true, budget_line_id: lineId, period, amount_spent: amountSpent }, 201);
  }

  // Bulk spend import — the monthly budget-refresh surface. Upserts on
  // (budget_line_id, period) so re-importing a period replaces its value.
  // Accepts budget_line_id OR budget_line_name (optionally with department_name
  // to disambiguate), so a fresh workspace can map spend straight from names.
  if (first === "spend" && seg[1] === "import" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "CSV file required");
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new HttpError(422, "CSV file is empty");
    for (const col of ["period", "amount_spent"]) if (!(col in rows[0])) throw new HttpError(422, `CSV must include columns: ${["period", "amount_spent"].join(", ")}`);
    if (!("budget_line_id" in rows[0]) && !("budget_line_name" in rows[0])) {
      throw new HttpError(422, "CSV must include a budget_line_id or budget_line_name column");
    }
    const { data: lines } = await supabase.from("budget_lines").select("id, name, department_id").eq("organization_id", org_id);
    const lineIds = new Set((lines ?? []).map((l) => Number(l.id)));
    const byName = new Map<string, number[]>();
    for (const l of lines ?? []) {
      const key = String(l.name).trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), Number(l.id)]);
    }
    const { data: depts } = await supabase.from("departments").select("id, name").eq("organization_id", org_id);
    const deptLineIds = new Map<string, number>();
    for (const l of lines ?? []) {
      const deptName = (depts ?? []).find((d) => Number(d.id) === Number(l.department_id))?.name;
      if (!deptName) continue;
      deptLineIds.set(`${deptName.trim().toLowerCase()}|${String(l.name).trim().toLowerCase()}`, Number(l.id));
    }
    const errors: { row: number; error: string }[] = [];
    const upserts: { id: number | null; insert: { organization_id: string; budget_line_id: number; period: string; amount_spent: number } }[] = [];
    const seen = new Set<string>();
    for (const [idx, row] of rows.entries()) {
      const rowNumber = idx + 2;
      try {
        let lineId: number | null = null;
        if (row.budget_line_id !== undefined && String(row.budget_line_id).trim() !== "") {
          const id = Number(row.budget_line_id);
          if (!Number.isInteger(id) || !lineIds.has(id)) throw new Error(`budget_line ${row.budget_line_id} not found`);
          lineId = id;
        } else {
          const name = String(row.budget_line_name ?? "").trim();
          if (!name) throw new Error("budget_line_id or budget_line_name is required");
          const deptName = String(row.department_name ?? "").trim();
          if (deptName) {
            const resolved = deptLineIds.get(`${deptName.toLowerCase()}|${name.toLowerCase()}`);
            if (!resolved) throw new Error(`budget line "${name}" not found in department "${deptName}"`);
            lineId = resolved;
          } else {
            const candidates = byName.get(name.toLowerCase()) ?? [];
            if (candidates.length === 0) throw new Error(`budget line "${name}" not found`);
            if (candidates.length > 1) throw new Error(`budget line "${name}" is ambiguous — include a department_name column`);
            lineId = candidates[0];
          }
        }
        const period = String(row.period ?? "").trim();
        if (!period) throw new Error("period is required");
        const amount = Number(row.amount_spent);
        if (!Number.isFinite(amount) || amount < 0) throw new Error("amount_spent must be a non-negative number");
        const key = `${lineId}|${period}`;
        if (seen.has(key)) throw new Error("duplicate row for the same line and period");
        seen.add(key);
        const { data: existing } = await supabase.from("spend_entries").select("id").eq("organization_id", org_id).eq("budget_line_id", lineId).eq("period", period).maybeSingle();
        upserts.push({
          id: existing ? Number(existing.id) : null,
          insert: { organization_id: org_id, budget_line_id: lineId, period, amount_spent: money(amount) },
        });
      } catch (e) {
        errors.push({ row: rowNumber, error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (errors.length) throw new HttpError(422, JSON.stringify({ errors }));
    let created = 0;
    let updated = 0;
    for (const item of upserts) {
      if (item.id !== null) {
        await supabase.from("spend_entries").update({ amount_spent: item.insert.amount_spent }).eq("id", item.id);
        updated += 1;
      } else {
        const { error } = await supabase.from("spend_entries").insert(item.insert);
        if (error) throw new HttpError(500, `Import failed: ${error.message}`);
        created += 1;
      }
    }
    await logAudit(supabase, ctx, "spend_entry_added", { import: true, created, updated });
    return json({ ok: true, created, updated, errors: [] });
  }

  if (first === "budget-lines" && seg.length === 3 && seg[2] === "forecast" && method === "GET") {
    const { data: line } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const { data: entries } = await supabase.from("spend_entries").select("period, amount_spent").eq("organization_id", org_id).eq("budget_line_id", Number(seg[1])).order("period", { ascending: true });
    const horizon = Number(query.get("horizon")) || 4;
    const points = forecastSpend((entries ?? []).map((e) => ({ period: String(e.period), amount_spent: num(e.amount_spent) })), horizon);
    return json({ budget_line_id: Number(seg[1]), horizon, points });
  }

  if (first === "budget-lines" && seg.length === 4 && seg[2] === "forecast" && seg[3] === "backtest" && method === "GET") {
    const lineId = Number(seg[1]);
    const { data: line } = await supabase.from("budget_lines").select("id").eq("organization_id", org_id).eq("id", lineId).maybeSingle();
    if (!line) throw new HttpError(404, "Budget line not found");
    const { data: entries } = await supabase.from("spend_entries").select("period, amount_spent").eq("organization_id", org_id).eq("budget_line_id", lineId).order("period", { ascending: true });
    const holdout = Number(query.get("holdout")) || 2;
    const result = backtestForecast((entries ?? []).map((e) => ({ period: String(e.period), amount_spent: num(e.amount_spent) })), holdout);
    if (!result) throw new HttpError(422, `Insufficient data for backtest (need at least ${3 + Math.min(10, Math.max(1, holdout))} data points)`);
    return json({ budget_line_id: lineId, ...result });
  }

  // ---- Departments / performance scores -----------------------------------
  if (first === "departments" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) throw new HttpError(422, "Department name is required");
    const { data: dup } = await supabase.from("departments").select("id").eq("organization_id", org_id).eq("name", name).maybeSingle();
    if (dup) throw new HttpError(409, "Department already exists");
    const priority = Number(body.priority_weight);
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) throw new HttpError(422, "priority_weight must be between 0 and 100");
    const { data: created, error } = await supabase.from("departments").insert({
      organization_id: org_id,
      name,
      priority_weight: priority || 50,
    }).select("id, name, priority_weight").single();
    if (error) throw new HttpError(500, `Create failed: ${error.message}`);
    await logAudit(supabase, ctx, "department_create", { department_id: Number(created.id), name: created.name });
    return json({ id: Number(created.id), name: created.name, priority_weight: Number(created.priority_weight) }, 201);
  }

  if (first === "departments" && method === "GET") {
    const { data: depts } = await supabase.from("departments").select("*").eq("organization_id", org_id).order("id", { ascending: true });
    const { data: allLines } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id);
    const metrics = await loadMetrics(supabase, org_id);
    const out = (depts ?? []).map((d) => ({
      id: Number(d.id),
      name: d.name,
      priority_weight: Number(d.priority_weight),
      budget_lines: (allLines ?? []).filter((l) => Number(l.department_id) === Number(d.id)).map((l) => ({
        id: Number(l.id), name: l.name, department_id: Number(l.department_id), allocated_amount: num(l.allocated_amount), remaining_budget: liveRemaining(l, metrics), priority_weight: Number(l.priority_weight), category: l.category, necessary_future_spend: num(l.necessary_future_spend), safety_reserve: num(l.safety_reserve), policy_maximum_transfer: num(l.policy_maximum_transfer),
      })),
    }));
    return json(out);
  }

  if (first === "performance-scores" && method === "GET") {
    const { data: scores } = await supabase.from("performance_scores").select("*").eq("organization_id", org_id);
    return json((scores ?? []).map((s) => ({ id: Number(s.id), budget_line_id: Number(s.budget_line_id), period: s.period, score: num(s.score), metric_type: s.metric_type })));
  }

  // ---- Recommendations ----------------------------------------------------
  if (first === "recommendations" && seg.length === 1 && method === "GET") {
    const { data: recs } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).order("id", { ascending: false });
    const policy = await loadApprovalPolicy(supabase, org_id);
    const out = (recs ?? []).map((r) => recOut(r, policy));
    const status = query.get("status");
    const filtered = status ? out.filter((r) => r.status === status) : out;
    return json(pageItems(filtered, query.get("page") ? Number(query.get("page")) : null, query.get("page_size") ? Number(query.get("page_size")) : null));
  }

  if (first === "recommendations" && seg.length === 2 && seg[1] === "generate" && method === "POST") {
    const body = await req.json();
    const sourceId = Number(body.source_line_id);
    const targetId = Number(body.target_line_id);
    if (sourceId === targetId) throw new HttpError(422, "Source and target budget lines must be different");
    const { data: source } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", sourceId).maybeSingle();
    const { data: target } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", targetId).maybeSingle();
    if (!source || !target) throw new HttpError(404, "Budget line not found");
    const metrics = await loadMetrics(supabase, org_id);
    const sourceRemaining = liveRemaining(source, metrics);
    const targetRemaining = liveRemaining(target, metrics);
    const targetFundingGap = Math.max(0, num(target.allocated_amount) - targetRemaining);
    const guardrails = calculateTransfer(sourceRemaining, num(source.necessary_future_spend), num(source.safety_reserve), targetFundingGap, num(source.policy_maximum_transfer));
    if (guardrails.transfer <= 0) throw new HttpError(422, `No transferable surplus (capped by: ${guardrails.capped_by})`);

    const { data: entries } = await supabase.from("spend_entries").select("amount_spent").eq("organization_id", org_id).eq("budget_line_id", sourceId).order("period", { ascending: true });
    const anomaly = detectVelocityAnomaly((entries ?? []).map((e) => num(e.amount_spent)));
    const { data: srcPerf } = await supabase.from("performance_scores").select("score").eq("organization_id", org_id).eq("budget_line_id", sourceId).order("period", { ascending: false }).limit(1).maybeSingle();
    const { data: tgtPerf } = await supabase.from("performance_scores").select("score").eq("organization_id", org_id).eq("budget_line_id", targetId).order("period", { ascending: false }).limit(1).maybeSingle();

    const transfer = money(guardrails.transfer);
    const priorityGap = Number(target.priority_weight) - Number(source.priority_weight);
    const deterministicConfidence = Math.round(Math.min(0.96, Math.max(0.62, 0.7 + priorityGap / 500 + (anomaly.detected ? 0.06 : 0))) * 100) / 100;

    const evidencePrompt =
      `Budget reallocation evidence:\n\n` +
      `SOURCE BUDGET LINE: ${source.name}\n  Priority score: ${source.priority_weight}/100\n  Performance score: ${srcPerf ? num(srcPerf.score) : 50}/100\n  Remaining budget: ₹${sourceRemaining.toLocaleString("en-IN")}\n  Spend velocity anomaly: ${anomaly.velocity_multiplier}x acceleration detected\n\n` +
      `TARGET BUDGET LINE: ${target.name}\n  Priority score: ${target.priority_weight}/100\n  Performance score: ${tgtPerf ? num(tgtPerf.score) : 50}/100\n  Funding gap: ₹${targetFundingGap.toLocaleString("en-IN")}\n\n` +
      `CALCULATED TRANSFER (deterministic engine): ₹${transfer.toLocaleString("en-IN")}\nCapped by: ${guardrails.capped_by}\n\n` +
      `Generate a recommendation with 6 reasoning steps, a confidence score, and a one-sentence estimated consequence if this recommendation is rejected. ` +
      `If you echo the calculated transfer, put the exact provided value in validated_transfer. Never recalculate or change that value.`;

    // Real AI reasoning only — no deterministic fabrication fallback. If the
    // provider is unconfigured, fails, or returns invalid output, surface the
    // failure instead of silently substituting an explanation.
    const groq = await groqReasoning(evidencePrompt, transfer);
    if (!groq || !Number.isFinite(Number(groq.validated_transfer)) || Math.abs(Number(groq.validated_transfer) - transfer) >= 1) {
      throw new HttpError(
        503,
        "AI reasoning is currently unavailable (provider unconfigured, unreachable, or returned invalid output). No recommendation was created. Configure the reasoning provider and try again.",
      );
    }
    const confidence = Math.min(1, Math.max(0, Number(groq.confidence) || deterministicConfidence));
    const rationale = {
      recommendation: String(groq.recommendation),
      reasoning_steps: (groq.reasoning_steps as { step: number; label: string; detail: string }[]).map((s) => ({
        step: Number(s.step), label: String(s.label), detail: String(s.detail),
      })),
      confidence,
      rejection_consequence: String(groq.rejection_consequence ?? ""),
      validated_transfer: transfer,
      explanation_source: "groq",
    };

    const { data: created, error } = await supabase.from("recommendations").insert({
      organization_id: org_id,
      source_line_id: sourceId,
      target_line_id: targetId,
      amount: transfer,
      rationale_json: rationale,
      status: "pending",
      confidence,
    }).select().single();
    if (error) throw new HttpError(500, `Generation failed: ${error.message}`);
    return json(recOut(created), 201);
  }

  if (first === "recommendations" && seg.length === 2 && method === "GET") {
    const { data: rec } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!rec) throw new HttpError(404, "Recommendation not found");
    const policy = await loadApprovalPolicy(supabase, org_id);
    return json(recOut(rec, policy));
  }

  if (first === "recommendations" && seg.length === 3 && ["approve", "modify", "reject"].includes(seg[2]) && method === "POST") {
    const recId = Number(seg[1]);
    const { data: rec } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", recId).maybeSingle();
    if (!rec) throw new HttpError(404, "Recommendation not found");
    if (rec.status !== "pending") throw new HttpError(409, `Recommendation already ${rec.status}`);

    const { data: source } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(rec.source_line_id)).maybeSingle();
    const { data: target } = await supabase.from("budget_lines").select("*").eq("organization_id", org_id).eq("id", Number(rec.target_line_id)).maybeSingle();
    if (!source || !target) throw new HttpError(409, "Recommendation references a missing budget line");

    // Enforce the saved approval policy: each approval step must be taken by a
    // role in that step's tier (or a delegated approver); dual-sign requires a
    // second, different actor.
    const policy = await loadApprovalPolicy(supabase, org_id);
    const policyTiers = [...policy.tiers].sort((a, b) => Number(a.level) - Number(b.level));
    const tierApprovals: { tier_level: number; actor_user_id: string; actor_role: string; approved_at: string; action: string }[] =
      Array.isArray(rec.tier_approvals)
        ? (rec.tier_approvals as { tier_level: number; actor_user_id: string; actor_role: string; approved_at: string; action: string }[])
        : [];
    const completedLevels = tierApprovals.map((t) => Number(t.tier_level));
    const currentLevel = (completedLevels.length ? Math.max(...completedLevels) : 0) + 1;
    const stepTier = policyTiers.find((t) => Number(t.level) === currentLevel) ?? policyTiers[policyTiers.length - 1];
    if (!actorEligible(role, user_id, stepTier ?? null, policy)) {
      throw new HttpError(403, `Your role '${role}' is not authorised for approval step ${currentLevel}`);
    }
    const maxLevel = (policyTiers.length ? Math.max(...policyTiers.map((t) => Number(t.level))) : 1) || 1;
    const requiredSignatures = policy.dual_sign ? Math.max(2, maxLevel) : maxLevel;
    if (policy.dual_sign && tierApprovals.length >= 1 && tierApprovals[0].actor_user_id === user_id) {
      throw new HttpError(403, "Dual-sign requires a second, different approver");
    }

    const appTime = new Date().toISOString();
    const metrics = await loadMetrics(supabase, org_id);
    const prevSource = liveRemaining(source, metrics);
    const prevTarget = liveRemaining(target, metrics);
    const amount = num(rec.amount);
    const newApproval = { tier_level: currentLevel, actor_user_id: user_id, actor_role: role, approved_at: appTime, action: seg[2] };

    if (seg[2] === "approve") {
      if (prevSource < amount) throw new HttpError(422, `Approval would make source budget negative (remaining: ₹${prevSource.toLocaleString("en-IN")}, amount: ₹${amount.toLocaleString("en-IN")})`);
      const fullyApproved = tierApprovals.length + 1 >= requiredSignatures;
      const nextApprovals = [...tierApprovals, newApproval];
      const { error } = await supabase.from("recommendations").update({
        status: fullyApproved ? "approved" : "pending",
        tier_approvals: nextApprovals,
        ...(fullyApproved ? { approved_at: appTime } : {}),
      }).eq("organization_id", org_id).eq("id", recId).eq("status", "pending");
      if (error) throw new HttpError(409, "Recommendation was already changed");
      await logAudit(supabase, ctx, "approve", {
        previous_source_budget: money(prevSource), new_source_budget: money(prevSource - amount),
        previous_target_budget: money(prevTarget), new_target_budget: money(prevTarget + amount),
        amount: money(amount), tier_level: currentLevel, tier_approvals_count: nextApprovals.length,
      }, recId);
      const { data: updated } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", recId).single();
      return json(recOut(updated, policy));
    }

    if (seg[2] === "reject") {
      const body = await req.json().catch(() => ({}));
      const { error } = await supabase.from("recommendations").update({ status: "rejected" }).eq("organization_id", org_id).eq("id", recId).eq("status", "pending");
      if (error) throw new HttpError(409, "Recommendation was already changed");
      await logAudit(supabase, ctx, "reject", {
        previous_source_budget: money(prevSource), new_source_budget: money(prevSource),
        previous_target_budget: money(prevTarget), new_target_budget: money(prevTarget),
        reason: body.reason ?? "", amount: money(amount),
      }, recId);
      const { data: updated } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", recId).single();
      return json(recOut(updated, policy));
    }

    // modify
    const body = await req.json();
    const requested = money(body.amount);
    if (requested <= 0) throw new HttpError(422, "Enter a valid positive amount.");
    if (sourceRemainingSafetyCheck(prevSource, requested)) throw new HttpError(422, `Amount would make source budget negative (remaining: ₹${prevSource.toLocaleString("en-IN")})`);
    const guardrails = calculateTransfer(prevSource, num(source.necessary_future_spend), num(source.safety_reserve), Math.max(0, num(target.allocated_amount) - prevTarget), num(source.policy_maximum_transfer));
    const validationError = validateCustomAmount(requested, guardrails.source_surplus, guardrails.target_funding_gap, num(source.policy_maximum_transfer));
    if (validationError) throw new HttpError(422, validationError);
    const nextApprovals = [...tierApprovals, newApproval];
    const { error: updateError } = await supabase.from("recommendations").update({ amount: requested, status: "modified", tier_approvals: nextApprovals, approved_at: appTime }).eq("organization_id", org_id).eq("id", recId).eq("status", "pending");
    if (updateError) throw new HttpError(409, "Recommendation was already changed");
    await logAudit(supabase, ctx, "modify", {
      previous_source_budget: money(prevSource), new_source_budget: money(prevSource - requested),
      previous_target_budget: money(prevTarget), new_target_budget: money(prevTarget + requested),
      original_amount: money(amount), modified_amount: requested, tier_level: currentLevel,
    }, recId);
    const { data: updated } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", recId).single();
    return json(recOut(updated, policy));
  }

  if (first === "recommendations" && seg.length === 3 && seg[2] === "approval-state" && method === "GET") {
    const { data: rec } = await supabase.from("recommendations").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!rec) throw new HttpError(404, "Recommendation not found");
    const policy = await loadApprovalPolicy(supabase, org_id);
    return json({
      id: Number(seg[1]),
      approval_state: rec.status,
      status: rec.status,
      tier_approvals: Array.isArray(rec.tier_approvals) ? rec.tier_approvals : [],
      approval_history: [],
      escalated: Boolean(rec.escalated),
      escalation: recOut(rec, policy).escalation,
    });
  }

  if (first === "recommendations" && seg.length === 3 && seg[2] === "escalate" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const recId = Number(seg[1]);
    const { data: rec } = await supabase.from("recommendations").select("id, status").eq("organization_id", org_id).eq("id", recId).maybeSingle();
    if (!rec) throw new HttpError(404, "Recommendation not found");
    if (["approved", "rejected", "modified"].includes(String(rec.status))) {
      throw new HttpError(409, "Cannot escalate a finalised recommendation");
    }
    await supabase.from("recommendations").update({ escalated: true, escalated_at: new Date().toISOString(), escalated_by: user_id }).eq("organization_id", org_id).eq("id", recId);
    await logAudit(supabase, ctx, "recommendation_escalated", { recommendation_id: recId });
    return json({ escalated: true, recommendation_id: recId });
  }

  // ---- Audit --------------------------------------------------------------
  if (first === "audit" && method === "GET") {
    const { data: events } = await supabase.from("audit_events").select("*").eq("organization_id", org_id).order("timestamp", { ascending: false });
    const recFilter = query.get("recommendation_id");
    const out = (events ?? [])
      .filter((e) => (recFilter ? Number(e.recommendation_id) === Number(recFilter) : true))
      .map((e) => ({
        id: Number(e.id),
        recommendation_id: e.recommendation_id ? Number(e.recommendation_id) : null,
        action: e.action,
        actor: (e.event_metadata as Record<string, unknown>)?.actor_display_name ?? String(e.actor ?? ""),
        event_metadata: e.event_metadata ?? {},
        timestamp: e.timestamp,
      }));
    return json(pageItems(out, query.get("page") ? Number(query.get("page")) : null, query.get("page_size") ? Number(query.get("page_size")) : null));
  }

  // ---- Onboarding / organization config -----------------------------------
  if (first === "onboarding" && seg[1] === "data" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const { data: orgRow } = await supabase.from("organizations").select("*").eq("id", org_id).single();
    await supabase.from("organizations").update({
      name: String(body.org_name ?? orgRow?.name ?? "BudgetIQ Demo Org").trim(),
      fiscal_year: String(body.fiscal_year ?? orgRow?.fiscal_year ?? "FY25"),
      currency: String(body.currency ?? orgRow?.currency ?? "INR").trim().toUpperCase().slice(0, 3),
    }).eq("id", org_id);
    // Persist the workspace profile (industry / company size / planning period)
    // so the onboarding form is truthful, not decorative.
    const profile = {
      industry: body.industry ? String(body.industry) : undefined,
      company_size: body.company_size ? String(body.company_size) : undefined,
      planning_period: body.planning_period ? String(body.planning_period) : undefined,
    };
    if (profile.industry || profile.company_size || profile.planning_period) {
      const { data: existingOb } = await supabase.from("onboarding_configs").select("metadata").eq("organization_id", org_id).maybeSingle();
      const mergedMetadata = { ...(existingOb?.metadata ?? {}), ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined)) };
      await supabase.from("onboarding_configs").upsert({ organization_id: org_id, metadata: mergedMetadata }, { onConflict: "organization_id" });
    }
    const created = { departments: 0, budget_lines: 0 };
    const { data: depts } = await supabase.from("departments").select("id, name").eq("organization_id", org_id);
    const existingDept = new Map((depts ?? []).map((d) => [String(d.name), Number(d.id)]));
    for (const d of body.departments ?? []) {
      if (!existingDept.has(String(d.name))) {
        const { data: createdDept } = await supabase.from("departments").insert({ organization_id: org_id, name: String(d.name), priority_weight: Number(d.priority_weight) || 50 }).select().single();
        existingDept.set(String(d.name), Number(createdDept.id));
        created.departments += 1;
      }
    }
    const { data: existingLines } = await supabase.from("budget_lines").select("department_id, name").eq("organization_id", org_id);
    const seen = new Set((existingLines ?? []).map((l) => `${Number(l.department_id)}|${l.name}`));
    for (const l of body.budget_lines ?? []) {
      const deptId = existingDept.get(String(l.department_name));
      if (!deptId) continue;
      const key = `${deptId}|${String(l.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await supabase.from("budget_lines").insert({
        organization_id: org_id, department_id: deptId, name: String(l.name),
        allocated_amount: money(l.allocated_amount), priority_weight: Number(l.priority_weight) || 50,
        category: String(l.category ?? ""), necessary_future_spend: money(l.necessary_future_spend) || 0,
        safety_reserve: money(l.safety_reserve) || 0, policy_maximum_transfer: money(l.policy_maximum_transfer) || 0,
      });
      created.budget_lines += 1;
    }
    await logAudit(supabase, ctx, "onboarding_data", { created });
    return json({ ok: true, created });
  }

  if ((first === "onboarding" || first === "organization") && seg[1] === "config" && method === "GET") {
    const { data: orgRow } = await supabase.from("organizations").select("name, fiscal_year, currency").eq("id", org_id).maybeSingle();
    const { data: ob } = await supabase.from("onboarding_configs").select("completed_steps, metadata").eq("organization_id", org_id).maybeSingle();
    return json({
      org_name: orgRow?.name ?? "",
      fiscal_year: orgRow?.fiscal_year ?? "",
      currency: orgRow?.currency ?? "INR",
      completed_steps: ob?.completed_steps ?? [],
      metadata: ob?.metadata ?? {},
    });
  }

  if ((first === "onboarding" && seg[1] === "config" || first === "organization" && seg[1] === "config") && method === "PATCH") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.org_name !== undefined) updates.name = String(body.org_name).trim();
    if (body.fiscal_year !== undefined) updates.fiscal_year = String(body.fiscal_year).trim();
    if (body.currency !== undefined) updates.currency = String(body.currency).trim().toUpperCase().slice(0, 3);
    if (Object.keys(updates).length) await supabase.from("organizations").update(updates).eq("id", org_id);
    await logAudit(supabase, ctx, "organization_config_update", { fields: Object.keys(updates) });
    const { data: orgRow } = await supabase.from("organizations").select("name, fiscal_year, currency").eq("id", org_id).single();
    return json({ org_name: orgRow.name, fiscal_year: orgRow.fiscal_year, currency: orgRow.currency, updated_at: new Date().toISOString() });
  }

  if (first === "onboarding" && seg[1] === "priorities" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    let updated = 0;
    for (const item of body.line_priorities ?? []) {
      const { error } = await supabase.from("budget_lines").update({ priority_weight: Number(item.priority_weight) }).eq("organization_id", org_id).eq("name", String(item.name));
      if (!error) updated += 1;
    }
    await logAudit(supabase, ctx, "onboarding_priorities", { updated });
    return json({ ok: true, updated });
  }

  if (first === "onboarding" && seg[1] === "policies" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    let updated = 0;
    for (const item of body.line_policies ?? []) {
      const updates: Record<string, number> = {};
      if (item.safety_reserve !== undefined) updates.safety_reserve = money(item.safety_reserve);
      if (item.necessary_future_spend !== undefined) updates.necessary_future_spend = money(item.necessary_future_spend);
      if (item.policy_maximum_transfer !== undefined) updates.policy_maximum_transfer = money(item.policy_maximum_transfer);
      if (!Object.keys(updates).length) continue;
      const { error } = await supabase.from("budget_lines").update(updates).eq("organization_id", org_id).eq("name", String(item.name));
      if (!error) updated += 1;
    }
    await logAudit(supabase, ctx, "onboarding_policies", { updated });
    return json({ ok: true, updated });
  }

  // ---- Fiscal calendar ----------------------------------------------------
  if (first === "organization" && seg[1] === "fiscal-calendar" && method === "GET") {
    const { data: cal } = await supabase.from("fiscal_calendar").select("*").eq("organization_id", org_id).maybeSingle();
    return json(cal ?? { fiscal_year_start_month: 4, period_type: "quarterly", period_labels: ["Q1", "Q2", "Q3", "Q4"] });
  }

  if (first === "organization" && seg[1] === "fiscal-calendar" && method === "PUT") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const doc = {
      organization_id: org_id,
      fiscal_year_start_month: Math.max(1, Math.min(12, Number(body.fiscal_year_start_month) || 4)),
      period_type: ["monthly", "quarterly", "custom"].includes(body.period_type) ? body.period_type : "quarterly",
      period_labels: Array.isArray(body.period_labels) ? body.period_labels : ["Q1", "Q2", "Q3", "Q4"],
    };
    const { data: existing } = await supabase.from("fiscal_calendar").select("organization_id").eq("organization_id", org_id).maybeSingle();
    if (existing) await supabase.from("fiscal_calendar").update(doc).eq("organization_id", org_id);
    else await supabase.from("fiscal_calendar").insert(doc);
    await logAudit(supabase, ctx, "fiscal_calendar_updated", { fiscal_year_start_month: doc.fiscal_year_start_month, period_type: doc.period_type });
    return json(doc);
  }

  // ---- Members ------------------------------------------------------------
  if (first === "organization" && seg[1] === "members" && seg.length === 2 && method === "GET") {
    const { data: members } = await supabase.from("organization_members").select("*").eq("organization_id", org_id);
    const emails = await usersByEmail(supabase);
    return json((members ?? []).map((m) => ({
      user_id: m.user_id,
      email: emails.get(m.user_id as string) ?? "",
      role: m.role,
      status: "active",
      created_at: m.created_at,
    })));
  }

  if (first === "organization" && seg[1] === "members" && seg.length === 3 && seg[2] !== "resend-invitation" && method === "PATCH") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const memberId = seg[2];
    const body = await req.json();
    if (!SUPPORTED_ROLES.includes(body.role)) throw new HttpError(422, "Unsupported organization role");
    const { data: member } = await supabase.from("organization_members").select("*").eq("organization_id", org_id).eq("user_id", memberId).maybeSingle();
    if (!member) throw new HttpError(404, "Organization member not found");
    await supabase.from("organization_members").update({ role: body.role }).eq("organization_id", org_id).eq("user_id", memberId);
    await logAudit(supabase, ctx, "membership_role_update", { member_id: memberId, role: body.role });
    const emails = await usersByEmail(supabase);
    return json({ user_id: memberId, email: emails.get(memberId) ?? "", role: body.role, status: "active", created_at: member.created_at });
  }

  if (first === "organization" && seg[1] === "members" && seg.length === 3 && method === "DELETE") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    if (seg[2] === user_id) throw new HttpError(400, "You cannot deactivate your own account");
    const { data: member } = await supabase.from("organization_members").select("user_id").eq("organization_id", org_id).eq("user_id", seg[2]).maybeSingle();
    if (!member) throw new HttpError(404, "Active member not found");
    await supabase.from("organization_members").delete().eq("organization_id", org_id).eq("user_id", seg[2]);
    await logAudit(supabase, ctx, "member_deactivated", { member_id: seg[2] });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (first === "organization" && seg[1] === "members" && seg[3] === "resend-invitation" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const invitationId = seg[2];
    const { data: inv } = await supabase.from("organization_invitations").select("*").eq("organization_id", org_id).eq("id", invitationId).eq("status", "pending").maybeSingle();
    if (!inv) throw new HttpError(404, "Pending invitation not found");
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    await supabase.from("organization_invitations").update({ token_hash: await hashKey(token), expires_at: expiresAt }).eq("id", invitationId);
    return json({ resent: true, invitation_id: invitationId, token });
  }

  // ---- Invitations --------------------------------------------------------
  if (first === "organization" && seg[1] === "invitations" && seg.length === 2 && method === "GET") {
    const { data: invites } = await supabase.from("organization_invitations").select("*").eq("organization_id", org_id).order("created_at", { ascending: false });
    const now = Date.now();
    return json((invites ?? []).map((inv) => {
      const expires = new Date(String(inv.expires_at)).getTime();
      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status === "pending" ? (expires > now ? "pending" : "expired") : inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        invited_by: inv.invited_by ?? null,
      };
    }));
  }

  if (first === "organization" && seg[1] === "invitations" && seg.length === 2 && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    if (!SUPPORTED_ROLES.includes(body.role)) throw new HttpError(422, "Unsupported organization role");
    const token = generateToken();
    const expiresDays = Number(body.expires_in_days) || 7;
    const { data: created, error } = await supabase.from("organization_invitations").insert({
      organization_id: org_id,
      email: String(body.email).trim().toLowerCase(),
      role: body.role,
      token_hash: await hashKey(token),
      status: "pending",
      expires_at: new Date(Date.now() + expiresDays * 86400 * 1000).toISOString(),
      invited_by: user_id,
    }).select().single();
    if (error) throw new HttpError(422, error.message.includes("duplicate") ? "Invitation for this email already exists" : `Invitation failed: ${error.message}`);
    await logAudit(supabase, ctx, "invitation_created", { email: created.email, role: body.role });
    return json({ id: created.id, email: created.email, role: body.role, expires_at: created.expires_at, token }, 201);
  }

  if (first === "organization" && seg[1] === "invitations" && seg.length === 3 && method === "DELETE") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: inv } = await supabase.from("organization_invitations").select("id").eq("organization_id", org_id).eq("id", seg[2]).eq("status", "pending").maybeSingle();
    if (!inv) throw new HttpError(404, "Pending invitation not found");
    await supabase.from("organization_invitations").update({ status: "cancelled" }).eq("id", seg[2]);
    await logAudit(supabase, ctx, "invitation_cancelled", { invitation_id: seg[2] });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (first === "organization" && seg[1] === "invitations" && seg.length === 3 && seg[2] === "accept" && method === "POST") {
    const body = await req.json();
    return acceptInvitation(supabase, ctx, String(body.token ?? ""));
  }

  if (first === "organization" && seg[1] === "invitations" && seg.length === 4 && seg[3] === "accept" && method === "POST") {
    // Path-parameter variant for parity with the Python contract: /organization/invitations/{token}/accept
    return acceptInvitation(supabase, ctx, seg[2]);
  }

  // ---- API keys -----------------------------------------------------------
  if (first === "api-keys" && seg.length === 1 && method === "GET") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: keys } = await supabase.from("organization_api_keys").select("*").eq("organization_id", org_id).order("created_at", { ascending: false });
    return json((keys ?? []).map((k) => apiKeyOut(k)));
  }

  if (first === "api-keys" && seg.length === 1 && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const raw = generateKey();
    const expiresDays = body.expires_in_days ? Number(body.expires_in_days) : null;
    const { data: created, error } = await supabase.from("organization_api_keys").insert({
      organization_id: org_id,
      name: String(body.name).trim(),
      key_hash: await hashKey(raw),
      scopes: Array.isArray(body.scopes) ? Array.from(new Set(body.scopes)).sort() : ["budgets:read"],
      created_by: user_id,
      expires_at: expiresDays ? new Date(Date.now() + expiresDays * 86400 * 1000).toISOString() : null,
      revoked_at: null,
    }).select().single();
    if (error) throw new HttpError(422, `Create failed: ${error.message}`);
    await logAudit(supabase, ctx, "api_key_created", { api_key_id: created.id, scopes: created.scopes });
    return json({ ...apiKeyOut(created), key: raw, status: "active" }, 201);
  }

  if (first === "api-keys" && seg.length === 3 && seg[2] === "rotate" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: old } = await supabase.from("organization_api_keys").select("*").eq("organization_id", org_id).eq("id", seg[1]).maybeSingle();
    if (!old) throw new HttpError(404, "API key not found");
    await supabase.from("organization_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", seg[1]);
    const raw = generateKey();
    const { data: created, error } = await supabase.from("organization_api_keys").insert({
      organization_id: org_id,
      name: old.name,
      key_hash: await hashKey(raw),
      scopes: old.scopes,
      created_by: user_id,
      expires_at: old.expires_at,
      revoked_at: null,
    }).select().single();
    if (error) throw new HttpError(422, `Rotate failed: ${error.message}`);
    return json({ ...apiKeyOut(created), key: raw, status: "active" });
  }

  if (first === "api-keys" && seg.length === 2 && method === "DELETE") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const { data: key } = await supabase.from("organization_api_keys").select("id").eq("organization_id", org_id).eq("id", seg[1]).eq("revoked_at", null).maybeSingle();
    if (!key) throw new HttpError(404, "API key not found");
    await supabase.from("organization_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", seg[1]);
    await logAudit(supabase, ctx, "api_key_revoked", { api_key_id: seg[1] });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---- Governance ---------------------------------------------------------
  if (first === "governance" && seg[1] === "approval-policy" && method === "GET") {
    const { data: policy } = await supabase.from("approval_policies").select("*").eq("organization_id", org_id).maybeSingle();
    return json(policy ?? {
      tiers: [{ level: 1, min_amount: 0, approver_roles: ["admin", "CFO", "VP Finance", "Finance Manager", "Controller"] }],
      escalation_hours: 24, delegated_approvers: [], dual_sign: false, updated_at: new Date().toISOString(),
    });
  }

  if (first === "governance" && seg[1] === "approval-policy" && method === "PUT") {
    if (!isAdmin) throw new HttpError(403, "Organization administrator role required");
    const body = await req.json();
    const tiers = (body.tiers ?? []).map((t: { level: number; min_amount: number; approver_roles: string[] }) => ({
      level: Number(t.level), min_amount: money(t.min_amount), approver_roles: Array.isArray(t.approver_roles) ? t.approver_roles : [],
    }));
    for (const t of tiers) for (const role of t.approver_roles) {
      if (!SUPPORTED_ROLES.includes(role)) throw new HttpError(422, "Unsupported approver role");
    }
    const doc = {
      organization_id: org_id,
      tiers,
      escalation_hours: Math.max(1, Number(body.escalation_hours) || 24),
      delegated_approvers: Array.isArray(body.delegated_approvers) ? body.delegated_approvers : [],
      dual_sign: Boolean(body.dual_sign),
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("approval_policies").select("organization_id").eq("organization_id", org_id).maybeSingle();
    if (existing) await supabase.from("approval_policies").update(doc).eq("organization_id", org_id);
    else await supabase.from("approval_policies").insert(doc);
    await logAudit(supabase, ctx, "approval_policy_updated", { dual_sign: doc.dual_sign, tier_count: tiers.length });
    return json(doc);
  }

  // ---- Scenarios ----------------------------------------------------------
  if (first === "scenarios" && seg.length === 1 && method === "GET") {
    const { data: scenarios } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).order("created_at", { ascending: false });
    const out = (scenarios ?? []).map((s) => scenarioOut(s));
    return json(pageItems(out, query.get("page") ? Number(query.get("page")) : null, query.get("page_size") ? Number(query.get("page_size")) : null));
  }

  if (first === "scenarios" && seg.length === 1 && method === "POST") {
    const body = await req.json();
    const now = new Date().toISOString();
    const { data: created, error } = await supabase.from("scenarios").insert({
      organization_id: org_id,
      name: String(body.name ?? "").trim(),
      created_by: user_id,
      shared: Boolean(body.shared),
      filters: body.filters ?? {},
    }).select().single();
    if (error) throw new HttpError(422, `Create failed: ${error.message}`);
    return json(scenarioOut(created), 201);
  }

  if (first === "scenarios" && seg.length === 2 && seg[1] !== "duplicate" && method === "GET") {
    const { data: s } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!s) throw new HttpError(404, "Scenario not found");
    return json(scenarioOut(s));
  }

  if (first === "scenarios" && seg.length === 2 && seg[1] !== "duplicate" && method === "PATCH") {
    const { data: s } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!s) throw new HttpError(404, "Scenario not found");
    if (String(s.created_by) !== user_id && !isAdmin) throw new HttpError(403, "Only the creator or an admin can edit this scenario");
    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.filters !== undefined) updates.filters = body.filters;
    if (body.shared !== undefined) {
      if (body.shared && !isAdmin) throw new HttpError(403, "Only admins can share scenarios organisation-wide");
      updates.shared = Boolean(body.shared);
    }
    await supabase.from("scenarios").update(updates).eq("organization_id", org_id).eq("id", Number(seg[1]));
    const { data: updated } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).single();
    return json(scenarioOut(updated));
  }

  if (first === "scenarios" && seg.length === 2 && seg[1] !== "duplicate" && method === "DELETE") {
    const { data: s } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!s) throw new HttpError(404, "Scenario not found");
    if (String(s.created_by) !== user_id && !isAdmin) throw new HttpError(403, "Only the creator or an admin can delete this scenario");
    await supabase.from("scenarios").delete().eq("organization_id", org_id).eq("id", Number(seg[1]));
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (first === "scenarios" && seg.length === 3 && seg[2] === "duplicate" && method === "POST") {
    const { data: s } = await supabase.from("scenarios").select("*").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!s) throw new HttpError(404, "Scenario not found");
    const now = new Date().toISOString();
    const { data: created, error } = await supabase.from("scenarios").insert({
      organization_id: org_id,
      name: `${s.name} (copy)`,
      created_by: user_id,
      shared: false,
      filters: s.filters ?? {},
      created_at: now,
      updated_at: now,
    }).select().single();
    if (error) throw new HttpError(422, `Duplicate failed: ${error.message}`);
    return json(scenarioOut(created), 201);
  }

  if (first === "scenarios" && seg.length === 3 && seg[2] === "share" && method === "POST") {
    if (!isAdmin) throw new HttpError(403, "Only admins can share scenarios organisation-wide");
    const { data: s } = await supabase.from("scenarios").select("id").eq("organization_id", org_id).eq("id", Number(seg[1])).maybeSingle();
    if (!s) throw new HttpError(404, "Scenario not found");
    await supabase.from("scenarios").update({ shared: true, updated_at: new Date().toISOString() }).eq("organization_id", org_id).eq("id", Number(seg[1]));
    return json({ shared: true, scenario_id: Number(seg[1]) });
  }

  // ---- Provider status ----------------------------------------------------
  if (first === "providers" && seg[1] === "status" && method === "GET") {
    const groqKey = (Deno.env.get("GROQ_API_KEY") ?? "").trim();
    const groqConfigured = Boolean(groqKey) && !["your-groq-key-here", "dummy_key_for_testing"].includes(groqKey.toLowerCase());
    return json({
      providers: [
        { name: "erp", state: "deferred", configured: false, message: "Direct ERP connectors are deferred; CSV/manual ingestion is the supported path." },
        { name: "billing", state: "deferred", configured: false, message: "Billing is deferred and does not block core workflows." },
        {
          name: "explanation",
          state: groqConfigured ? "configured" : "unavailable",
          configured: groqConfigured,
          message: groqConfigured
            ? "Groq explains deterministic transfer calculations; it never sets transfer amounts."
            : "GROQ_API_KEY is not configured — recommendation generation returns a clear error instead of fabricating a fallback.",
        },
      ],
    });
  }

  throw new HttpError(404, "Not found");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path.startsWith(PREFIX)) path = path.slice(PREFIX.length) || "/";
    else if (path.startsWith("/api")) path = path.slice(4) || "/";
    if (!path.startsWith("/")) path = "/" + path;

    const ctx = await resolveAuth(req, supabase);
    return await handleRequest(req, supabase, ctx, path, req.method);
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ detail: err.message }, err.status);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("api error:", message, err instanceof Error ? err.stack : "");
    return json({ detail: "Internal server error" }, 500);
  }
});
