from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from ..database import get_db
from ..models import (
    AuditEventOut, BudgetLineIn, BudgetLineOut, DashboardOut, DepartmentOut,
    AnomalyOut, GenerateRequest, ApproveRequest, ModifyRequest, RejectRequest,
    RecommendationOut, RecommendationStatus, SpendEntryOut, PerformanceScoreOut,
    PolicyUpdateRequest, OnboardingDataRequest, OnboardingPrioritiesRequest,
    OnboardingPoliciesRequest, KNOWN_ACTORS
)
from ..services.anomaly import detect_velocity_anomaly
from ..services.engine import GuardrailResult, calculate_transfer, validate_custom_amount
from ..services.qwen import get_reasoning

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_next_id(db: Database, coll: str) -> int:
    last = db[coll].find_one(sort=[("id", -1)])
    return (last["id"] + 1) if last else 1


def _live_remaining(db: Database, line: dict) -> float:
    """Recalculate remaining_budget from actual spend entries (never stale)."""
    entries = list(db.spend_entries.find({"budget_line_id": line["id"]}))
    actual = sum(e["amount_spent"] for e in entries)
    return line.get("allocated_amount", 0.0) - actual


def _validate_actor(actor: str) -> None:
    """FR-003: Reject requests from unknown actor roles."""
    if actor not in KNOWN_ACTORS:
        raise HTTPException(
            403,
            f"Unknown actor '{actor}'. Permitted roles: {', '.join(sorted(KNOWN_ACTORS))}"
        )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Database = Depends(get_db)):
    depts = list(db.departments.find())
    all_lines = list(db.budget_lines.find())

    # Recalculate remaining from live spend for all lines
    for line in all_lines:
        line["remaining_budget"] = _live_remaining(db, line)

    total_budget = sum(l.get("allocated_amount", 0.0) for l in all_lines)
    total_remaining = sum(l.get("remaining_budget", 0.0) for l in all_lines)
    reallocatable = sum(
        max(0.0, l.get("remaining_budget", 0.0) - l.get("necessary_future_spend", 0.0) - l.get("safety_reserve", 0.0))
        for l in all_lines
    )
    pending_recs = db.recommendations.count_documents({"status": "pending"})

    anomaly_count = 0
    for line in all_lines:
        entries = list(db.spend_entries.find({"budget_line_id": line["id"]}).sort("period", 1))
        if entries and detect_velocity_anomaly([e["amount_spent"] for e in entries]).detected:
            anomaly_count += 1

    dept_outs = []
    for d in depts:
        d_lines = [l for l in all_lines if l.get("department_id") == d["id"]]
        dout = DepartmentOut(**d, budget_lines=d_lines)
        dept_outs.append(dout)

    # FIX: return DashboardOut, not dept_outs
    return DashboardOut(
        total_budget=total_budget,
        total_remaining=total_remaining,
        reallocatable=reallocatable,
        pending_recommendations=pending_recs,
        anomaly_count=anomaly_count,
        departments=dept_outs,
    )


# ---------------------------------------------------------------------------
# Budget Lines, Departments, Performance Scores (missing endpoints)
# ---------------------------------------------------------------------------

@router.get("/budget-lines", response_model=list[BudgetLineOut])
def list_budget_lines(db: Database = Depends(get_db)):
    lines = list(db.budget_lines.find())
    for line in lines:
        line["remaining_budget"] = _live_remaining(db, line)
    return [BudgetLineOut(**l) for l in lines]


