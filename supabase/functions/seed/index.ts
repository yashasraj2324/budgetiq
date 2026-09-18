// BudgetIQ demo seed — idempotent bootstrap of the demo organization and data.
// Deploy with verify_jwt=false (see supabase/config.toml) and invoke once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "demo@budgetiq.app";
const DEMO_ORG_NAME = "BudgetIQ Demo Org";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // 1. Demo auth user (real, email-confirmed)
    let demoUserId: string | null = null;
    {
      const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      demoUserId = data?.users.find((u) => u.email === DEMO_EMAIL)?.id ?? null;
    }
    if (!demoUserId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: "BudgetIQ_demo_2026",
        email_confirm: true,
        user_metadata: { display_name: "Local Developer", role: "VP Finance" },
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      demoUserId = data.user!.id;
    }

    // 2. Demo organization
    let org: { id: string } | null = null;
    {
      const { data } = await supabase
        .from("organizations")
        .select("id")
        .eq("name", DEMO_ORG_NAME)
        .maybeSingle();
      org = data;
    }
    if (!org) {
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name: DEMO_ORG_NAME, fiscal_year: "FY25", currency: "INR" })
        .select("id")
        .single();
      if (error) throw new Error(`org insert: ${error.message}`);
      org = data;
    }

    // 3. Membership (demo user = VP Finance)
    {
      const { count } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("user_id", demoUserId);
      if (!count) {
        const { error } = await supabase.from("organization_members").insert({
          organization_id: org.id,
          user_id: demoUserId,
          role: "VP Finance",
        });
        if (error) throw new Error(`membership: ${error.message}`);
      }
    }

    // 4. Departments + budget lines + spend entries + scores + recommendation
    {
      const { count } = await supabase
        .from("departments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      if (!count) {
        const { error: depErr } = await supabase.from("departments").insert([
          { organization_id: org.id, id: 1, name: "Engineering", priority_weight: 90 },
          { organization_id: org.id, id: 2, name: "Marketing", priority_weight: 45 },
          { organization_id: org.id, id: 3, name: "Operations", priority_weight: 65 },
        ]);
        if (depErr) throw new Error(`departments: ${depErr.message}`);

        const lines = [
          { organization_id: org.id, id: 1, department_id: 1, name: "Platform R&D", allocated_amount: 8000000, priority_weight: 88, category: "capex", necessary_future_spend: 3000000, safety_reserve: 300000, policy_maximum_transfer: 1500000 },
          { organization_id: org.id, id: 2, department_id: 2, name: "Regional Events", allocated_amount: 5000000, priority_weight: 35, category: "opex", necessary_future_spend: 800000, safety_reserve: 100000, policy_maximum_transfer: 1000000 },
          { organization_id: org.id, id: 3, department_id: 3, name: "DevOps Tools", allocated_amount: 3000000, priority_weight: 62, category: "opex", necessary_future_spend: 600000, safety_reserve: 80000, policy_maximum_transfer: 500000 },
        ];
        const { error: lineErr } = await supabase.from("budget_lines").insert(lines);
        if (lineErr) throw new Error(`budget_lines: ${lineErr.message}`);

        const entries: Record<string, unknown>[] = [];
        for (let w = 1; w <= 9; w++) {
          const period = `2025-W${String(w).padStart(2, "0")}`;
          const marketingSpend = w === 9 ? 250000 * 2.8 : 250000; // 2.8x anomaly in week 9
          entries.push({ organization_id: org.id, budget_line_id: 2, period, amount_spent: marketingSpend });
          entries.push({ organization_id: org.id, budget_line_id: 1, period, amount_spent: 380000 });
          entries.push({ organization_id: org.id, budget_line_id: 3, period, amount_spent: 140000 });
        }
        const { error: spendErr } = await supabase.from("spend_entries").insert(entries);
        if (spendErr) throw new Error(`spend_entries: ${spendErr.message}`);

        const { error: scoreErr } = await supabase.from("performance_scores").insert([
          { organization_id: org.id, budget_line_id: 1, period: "2025-Q1", score: 91, metric_type: "composite" },
          { organization_id: org.id, budget_line_id: 2, period: "2025-Q1", score: 54, metric_type: "composite" },
          { organization_id: org.id, budget_line_id: 3, period: "2025-Q1", score: 78.5, metric_type: "composite" },
        ]);
        if (scoreErr) throw new Error(`performance_scores: ${scoreErr.message}`);

        const { error: recErr } = await supabase.from("recommendations").insert({
          organization_id: org.id,
          id: 1,
          source_line_id: 2,
          target_line_id: 1,
          amount: 800000,
          rationale_json: {
            recommendation:
              "Transfer ₹8,00,000 from Marketing / Regional Events to Engineering / Platform R&D. " +
              "The Regional Events line shows a 2.8× spend velocity anomaly with low strategic priority (35/100), " +
              "while Platform R&D is underfunded against a high-priority (88/100) roadmap commitment.",
            reasoning_steps: [
              { step: 1, label: "Anomaly Detection", detail: "Regional Events spend velocity is 2.8× the baseline in week 9, triggering the threshold breach alert." },
              { step: 2, label: "Priority Scoring", detail: "Regional Events priority weight is 35/100 vs Platform R&D at 88/100 — a 53-point gap favours reallocation." },
              { step: 3, label: "Surplus Calculation", detail: "Source surplus = remaining − future spend − safety reserve = a large transferable surplus." },
              { step: 4, label: "Funding Gap Analysis", detail: "Platform R&D allocated ₹80,00,000 with limited remaining budget for committed deliverables." },
              { step: 5, label: "Guardrail Validation", detail: "Transfer capped at ₹8,00,000 by policy_maximum_transfer on the source line. All guardrails pass." },
              { step: 6, label: "Confidence Assessment", detail: "High confidence (0.91): strong anomaly signal, large priority differential, and clean guardrail pass." },
            ],
            confidence: 0.91,
            rejection_consequence:
              "If rejected, Platform R&D risks a Q2 sprint delay costing an estimated ₹15,00,000 in contractor overruns, " +
              "while Regional Events continues anomalous spend with no intervention.",
          },
          status: "pending",
          confidence: 0.91,
        });
        if (recErr) throw new Error(`recommendations: ${recErr.message}`);
      }
    }

    // 5. Onboarding config, approval policy, fiscal calendar (idempotent)
    {
      const { count } = await supabase
        .from("onboarding_configs")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      if (!count) {
        await supabase.from("onboarding_configs").insert({
          organization_id: org.id,
          completed_steps: ["workspace", "data", "priorities", "policies"],
          metadata: {},
        });
      }
    }
    {
      const { count } = await supabase
        .from("approval_policies")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      if (!count) {
        await supabase.from("approval_policies").insert({
          organization_id: org.id,
          tiers: [{ level: 1, min_amount: 0, approver_roles: ["Finance Manager"] }],
          escalation_hours: 24,
          delegated_approvers: [],
          dual_sign: false,
        });
      }
    }
    {
      const { count } = await supabase
        .from("fiscal_calendar")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id);
      if (!count) {
        await supabase.from("fiscal_calendar").insert({
          organization_id: org.id,
          fiscal_year_start_month: 4,
          period_type: "quarterly",
          period_labels: ["Q1", "Q2", "Q3", "Q4"],
        });
      }
    }

    return json({ ok: true, organization_id: org.id, user_id: demoUserId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("seed failed:", message);
    return json({ ok: false, error: message }, 500);
  }
});
