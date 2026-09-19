# BudgetIQ — Hackathon Pitch Script

> **One line:** Finance teams already have systems that tell them *what happened*. BudgetIQ tells them **what to do next** — where budget should move, how much, why, and who approves it.

**Tagline:** Don't just understand the variance. Act on it — safely, transparently, and with financial control.

---

## 1. The Problem

Every finance team faces the same trap: **budgets go stale between planning cycles.**

Plans are set at the start of a quarter or year, but business reality changes fast:

- One department starts **spending at 3× its normal pace** in the final weeks of a period — either legitimate, or misaligned budget being burned.
- A high-priority initiative that is **performing well runs out of runway**.
- Budget stays locked in low-priority, low-performing activities.

The result: money sits in the wrong places, and by the time the next planning cycle arrives, the quarter is over.

**The real pain is not visibility — it's the decision.** When a finance manager spots a variance, they still have to manually answer:

- *Where should the money move?*
- *How much can safely move?*
- *Why this amount?*
- *Who approves it?*
- *And can we prove it later?*

That last mile — from **insight to approved action** — is done in spreadsheets, email threads, and tribal knowledge. It is slow, opaque, and un-audited.

---

## 2. The Gap in Existing Solutions

The incumbent finance stack is strong at **planning, forecasting, and reporting**:

| Category | Planful / Pigment / Abacum / Excel | BudgetIQ |
|---|---|---|
| Planning | Core | — |
| Forecasting | Core | Supporting |
| Variance reporting | Core | Supporting |
| **"Should this budget move?"** | Manual / varies | **Core** |
| **How much can safely move?** | Manual | **Core (deterministic)** |
| **Evidence trace for the decision** | Varies | **Core** |
| **Approval workflow + audit** | Varies | **Core** |

These platforms treat the *variance* as the end of the story. **We treat it as the beginning.**

BudgetIQ is not another FP&A suite. It is a specialized **decision layer** that sits on top of the finance stack and answers one question no one owns today:

> **Given what is happening now, where should existing budget move — and who signs off?**

---

## 3. Our Solution

**BudgetIQ detects spend anomalies, calculates financially constrained reallocations, explains the reasoning with AI, and routes the decision through a human approval workflow with a full audit trail.**

The core principle, in five words:

> **Detect → Calculate → Explain → Approve → Audit**

And the one rule that makes it trustworthy:

> **AI does not move the money. The engine calculates. AI explains. The human decides.**

---

## 4. Our Approach — How It Works

### Step 1 — DETECT
The system analyzes every budget line's spend history and flags **three kinds of signals**:

- **Velocity spikes** — a line whose recent spend rate is ≥2× its historical baseline (classic end-of-period budget burn).
- **Underfunded lines** — a line whose remaining budget is below its committed future spend and safety reserve.
- **Allocation outliers** — unusually large allocations on low-priority lines.

Signals are **review flags, not accusations** — the system never assumes intent.

### Step 2 — CALCULATE (the deterministic engine)
The reallocation amount is computed by **financial rules, not by an AI model**:

```
Source Surplus = Remaining Budget − Necessary Future Spend − Safety Reserve
Target Gap     = Required Funding − Available Funding
Transfer       = MIN(Source Surplus, Target Gap, Policy Maximum)
```

The engine enforces guardrails server-side — a recommendation can never make a source budget negative, exceed a policy cap, or fund a line that doesn't need it.

### Step 3 — EXPLAIN (AI, strictly on rails)
An LLM receives the **structured financial evidence** — not free rein — and produces:

- A plain-language recommendation
- A step-by-step reasoning trace ("Why the source? Why the target? Why this amount?")
- The estimated consequence of rejection
- A **validated transfer** that must exactly match the engine's number

If the AI cannot confirm the engine's amount, **the recommendation fails loudly (503)** — there is no fabricated fallback. The LLM explains; it never overrides.

### Step 4 — APPROVE (human in the loop)
Recommendations are never applied automatically. Finance users can:

- **Approve** — with role-based tier checks, optional dual-sign for high-value moves, and delegated approvers
- **Modify** — a custom amount re-validated against the same guardrails
- **Reject** — with the consequence recorded

Overdue approvals trigger **escalation** to the next tier.

### Step 5 — AUDIT (immutable)
Every decision writes an **append-only audit event**: actor, role, timestamp, and before/after budget values for both source and target. Audit records **cannot be edited or deleted** — by design.

---

## 5. The Demo Story

> *It's Week 11 of a 13-week quarter.*

1. **Marketing — Regional Events** is burning at **2.7× its normal velocity** in the final stretch. BudgetIQ flags it.
2. **Product — Customer Onboarding**, a priority-92 initiative, is running out of runway.
3. The engine calculates the permissible move: **₹10,00,000** — capped by policy, never beyond source surplus or target gap.
4. AI explains *why*: source priority 35 vs target priority 92, the spend acceleration, the funding gap — with a six-step reasoning trace.
5. A finance manager **approves**. Source and target budgets update. An immutable audit event records the decision with before/after values.

*That's a decision that used to take days of spreadsheets and email — now it takes minutes, and it's fully defensible.*

---

## 6. Why We Win

1. **A real, underserved problem.** The gap between detecting a variance and acting on it is real, painful, and manual at every mid-market finance team.
2. **A trust architecture, not just AI hype.** The deterministic engine + AI guardrail + human approval + immutable audit is a defensible engineering story — the LLM can *never* set a monetary value.
3. **Enterprise-grade under the hood.** Multi-tenant isolation with row-level security, role-based approvals, API keys with scoped access, CSV import with row-level validation, and an immutable audit trail.
4. **It works end-to-end.** Onboarding → import → monitor → recommend → approve → audit. No placeholders, no fake features.

---

## 7. What We Built

- **Frontend:** React + Vite + Tailwind design system — dashboard, anomaly signals, recommendation engine, approval governance, audit log, reports, scenarios, settings, API integrations.
- **Backend:** a single serverless API gateway with org-scoped data access, RLS on every table, and server-side enforcement of every guardrail.
- **Intelligence:** deterministic reallocation engine, velocity anomaly detection, spend forecasting with backtesting, and LLM explanation (currently Groq-hosted) that is *constrained* to the engine's numbers.
- **Data:** CSV import for budget lines and monthly spend with template, preview, and row-level errors; programmatic REST API with scoped keys.

---

## 8. The Road Ahead

- **Now (pilot):** 3–5 design partners, CSV/manual ingestion, free pilot.
- **Next:** paid plans (target Dec 15, 2026), ERP/FP&A connectors, continuous budget monitoring, notifications.
- **Long-term moat:** a proprietary decision dataset — signal → recommendation → decision → outcome — plus org-specific policies and deep integrations.

> The moat is not the model. It is the **decision history and trust** that no LLM can replicate.

---

## 9. The Pitch (60 seconds)

> "Budgets go stale. When they do, finance teams are stuck deciding where money should move — manually, opaquely, and un-audited.
>
> BudgetIQ closes that gap. We detect spend anomalies, calculate a financially safe reallocation with a deterministic engine, use AI only to explain it, and route the decision through human approval with an immutable audit trail.
>
> AI doesn't move the money. The engine calculates. AI explains. The human decides.
>
> We turn financial signals into explainable, approved budget reallocation decisions."