@router.post("/budget-lines", response_model=BudgetLineOut, status_code=201)
def create_budget_line(req: BudgetLineIn, db: Database = Depends(get_db)):
    """F1 — manual budget line ingestion."""
    dept = db.departments.find_one({"id": req.department_id})
    if not dept:
        raise HTTPException(404, f"Department {req.department_id} not found")
    new_id = get_next_id(db, "budget_lines")
    line = {
        "id": new_id,
        "department_id": req.department_id,
        "name": req.name,
        "allocated_amount": req.allocated_amount,
        "remaining_budget": req.allocated_amount,  # fully unspent on creation
        "priority_weight": req.priority_weight,
        "category": req.category,
        "necessary_future_spend": req.necessary_future_spend,
        "safety_reserve": req.safety_reserve,
        "policy_maximum_transfer": req.policy_maximum_transfer,
    }
    db.budget_lines.insert_one(line)
    return BudgetLineOut(**line)


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Database = Depends(get_db)):
    depts = list(db.departments.find())
    all_lines = list(db.budget_lines.find())
    for line in all_lines:
        line["remaining_budget"] = _live_remaining(db, line)
    result = []
    for d in depts:
        d_lines = [l for l in all_lines if l.get("department_id") == d["id"]]
        result.append(DepartmentOut(**d, budget_lines=d_lines))
    return result


@router.get("/performance-scores", response_model=list[PerformanceScoreOut])
def list_performance_scores(db: Database = Depends(get_db)):
    scores = list(db.performance_scores.find())
    return [PerformanceScoreOut(**s) for s in scores]


# ---------------------------------------------------------------------------
# Anomalies
# ---------------------------------------------------------------------------

@router.get("/anomalies", response_model=list[AnomalyOut])
def get_anomalies(db: Database = Depends(get_db)):
    results = []
    for line in db.budget_lines.find():
        entries = list(db.spend_entries.find({"budget_line_id": line["id"]}).sort("period", 1))
        if not entries:
            continue
        anomaly = detect_velocity_anomaly([e["amount_spent"] for e in entries])
        if anomaly.detected:
            dept = db.departments.find_one({"id": line.get("department_id")})
            results.append(AnomalyOut(
                budget_line_id=line["id"],
                budget_line_name=line.get("name", ""),
                department_name=dept["name"] if dept else "",
                velocity_multiplier=anomaly.velocity_multiplier,
                recent_rate=anomaly.recent_rate,
                baseline_rate=anomaly.baseline_rate,
                period_remaining=anomaly.period_remaining,
            ))
    return results


# ---------------------------------------------------------------------------
# Recommendations — generate
# ---------------------------------------------------------------------------

@router.post("/recommendations/generate", response_model=RecommendationOut)
async def generate_recommendation(req: GenerateRequest, db: Database = Depends(get_db)):
    source = db.budget_lines.find_one({"id": req.source_line_id})
    target = db.budget_lines.find_one({"id": req.target_line_id})
    if not source or not target:
        raise HTTPException(404, "Budget line not found")

    # FIX: use live remaining, not stale DB value
    source["remaining_budget"] = _live_remaining(db, source)
    target["remaining_budget"] = _live_remaining(db, target)

    guardrails = calculate_transfer(
        remaining_budget=source["remaining_budget"],
        necessary_future_spend=source.get("necessary_future_spend", 0.0),
        safety_reserve=source.get("safety_reserve", 0.0),
        target_funding_gap=max(0.0, target.get("allocated_amount", 0.0) - target["remaining_budget"]),
        policy_maximum=source.get("policy_maximum_transfer", 0.0),
    )
    if guardrails.transfer <= 0:
        raise HTTPException(422, f"No transferable surplus (capped by: {guardrails.capped_by})")

    entries = list(db.spend_entries.find({"budget_line_id": source["id"]}).sort("period", 1))
    anomaly = detect_velocity_anomaly([e["amount_spent"] for e in entries])

    src_perf = db.performance_scores.find_one({"budget_line_id": source["id"]}, sort=[("period", -1)])
    tgt_perf = db.performance_scores.find_one({"budget_line_id": target["id"]}, sort=[("period", -1)])

    reasoning = await get_reasoning(
        source_name=source.get("name", "Unknown"),
        source_priority=source.get("priority_weight", 50),
        source_performance=src_perf["score"] if src_perf else 50.0,
        remaining_budget=source["remaining_budget"],
        velocity_multiplier=anomaly.velocity_multiplier,
        target_name=target.get("name", "Unknown"),
        target_priority=target.get("priority_weight", 50),
        target_performance=tgt_perf["score"] if tgt_perf else 50.0,
        target_funding_gap=guardrails.target_funding_gap,
        transfer=guardrails.transfer,
        capped_by=guardrails.capped_by,
    )

    # FR-012: Validate AI output — verify line names + required fields present
    src_name = source.get("name", "").lower()
    tgt_name = target.get("name", "").lower()
    rec_text = reasoning.recommendation.lower()
    if src_name not in rec_text and tgt_name not in rec_text:
        reasoning.recommendation += f" [AI-Validated: {source['name']} → {target['name']}, ₹{guardrails.transfer:,.0f}]"
    if not reasoning.reasoning_steps or len(reasoning.reasoning_steps) < 1:
        raise HTTPException(500, "AI response missing reasoning_steps — generation failed")
    if not reasoning.rejection_consequence:
        raise HTTPException(500, "AI response missing rejection_consequence — generation failed")
    if f"{guardrails.transfer:,.0f}" not in reasoning.recommendation and str(int(guardrails.transfer)) not in reasoning.recommendation:
        reasoning.recommendation += f" [Validated Transfer: ₹{guardrails.transfer:,.0f}]"

    rec = {
        "id": get_next_id(db, "recommendations"),
        "source_line_id": source["id"],
        "target_line_id": target["id"],
        "amount": guardrails.transfer,
        "rationale_json": reasoning.model_dump(),
        "status": RecommendationStatus.pending.value,
        "confidence": reasoning.confidence,
        "created_at": datetime.utcnow(),
        "approved_at": None
    }
    db.recommendations.insert_one(rec)
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — list / get
# ---------------------------------------------------------------------------

