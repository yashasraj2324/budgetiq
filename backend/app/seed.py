"""
Seed the MongoDB with deterministic demo data matching the PRD narrative:
  - Anomaly on the LOW-priority source line (Marketing → Regional Events, priority 35)
  - Money flows to the HIGH-priority target (Engineering → Platform R&D, priority 88)
  - A third department (Operations) provides variety in the selector UI
"""
import os
from datetime import datetime, timezone
from .database import db
from .models import RecommendationStatus

def seed() -> bool:
    """Insert the demo fixture once, without ever deleting application data.

    Seeding is opt-in because a production database must never receive demo
    records on boot. Even when enabled, a partially populated database is left
    untouched so startup cannot overwrite or mix tenants.
    """
    if os.getenv("BUDGETIQ_SEED_DEMO", "false").lower() not in {"1", "true", "yes"}:
        return False

    collections = ("departments", "budget_lines", "spend_entries",
                   "performance_scores", "recommendations", "audit_events")
    if any(db[name].find_one({}, {"_id": 1}) is not None for name in collections):
        return False

    # Read this at seed time so tests, CLI invocations, and process managers
    # can configure the development tenant after importing this module.
    demo_organization_id = os.getenv("BUDGETIQ_DEV_ORGANIZATION_ID", "local-demo")

    # -------------------------------------------------------------------------
    # Departments
    # -------------------------------------------------------------------------
    d_eng = {"id": 1, "name": "Engineering", "priority_weight": 90}
    d_mkt = {"id": 2, "name": "Marketing",   "priority_weight": 45}
    d_ops = {"id": 3, "name": "Operations",  "priority_weight": 65}
    db.departments.insert_many([{**d, "organization_id": demo_organization_id} for d in [d_eng, d_mkt, d_ops]])

    # -------------------------------------------------------------------------
    # Budget lines
    # -------------------------------------------------------------------------
    # Target: high-priority Engineering line with a funding gap
    l_rnd = {
        "id": 1, "department_id": 1, "name": "Platform R&D",
        "allocated_amount": 8000000.0, "remaining_budget": 1200000.0,
        "priority_weight": 88, "category": "capex",
        "necessary_future_spend": 3000000.0, "safety_reserve": 300000.0,
        "policy_maximum_transfer": 1500000.0,
    }
    # Source: LOW-priority Marketing line with anomalous spend + surplus
    l_events = {
        "id": 2, "department_id": 2, "name": "Regional Events",
        "allocated_amount": 5000000.0, "remaining_budget": 3200000.0,
        "priority_weight": 35, "category": "opex",
        "necessary_future_spend": 800000.0, "safety_reserve": 100000.0,
        "policy_maximum_transfer": 1000000.0,
    }
    # Third line (selector variety)
    l_devops = {
        "id": 3, "department_id": 3, "name": "DevOps Tools",
        "allocated_amount": 3000000.0, "remaining_budget": 1800000.0,
        "priority_weight": 62, "category": "opex",
        "necessary_future_spend": 600000.0, "safety_reserve": 80000.0,
        "policy_maximum_transfer": 500000.0,
    }
    db.budget_lines.insert_many([{**line, "organization_id": demo_organization_id} for line in [l_rnd, l_events, l_devops]])

    # -------------------------------------------------------------------------
    # Spend entries
    # PRD scenario: anomaly spike on the LOW-priority Marketing / Regional Events line (id=2)
    # Engineering Platform R&D (id=1) and DevOps (id=3) are normal
    # -------------------------------------------------------------------------
    entries = []
    # Regional Events — steady then sudden 2.8× spike on week 9 (the anomaly source)
    base_mkt = 250000.0
    for w in range(1, 10):
        spent = base_mkt * 2.8 if w == 9 else base_mkt
        entries.append({
            "id": w, "budget_line_id": 2,
            "period": f"2025-W{w:02d}", "amount_spent": spent,
        })

    # Platform R&D — normal spend
    base_rnd = 380000.0
    for w in range(1, 10):
        entries.append({
            "id": w + 9, "budget_line_id": 1,
            "period": f"2025-W{w:02d}", "amount_spent": base_rnd,
        })

    # DevOps — normal spend
    base_devops = 140000.0
    for w in range(1, 10):
        entries.append({
            "id": w + 18, "budget_line_id": 3,
            "period": f"2025-W{w:02d}", "amount_spent": base_devops,
        })

    db.spend_entries.insert_many([{**entry, "organization_id": demo_organization_id} for entry in entries])

    # -------------------------------------------------------------------------
    # Performance scores
    # -------------------------------------------------------------------------
    db.performance_scores.insert_many([{
        **score, "organization_id": demo_organization_id
    } for score in [
        {"id": 1, "budget_line_id": 1, "period": "2025-Q1", "score": 91.0, "metric_type": "composite"},
        {"id": 2, "budget_line_id": 2, "period": "2025-Q1", "score": 54.0, "metric_type": "composite"},
        {"id": 3, "budget_line_id": 3, "period": "2025-Q1", "score": 78.5, "metric_type": "composite"},
    ]])

    # -------------------------------------------------------------------------
    # Seed recommendation — source: Regional Events (id=2) → target: Platform R&D (id=1)
    # Matches PRD: low-priority anomalous line → high-priority underfunded line
    # -------------------------------------------------------------------------
    db.recommendations.insert_many([
        {
            "organization_id": demo_organization_id,
            "id": 1,
            "source_line_id": 2,
            "target_line_id": 1,
            "amount": 800000.0,
            "rationale_json": {
                "recommendation": (
                    "Transfer ₹8,00,000 from Marketing / Regional Events to Engineering / Platform R&D. "
                    "The Regional Events line shows a 2.8× spend velocity anomaly with low strategic priority (35/100), "
                    "while Platform R&D is underfunded against a high-priority (88/100) roadmap commitment."
                ),
                "reasoning_steps": [
                    {"step": 1, "label": "Anomaly Detection",
                     "detail": "Regional Events spend velocity is 2.8× the baseline in week 9, triggering the threshold breach alert."},
                    {"step": 2, "label": "Priority Scoring",
                     "detail": "Regional Events priority weight is 35/100 vs Platform R&D at 88/100 — a 53-point gap favours reallocation."},
                    {"step": 3, "label": "Surplus Calculation",
                     "detail": "Source surplus = ₹3,200,000 remaining − ₹800,000 future − ₹100,000 reserve = ₹2,300,000 transferable surplus."},
                    {"step": 4, "label": "Funding Gap Analysis",
                     "detail": "Platform R&D allocated ₹80,00,000 with only ₹12,00,000 remaining — funding gap of ₹68,00,000 for committed deliverables."},
                    {"step": 5, "label": "Guardrail Validation",
                     "detail": "Transfer capped at ₹8,00,000 by policy_maximum_transfer on the source line. All three guardrails pass."},
                    {"step": 6, "label": "Confidence Assessment",
                     "detail": "High confidence (0.91): strong anomaly signal, large priority differential, and clean guardrail pass."},
                ],
                "confidence": 0.91,
                "rejection_consequence": (
                    "If rejected, Platform R&D risks a Q2 sprint delay costing an estimated ₹15,00,000 in contractor overruns, "
                    "while Regional Events continues anomalous spend with no intervention."
                ),
            },
            "status": RecommendationStatus.pending.value,
            "confidence": 0.91,
            "created_at": datetime.now(timezone.utc),
            "approved_at": None,
        }
    ])
    return True


if __name__ == "__main__":
    if seed():
        print("MongoDB seeded with corrected PRD scenario.")
    else:
        print("Demo seed skipped (disabled or database is not empty).")