@router.get("/recommendations", response_model=list[RecommendationOut])
def list_recommendations(db: Database = Depends(get_db)):
    recs = list(db.recommendations.find().sort("id", -1))
    return [RecommendationOut(**r) for r in recs]


@router.get("/recommendations/{rec_id}", response_model=RecommendationOut)
def get_recommendation(rec_id: int, db: Database = Depends(get_db)):
    rec = db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    return RecommendationOut(**rec)


def _get_pending(rec_id: int, db: Database) -> dict:
    rec = db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    if rec.get("status") != RecommendationStatus.pending.value:
        raise HTTPException(409, f"Recommendation already {rec.get('status')}")
    return rec


# ---------------------------------------------------------------------------
# Recommendations — approve
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/approve", response_model=RecommendationOut)
def approve(rec_id: int, req: ApproveRequest, db: Database = Depends(get_db)):
    _validate_actor(req.actor)
    rec = _get_pending(rec_id, db)
    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})

    prev_src = _live_remaining(db, source)
    prev_tgt = _live_remaining(db, target)

    # FR-019: enforce remaining_budget >= 0 before committing
    if prev_src - rec["amount"] < 0:
        raise HTTPException(422, f"Approval would make source budget negative (remaining: ₹{prev_src:,.0f}, amount: ₹{rec['amount']:,.0f})")

    db.budget_lines.update_one({"id": source["id"]}, {"$inc": {"remaining_budget": -rec["amount"]}})
    db.budget_lines.update_one({"id": target["id"]}, {"$inc": {"remaining_budget": rec["amount"]}})

    app_time = datetime.utcnow()
    db.recommendations.update_one({"id": rec_id}, {"$set": {"status": RecommendationStatus.approved.value, "approved_at": app_time}})

    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": "approve",
        "actor": req.actor,
        "event_metadata": {
            "amount": rec["amount"],
            "previous_source_budget": prev_src,
            "new_source_budget": prev_src - rec["amount"],
            "previous_target_budget": prev_tgt,
            "new_target_budget": prev_tgt + rec["amount"],
        },
        "timestamp": app_time
    })
    rec["status"] = RecommendationStatus.approved.value
    rec["approved_at"] = app_time
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — modify
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/modify", response_model=RecommendationOut)
def modify(rec_id: int, req: ModifyRequest, db: Database = Depends(get_db)):
    _validate_actor(req.actor)
    rec = _get_pending(rec_id, db)
    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})

    # FIX: use live remaining
    source["remaining_budget"] = _live_remaining(db, source)
    target["remaining_budget"] = _live_remaining(db, target)

    guardrails = calculate_transfer(
        remaining_budget=source["remaining_budget"],
        necessary_future_spend=source.get("necessary_future_spend", 0.0),
        safety_reserve=source.get("safety_reserve", 0.0),
        target_funding_gap=max(0.0, target.get("allocated_amount", 0.0) - target["remaining_budget"]),
        policy_maximum=source.get("policy_maximum_transfer", 0.0),
    )
    # FR-019: verify raw remaining won't go negative after modify
    if source["remaining_budget"] - req.amount < 0:
        raise HTTPException(422, f"Amount would make source budget negative (remaining: ₹{source['remaining_budget']:,.0f})")

    error = validate_custom_amount(
        req.amount, guardrails.source_surplus,
        guardrails.target_funding_gap, source.get("policy_maximum_transfer", 0.0),
    )
    if error:
        raise HTTPException(422, error)

    prev_src = source["remaining_budget"]
    prev_tgt = target["remaining_budget"]

    db.budget_lines.update_one({"id": source["id"]}, {"$inc": {"remaining_budget": -req.amount}})
    db.budget_lines.update_one({"id": target["id"]}, {"$inc": {"remaining_budget": req.amount}})

    app_time = datetime.utcnow()
    db.recommendations.update_one({"id": rec_id}, {"$set": {"amount": req.amount, "status": RecommendationStatus.modified.value, "approved_at": app_time}})
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": "modify",
        "actor": req.actor,
        "event_metadata": {
            "original_amount": rec["amount"],
            "modified_amount": req.amount,
            "previous_source_budget": prev_src,
            "new_source_budget": prev_src - req.amount,
            "previous_target_budget": prev_tgt,
            "new_target_budget": prev_tgt + req.amount
        },
        "timestamp": app_time
    })

    rec["amount"] = req.amount
    rec["status"] = RecommendationStatus.modified.value
    rec["approved_at"] = app_time
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — reject
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/reject", response_model=RecommendationOut)
def reject(rec_id: int, req: RejectRequest, db: Database = Depends(get_db)):
    _validate_actor(req.actor)
    rec = _get_pending(rec_id, db)
    # FIX: fetch real budget values even on rejection (no money moves, but audit is truthful)
    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})
    current_src = _live_remaining(db, source)
    current_tgt = _live_remaining(db, target)

    db.recommendations.update_one({"id": rec_id}, {"$set": {"status": RecommendationStatus.rejected.value}})

    app_time = datetime.utcnow()
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": "reject",
        "actor": req.actor,
        "event_metadata": {
            "reason": req.reason,
            # No money moves on reject — new == previous
            "previous_source_budget": current_src,
            "new_source_budget": current_src,
            "previous_target_budget": current_tgt,
            "new_target_budget": current_tgt,
        },
        "timestamp": app_time
    })
    rec["status"] = RecommendationStatus.rejected.value
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Policy update (PATCH /budget-lines/{id}/policy)
# ---------------------------------------------------------------------------

@router.patch("/budget-lines/{line_id}/policy", response_model=BudgetLineOut)
def update_policy(line_id: int, req: PolicyUpdateRequest, db: Database = Depends(get_db)):
    """FR-007: Allow org admins to update policy limits at runtime."""
    line = db.budget_lines.find_one({"id": line_id})
    if not line:
        raise HTTPException(404, "Budget line not found")
    updates: dict = {}
    if req.policy_maximum_transfer is not None:
        if req.policy_maximum_transfer < 0:
            raise HTTPException(422, "policy_maximum_transfer cannot be negative")
        updates["policy_maximum_transfer"] = req.policy_maximum_transfer
    if req.safety_reserve is not None:
        if req.safety_reserve < 0:
            raise HTTPException(422, "safety_reserve cannot be negative")
        updates["safety_reserve"] = req.safety_reserve
    if req.necessary_future_spend is not None:
        if req.necessary_future_spend < 0:
            raise HTTPException(422, "necessary_future_spend cannot be negative")
        updates["necessary_future_spend"] = req.necessary_future_spend
    db.budget_lines.update_one({"id": line_id}, {"$set": updates})
    line.update(updates)
    line["remaining_budget"] = _live_remaining(db, line)
    return BudgetLineOut(**line)


# ---------------------------------------------------------------------------
# Onboarding — persist workspace setup (#3)
# ---------------------------------------------------------------------------

@router.post("/onboarding/data", status_code=200)
def onboarding_data(req: OnboardingDataRequest, db: Database = Depends(get_db)):
    """Persist org config + bulk department/budget-line setup from onboarding step 1."""
    # Upsert org config
    db.org_config.update_one({}, {"$set": {
        "org_name": req.org_name,
        "fiscal_year": req.fiscal_year,
        "currency": req.currency,
    }}, upsert=True)

    created = {"departments": 0, "budget_lines": 0}

    for dept_req in req.departments:
        existing = db.departments.find_one({"name": dept_req.name})
        if not existing:
            new_id = get_next_id(db, "departments")
            db.departments.insert_one({"id": new_id, "name": dept_req.name, "priority_weight": dept_req.priority_weight})
            created["departments"] += 1

    for line_req in req.budget_lines:
        dept = db.departments.find_one({"name": line_req.department_name})
        if not dept:
            continue  # skip lines with no matching dept
        existing = db.budget_lines.find_one({"name": line_req.name, "department_id": dept["id"]})
        if not existing:
            new_id = get_next_id(db, "budget_lines")
            db.budget_lines.insert_one({
                "id": new_id,
                "department_id": dept["id"],
                "name": line_req.name,
                "allocated_amount": line_req.allocated_amount,
                "remaining_budget": line_req.allocated_amount,
                "priority_weight": line_req.priority_weight,
                "category": line_req.category,
                "necessary_future_spend": line_req.necessary_future_spend,
                "safety_reserve": line_req.safety_reserve,
                "policy_maximum_transfer": line_req.policy_maximum_transfer,
            })
            created["budget_lines"] += 1

    return {"ok": True, "created": created}


@router.post("/onboarding/priorities", status_code=200)
def onboarding_priorities(req: OnboardingPrioritiesRequest, db: Database = Depends(get_db)):
    """Persist priority weight overrides from onboarding step 2."""
    updated = 0
    for item in req.line_priorities:
        name = item.get("name")
        weight = item.get("priority_weight")
        if name and weight is not None:
            result = db.budget_lines.update_one({"name": name}, {"$set": {"priority_weight": int(weight)}})
            if result.modified_count:
                updated += 1
    return {"ok": True, "updated": updated}


@router.post("/onboarding/policies", status_code=200)
def onboarding_policies(req: OnboardingPoliciesRequest, db: Database = Depends(get_db)):
    """Persist policy limits from onboarding step 3."""
    updated = 0
    for item in req.line_policies:
        name = item.get("name")
        patch = {k: v for k, v in item.items() if k != "name" and v is not None}
        if name and patch:
            result = db.budget_lines.update_one({"name": name}, {"$set": patch})
            if result.modified_count:
                updated += 1
    return {"ok": True, "updated": updated}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit", response_model=list[AuditEventOut])
def get_audit(db: Database = Depends(get_db)):
    events = list(db.audit_events.find().sort("timestamp", -1))
    return [AuditEventOut(**e) for e in events]


# ---------------------------------------------------------------------------
# Spend velocity (existing)
# ---------------------------------------------------------------------------

@router.get("/budget-lines/{line_id}/spend")
def get_spend_velocity(line_id: int, db: Database = Depends(get_db)):
    entries = list(db.spend_entries.find({"budget_line_id": line_id}).sort("period", 1))

    chart_data = []
    for e in entries:
        period_parts = e["period"].split("-")  # 2025-W01
        name = period_parts[1] if len(period_parts) > 1 else e["period"]
        chart_data.append({
            "name": name,
            "spend": e["amount_spent"],
            "anomaly": e["amount_spent"] > 800000,
            "projected": False
        })

    return chart_data
