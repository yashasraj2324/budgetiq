from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_DOWN
import csv
import io
import os
import secrets
from math import ceil
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Request, Header
from fastapi.responses import StreamingResponse
from pymongo.database import Database

from ..database import get_db
from ..auth import AuthContext, require_admin, require_approver, generate_api_key, hash_api_key, require_auth
from ..models import (
    AuditEventOut, BudgetLineIn, BudgetLineUpdate, BudgetLineOut, BudgetLineDetailOut, DashboardOut, DepartmentOut,
    AnomalyOut, GenerateRequest, ApproveRequest, ModifyRequest, RejectRequest,
    RecommendationOut, RecommendationStatus, SpendEntryOut, PerformanceScoreOut,
    PolicyUpdateRequest, OnboardingDataRequest, OnboardingPrioritiesRequest,
    OnboardingPoliciesRequest, MembershipOut, MembershipUpdate, InvitationCreate, InvitationOut,
    ApprovalPolicyIn, ApprovalPolicyOut, ApiKeyCreate, ApiKeyOut, KNOWN_ACTORS, PageOut,
    OrganizationConfigOut, OrganizationConfigUpdate, ForecastOut, ForecastPointOut,
    ForecastBacktestOut, ScenarioIn, ScenarioUpdate, ScenarioOut, ScenarioFilters,
    FiscalCalendarIn, FiscalCalendarOut,
)
from ..services.anomaly import detect_velocity_anomaly
from ..services.engine import GuardrailResult, calculate_transfer, validate_custom_amount
from ..services.explanation import build_reasoning
from ..services.forecast import forecast_spend, forecast_provenance, backtest_forecast, is_insufficient
from ..services.approval_engine import can_approve, can_reject, check_escalation, build_tier_approval_entry, ApprovalState
from ..providers import configured_provider_status
from ..config import get_settings
from ..services.stripe_billing import stripe_request, stripe_get, verify_webhook
from .. import monitoring

router = APIRouter(prefix="/api")

SUPPORTED_ROLES = {"admin", "CFO", "VP Finance", "Finance Manager", "Budget Analyst", "Controller", "finance_user"}


@router.get("/auth/session")
def auth_session(user: AuthContext = Depends(require_auth)):
    """Validate a browser Supabase session without provisioning an account."""
    return {"user_id": user.user_id, "organization_id": user.organization_id,
            "role": user.role, "display_name": user.display_name, "auth_mode": user.auth_mode}


@router.post("/auth/sign-out")
def auth_sign_out():
    """Sign-out is completed by Supabase in the browser; this endpoint is idempotent."""
    return {"signed_out": True}


@router.post("/auth/password-reset")
def password_reset_boundary(email: str):
    """Account recovery boundary; delivery remains owned by Supabase Auth."""
    if not email.strip() or "@" not in email:
        raise HTTPException(422, "A valid email is required")
    return {"accepted": True}


@router.get("/health")
def health():
    """Liveness endpoint that does not require MongoDB."""
    return {"status": "ok", "service": "budgetiq-api"}

@router.get("/health/live")
def health_live():
    return {"status": "ok", "service": "budgetiq-api"}

@router.get("/health/ready")
def health_ready():
    try:
        from ..database import db as raw_db
        raw_db.command("ping")
    except Exception as exc:
        raise HTTPException(503, "database unavailable") from exc
    return {"status": "ready", "service": "budgetiq-api"}

@router.get("/metrics")
def metrics():
    from ..monitoring import metrics_text
    return StreamingResponse(iter([metrics_text()]), media_type="text/plain; version=0.0.4")


@router.get("/providers/status")
def provider_status(db: Database = Depends(get_db)):
    """Report provider boundaries without attempting fake integrations."""
    return {"providers": [status.__dict__ for status in configured_provider_status()]}


@router.get("/billing")
def billing_status(db: Database = Depends(get_db), user: AuthContext = Depends(require_admin)):
    settings = get_settings()
    if not settings.billing_enabled:
        return {
            "status": "deferred",
            "plan": "deferred",
            "customer_id": None,
            "subscription_id": None,
            "message": "Billing deferred for this milestone",
        }
    subscription = db.billing.find_one({"organization_id": user.organization_id}) or {
        "status": "not_configured", "plan": "free", "customer_id": None, "subscription_id": None
    }
    return {key: value for key, value in subscription.items() if key != "_id"}


@router.post("/billing/checkout")
def create_checkout_session(
    success_url: str,
    cancel_url: str,
    user: AuthContext = Depends(require_admin),
    db: Database = Depends(get_db),
):
    if not get_settings().billing_enabled:
        raise HTTPException(503, "Billing deferred for this milestone")
    price_id = os.getenv("STRIPE_PRICE_ID", "").strip()
    if not price_id:
        raise HTTPException(503, "STRIPE_PRICE_ID is not configured")
    existing = db.billing.find_one({})
    customer_id = existing.get("customer_id") if existing else None
    data = {
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "client_reference_id": user.organization_id,
        "metadata[organization_id]": user.organization_id,
        "automatic_tax[enabled]": "true",
        "tax_id_collection[enabled]": "true",
    }
    if customer_id:
        data["customer"] = customer_id
    result = stripe_request("POST", "checkout/sessions", data)
    db.billing.update_one({}, {"$set": {"checkout_session_id": result.get("id"), "status": "checkout_started"}}, upsert=True)
    return {"url": result.get("url"), "session_id": result.get("id")}


@router.post("/billing/portal")
def create_billing_portal(return_url: str, user: AuthContext = Depends(require_admin), db: Database = Depends(get_db)):
    if not get_settings().billing_enabled:
        raise HTTPException(503, "Billing deferred for this milestone")
    billing = db.billing.find_one({})
    if not billing or not billing.get("customer_id"):
        raise HTTPException(409, "No Stripe customer is configured for this organization")
    result = stripe_request("POST", "billing_portal/sessions", {"customer": billing["customer_id"], "return_url": return_url})
    return {"url": result.get("url")}


@router.get("/billing/entitlements")
def billing_entitlements(user: AuthContext = Depends(require_admin), db: Database = Depends(get_db)):
    if not get_settings().billing_enabled:
        return {
            "plan": "deferred",
            "active": False,
            "features": {
                "csv_import": True,
                "recommendations": True,
                "erp_sync": False,
                "dual_sign": False,
            },
            "message": "Billing deferred for this milestone",
        }
    billing = db.billing.find_one({}) or {}
    status = billing.get("status", "not_configured")
    plan = billing.get("plan", "free")
    return {
        "plan": plan,
        "active": status in {"active", "trialing"},
        "features": {
            "csv_import": True,
            "recommendations": status in {"active", "trialing"} or plan == "free",
            "erp_sync": plan in {"growth", "enterprise"} and status in {"active", "trialing"},
            "dual_sign": plan == "enterprise" and status in {"active", "trialing"},
        },
    }


@router.get("/billing/invoices")
def billing_invoices(user: AuthContext = Depends(require_admin), db: Database = Depends(get_db)):
    if not get_settings().billing_enabled:
        return {"data": []}
    billing = db.billing.find_one({})
    if not billing or not billing.get("customer_id"):
        return {"data": []}
    return stripe_get("invoices", {"customer": billing["customer_id"], "limit": "20"})


@router.post("/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(None, alias="Stripe-Signature")):
    if not get_settings().billing_enabled:
        return {"received": True, "handled": False, "deferred": True}
    if not stripe_signature:
        raise HTTPException(400, "Stripe-Signature header is required")
    event = verify_webhook(await request.body(), stripe_signature)
    monitoring.increment("budgetiq_webhook_events_total", {"type": event.get("type", "unknown")})
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})
    metadata = obj.get("metadata", {}) if isinstance(obj, dict) else {}
    organization_id = metadata.get("organization_id") or obj.get("client_reference_id")
    if not organization_id:
        return {"received": True, "handled": False}
    from ..database import db as raw_db
    billing_col = raw_db["billing"]
    events = raw_db["billing_events"]
    if event.get("id") and events.find_one({"event_id": event["id"]}):
        return {"received": True, "handled": True, "duplicate": True}
    if event.get("id"):
        events.insert_one({"event_id": event["id"], "organization_id": organization_id,
                           "event_type": event_type, "received_at": datetime.now(timezone.utc)})
    update = {"last_event_id": event.get("id"), "updated_at": datetime.now(timezone.utc)}
    if event_type == "checkout.session.completed":
        update.update({"status": "active", "customer_id": obj.get("customer"), "subscription_id": obj.get("subscription")})
    elif event_type in {"customer.subscription.updated", "customer.subscription.created"}:
        update.update({"status": obj.get("status"), "subscription_id": obj.get("id"), "customer_id": obj.get("customer")})
    elif event_type == "customer.subscription.deleted":
        update.update({"status": "canceled", "subscription_id": obj.get("id")})
    elif event_type == "invoice.payment_failed":
        update.update({"status": "past_due", "last_invoice_id": obj.get("id")})
        from ..services.background_jobs import enqueue_job
        enqueue_job(
            raw_db, "billing_notification", organization_id,
            payload={"event_type": "payment_failed", "invoice_id": obj.get("id")},
            idempotency_key=f"billing_notify_{event.get('id', '')}",
        )
    elif event_type == "invoice.paid":
        update.update({"status": "active", "last_invoice_id": obj.get("id")})
    elif event_type == "customer.subscription.trial_will_end":
        from ..services.background_jobs import enqueue_job
        enqueue_job(
            raw_db, "billing_notification", organization_id,
            payload={"event_type": "trial_will_end", "trial_end": obj.get("trial_end")},
            idempotency_key=f"trial_end_{event.get('id', '')}",
        )
        return {"received": True, "handled": True}
    else:
        return {"received": True, "handled": False}
    billing_col.update_one(
        {"organization_id": organization_id},
        {"$set": update, "$setOnInsert": {"organization_id": organization_id}},
        upsert=True,
    )
    return {"received": True, "handled": True}

# ---------------------------------------------------------------------------`n# Helpers
# ---------------------------------------------------------------------------

def get_next_id(db: Database, coll: str) -> int:
    last = db[coll].find_one(sort=[("id", -1)])
    return (last["id"] + 1) if last else 1


def _money(value: object) -> Decimal:
    try:
        result = Decimal(str(value or 0))
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid monetary value in budget data")
    if not result.is_finite():
        raise HTTPException(422, "Monetary values must be finite")
    return result


def _live_remaining(db: Database, line: dict) -> Decimal:
    """Recalculate remaining budget from spend and completed transfers.

    The persisted ``remaining_budget`` field is retained for compatibility with
    the original Mongo schema, but approvals must also be reflected in reads.
    """
    entries = list(db.spend_entries.find({"budget_line_id": line["id"]}))
    actual = sum((_money(e.get("amount_spent")) for e in entries), Decimal("0"))
    completed = {"status": {"$in": ["approved", "modified"]}}
    outgoing_total = sum(
        _money(rec.get("amount"))
        for rec in db.recommendations.find({**completed, "source_line_id": line["id"]})
    )
    incoming_total = sum(
        _money(rec.get("amount"))
        for rec in db.recommendations.find({**completed, "target_line_id": line["id"]})
    )
    return _money(line.get("allocated_amount")) - actual - outgoing_total + incoming_total


def _validate_actor(actor: str, user: AuthContext) -> str:
    """Use the authenticated identity, never a client-supplied actor field."""
    if user.role not in KNOWN_ACTORS and user.role not in {"admin", "CFO", "VP Finance", "Finance Manager", "Controller"}:
        raise HTTPException(
            403,
            f"Role '{user.role}' is not permitted to change recommendation state",
        )
    return user.display_name


def _persisted_amount(value: Decimal) -> float:
    """Mongo's legacy adapter stores money as numeric doubles at the boundary."""
    # Never round a transfer up beyond a guardrail.
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_DOWN))


def _reserve_source(db: Database, line_id: int, amount: Decimal) -> bool:
    """Atomically reserve source budget; this is the negative-budget guard."""
    result = db.budget_lines.update_one(
        {"id": line_id, "remaining_budget": {"$gte": _persisted_amount(amount)}},
        {"$inc": {"remaining_budget": -_persisted_amount(amount)}},
    )
    return result.modified_count == 1


def _credit_target(db: Database, line_id: int, amount: Decimal) -> bool:
    result = db.budget_lines.update_one(
        {"id": line_id},
        {"$inc": {"remaining_budget": _persisted_amount(amount)}},
    )
    return result.modified_count == 1


def _rollback_transition(
    db: Database,
    rec_id: int,
    source_id: int,
    target_id: int,
    amount: Decimal,
    status: str,
    previous_amount: Decimal | None = None,
) -> None:
    db.budget_lines.update_one(
        {"id": source_id},
        {"$inc": {"remaining_budget": _persisted_amount(amount)}},
    )
    db.budget_lines.update_one(
        {"id": target_id},
        {"$inc": {"remaining_budget": -_persisted_amount(amount)}},
    )
    fields: dict[str, object] = {
        "status": RecommendationStatus.pending.value,
        "approved_at": None,
    }
    if previous_amount is not None:
        fields["amount"] = _persisted_amount(previous_amount)
    db.recommendations.update_one({"id": rec_id, "status": status}, {"$set": fields})


def _audit_metadata(
    user: AuthContext,
    *,
    previous_source: Decimal,
    new_source: Decimal,
    previous_target: Decimal,
    new_target: Decimal,
    **extra: object,
) -> dict[str, object]:
    return {
        "actor_user_id": user.user_id,
        "actor_role": user.role,
        "previous_source_budget": _persisted_amount(previous_source),
        "new_source_budget": _persisted_amount(new_source),
        "previous_target_budget": _persisted_amount(previous_target),
        "new_target_budget": _persisted_amount(new_target),
        **extra,
    }


def _record_setup_audit(db: Database, user: AuthContext, action: str, **metadata: object) -> None:
    """Record onboarding/setup mutations using the same tenant-scoped audit store."""
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": None,
        "action": action,
        "actor": user.display_name,
        "event_metadata": {"actor_user_id": user.user_id, "actor_role": user.role, **metadata},
        "timestamp": datetime.now(timezone.utc),
    })


def _governance_audit(db: Database, user: AuthContext, action: str, **metadata: object) -> None:
    _record_setup_audit(db, user, action, **metadata)


@router.get("/organization/members", response_model=list[MembershipOut])
def list_members(db: Database = Depends(get_db), user: AuthContext = Depends(require_auth)):
    return [MembershipOut(**dict(m, user_id=str(m.get("user_id", "")))) for m in db.memberships.find({"status": "active"})]


@router.patch("/organization/members/{member_id}", response_model=MembershipOut)
def update_member(member_id: str, req: MembershipUpdate, db: Database = Depends(get_db),
                  user: AuthContext = Depends(require_admin)):
    if req.role not in SUPPORTED_ROLES:
        raise HTTPException(422, "Unsupported organization role")
    member = db.memberships.find_one({"user_id": member_id, "status": "active"})
    if not member:
        raise HTTPException(404, "Organization member not found")
    db.memberships.update_one({"user_id": member_id}, {"$set": {"role": req.role}})
    _governance_audit(db, user, "membership_role_update", member_id=member_id, role=req.role)
    member["role"] = req.role
    return MembershipOut(**dict(member, user_id=str(member.get("user_id", ""))))


@router.post("/organization/invitations", status_code=201)
def create_invitation(req: InvitationCreate, db: Database = Depends(get_db),
                      user: AuthContext = Depends(require_admin)):
    if req.role not in SUPPORTED_ROLES:
        raise HTTPException(422, "Unsupported organization role")
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    invitation = {"id": get_next_id(db, "invitations"), "email": req.email.strip().lower(),
                  "role": req.role, "token_hash": hash_api_key(token),
                  "expires_at": now.timestamp() + req.expires_in_days * 86400,
                  "created_at": now, "created_by": user.user_id, "status": "pending"}
    db.invitations.insert_one(invitation)
    _governance_audit(db, user, "invitation_created", email=invitation["email"], role=req.role)
    return {"id": invitation["id"], "email": invitation["email"], "role": req.role,
            "expires_at": invitation["expires_at"], "token": token}


@router.post("/organization/invitations/{token}/accept")
def accept_invitation(token: str, user: AuthContext = Depends(require_auth), db: Database = Depends(get_db)):
    invitation = db.invitations.find_one({"token_hash": hash_api_key(token), "status": "pending"})
    if not invitation or float(invitation["expires_at"]) <= datetime.now(timezone.utc).timestamp():
        raise HTTPException(404, "Invitation is invalid or expired")
    db.memberships.update_one({"user_id": user.user_id}, {"$set": {
        "user_id": user.user_id, "email": invitation["email"], "role": invitation["role"],
        "status": "active", "created_at": datetime.now(timezone.utc)}}, upsert=True)
    db.invitations.update_one({"id": invitation["id"]}, {"$set": {"status": "accepted", "accepted_by": user.user_id}})
    return {"accepted": True, "organization_id": user.organization_id, "role": invitation["role"]}


@router.get("/governance/approval-policy", response_model=ApprovalPolicyOut)
def get_approval_policy(db: Database = Depends(get_db), user: AuthContext = Depends(require_auth)):
    policy = db.approval_policies.find_one({}) or {
        "organization_id": user.organization_id, "tiers": [{"level": 1, "min_amount": 0, "approver_roles": ["admin", "CFO", "VP Finance", "Finance Manager", "Controller"]}],
        "escalation_hours": 24, "delegated_approvers": [], "dual_sign": False,
        "updated_at": datetime.now(timezone.utc)}
    return ApprovalPolicyOut(**policy)


@router.put("/governance/approval-policy", response_model=ApprovalPolicyOut)
def set_approval_policy(req: ApprovalPolicyIn, db: Database = Depends(get_db),
                         user: AuthContext = Depends(require_admin)):
    if any(role not in SUPPORTED_ROLES for tier in req.tiers for role in tier.approver_roles):
        raise HTTPException(422, "Unsupported approver role")
    now = datetime.now(timezone.utc)
    policy = {"organization_id": user.organization_id, **req.model_dump(), "updated_at": now}
    db.approval_policies.update_one({}, {"$set": policy}, upsert=True)
    _governance_audit(db, user, "approval_policy_updated", dual_sign=req.dual_sign, tier_count=len(req.tiers))
    return ApprovalPolicyOut(**policy)


@router.post("/api-keys", response_model=ApiKeyOut, status_code=201)
def create_api_key(req: ApiKeyCreate, db: Database = Depends(get_db),
                   user: AuthContext = Depends(require_admin)):
    # Scope validation is performed by ApiKeyCreate.validate_scopes Pydantic validator
    raw, digest = generate_api_key()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=req.expires_in_days) if req.expires_in_days else None
    item = {"id": get_next_id(db, "api_keys"), "name": req.name.strip(),
            "scopes": sorted(set(req.scopes)), "key_hash": digest, "created_by": user.user_id,
            "role": user.role, "organization_id": user.organization_id, "created_at": now,
            "expires_at": expires, "revoked_at": None}
    db.api_keys.insert_one(item)
    _governance_audit(db, user, "api_key_created", api_key_id=item["id"], scopes=item["scopes"])
    status = "active"
    return ApiKeyOut(**{k: item.get(k) for k in ("id", "name", "scopes", "expires_at", "revoked_at", "created_at")}, key=raw, status=status)


@router.get("/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(db: Database = Depends(get_db), user: AuthContext = Depends(require_admin)):
    return [ApiKeyOut(**{k: item.get(k) for k in ("id", "name", "scopes", "expires_at", "revoked_at", "created_at")})
            for item in db.api_keys.find()]


@router.post("/api-keys/{key_id}/rotate", response_model=ApiKeyOut)
def rotate_api_key(key_id: int, db: Database = Depends(get_db), user: AuthContext = Depends(require_admin)):
    old = db.api_keys.find_one({"id": key_id})
    if not old:
        raise HTTPException(404, "API key not found")
    db.api_keys.update_one({"id": key_id}, {"$set": {"revoked_at": datetime.now(timezone.utc)}})
    return create_api_key(ApiKeyCreate(name=old["name"], scopes=old.get("scopes", [])), db, user)


@router.delete("/api-keys/{key_id}", status_code=204)
def revoke_api_key(key_id: int, db: Database = Depends(get_db), user: AuthContext = Depends(require_admin)):
    if db.api_keys.update_one({"id": key_id, "revoked_at": None}, {"$set": {"revoked_at": datetime.now(timezone.utc)}}).modified_count != 1:
        raise HTTPException(404, "API key not found")


def _page(items: list, page: int | None, page_size: int | None, total: int | None = None):
    """Opt-in pagination: legacy callers still receive the original list shape."""
    if page is None and page_size is None:
        return items
    page = 1 if page is None else page
    page_size = 50 if page_size is None else page_size
    if page < 1 or page_size < 1 or page_size > 500:
        raise HTTPException(422, "page must be >= 1 and page_size must be between 1 and 500")
    total = len(items) if total is None else total
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "page": page, "page_size": page_size,
            "total": total, "pages": ceil(total / page_size) if total else 0}


def _filtered_lines(db: Database, department_id: int | None = None,
                    category: str | None = None, search: str | None = None) -> list[dict]:
    query: dict[str, object] = {}
    if department_id is not None:
        query["department_id"] = department_id
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    return list(db.budget_lines.find(query))


def _line_detail(db: Database, line: dict) -> dict:
    line = dict(line)
    line["remaining_budget"] = _live_remaining(db, line)
    entries = list(db.spend_entries.find({"budget_line_id": line["id"]}).sort("period", 1))
    scores = list(db.performance_scores.find({"budget_line_id": line["id"]}).sort("period", -1))
    anomaly = detect_velocity_anomaly([e["amount_spent"] for e in entries]) if entries else None
    dept = db.departments.find_one({"id": line.get("department_id")})
    anomaly_out = None
    if anomaly and anomaly.detected:
        anomaly_out = AnomalyOut(
            budget_line_id=line["id"], budget_line_name=line.get("name", ""),
            department_name=dept.get("name", "") if dept else "",
            velocity_multiplier=anomaly.velocity_multiplier, recent_rate=anomaly.recent_rate,
            baseline_rate=anomaly.baseline_rate, period_remaining=anomaly.period_remaining)
    line["department_name"] = dept.get("name", "") if dept else ""
    line["spend_entries"] = entries
    line["performance_scores"] = scores
    line["anomaly"] = anomaly_out
    return line


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    department_id: int | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    scenario: str | None = Query(None),
    page: int | None = Query(None),
    page_size: int | None = Query(None),
    db: Database = Depends(get_db),
):
    depts = list(db.departments.find())
    all_lines = _filtered_lines(db, department_id, category, search)

    # Recalculate remaining from live spend for all lines
    for line in all_lines:
        line["remaining_budget"] = _live_remaining(db, line)
    active_scenario = scenario or (category if category in {"over-allocated", "variance"} else None)
    if active_scenario == "over-allocated":
        all_lines = [line for line in all_lines if line["remaining_budget"] < 0]
    elif active_scenario == "variance":
        all_lines = [line for line in all_lines if line.get("allocated_amount") and
                     abs((line["allocated_amount"] - line["remaining_budget"]) / line["allocated_amount"] - 1) > 0.05]
    paged = _page(all_lines, page, page_size)
    visible_lines = paged["items"] if isinstance(paged, dict) else paged

    total_budget = sum((_money(l.get("allocated_amount")) for l in all_lines), Decimal("0"))
    total_remaining = sum((_money(l.get("remaining_budget")) for l in all_lines), Decimal("0"))
    reallocatable = sum(
        (
            max(
                Decimal("0"),
                _money(l.get("remaining_budget"))
                - _money(l.get("necessary_future_spend"))
                - _money(l.get("safety_reserve")),
            )
            for l in all_lines
        ),
        Decimal("0"),
    )
    pending_recs = db.recommendations.count_documents({"status": "pending"})

    anomaly_count = 0
    for line in all_lines:
        entries = list(db.spend_entries.find({"budget_line_id": line["id"]}).sort("period", 1))
        if entries and detect_velocity_anomaly([e["amount_spent"] for e in entries]).detected:
            anomaly_count += 1

    dept_outs = []
    for d in depts:
        d_lines = [l for l in visible_lines if l.get("department_id") == d["id"]]
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
        budget_lines=[BudgetLineOut(**line) for line in visible_lines],
        pagination=PageOut(**paged) if isinstance(paged, dict) else None,
        scenario=active_scenario,
    )


# ---------------------------------------------------------------------------
# Budget Lines, Departments, Performance Scores (missing endpoints)
# ---------------------------------------------------------------------------

@router.get("/budget-lines")
def list_budget_lines(
    department_id: int | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    page: int | None = Query(None),
    page_size: int | None = Query(None),
    db: Database = Depends(get_db),
):
    lines = _filtered_lines(db, department_id, category, search)
    for line in lines:
        line["remaining_budget"] = _live_remaining(db, line)
    result = [BudgetLineOut(**l) for l in lines]
    return _page(result, page, page_size)


@router.get("/budget-lines/{line_id}", response_model=BudgetLineDetailOut)
def get_budget_line(line_id: int, db: Database = Depends(get_db)):
    line = db.budget_lines.find_one({"id": line_id})
    if not line:
        raise HTTPException(404, "Budget line not found")
    return BudgetLineDetailOut(**_line_detail(db, line))


@router.post("/budget-lines", response_model=BudgetLineOut, status_code=201)
def create_budget_line(
    req: BudgetLineIn, db: Database = Depends(get_db),
    user: AuthContext = Depends(require_admin),
):
    """F1 — manual budget line ingestion."""
    dept = db.departments.find_one({"id": req.department_id})
    if not dept:
        raise HTTPException(404, f"Department {req.department_id} not found")
    if db.budget_lines.find_one({"department_id": req.department_id, "name": req.name.strip()}):
        raise HTTPException(409, "Budget line already exists in this department")
    new_id = get_next_id(db, "budget_lines")
    line = {
        "id": new_id,
        "department_id": req.department_id,
        "name": req.name.strip(),
        "allocated_amount": _persisted_amount(req.allocated_amount),
        "remaining_budget": _persisted_amount(req.allocated_amount),
        "priority_weight": req.priority_weight,
        "category": req.category,
        "necessary_future_spend": _persisted_amount(req.necessary_future_spend),
        "safety_reserve": _persisted_amount(req.safety_reserve),
        "policy_maximum_transfer": _persisted_amount(req.policy_maximum_transfer),
    }
    db.budget_lines.insert_one(line)
    _record_setup_audit(db, user, "budget_line_create", budget_line_id=new_id)
    return BudgetLineOut(**line)


@router.patch("/budget-lines/{line_id}", response_model=BudgetLineOut)
def update_budget_line(
    line_id: int, req: BudgetLineUpdate, db: Database = Depends(get_db),
    user: AuthContext = Depends(require_admin),
):
    line = db.budget_lines.find_one({"id": line_id})
    if not line:
        raise HTTPException(404, "Budget line not found")
    updates = req.model_dump(exclude_none=True)
    for field in ("name", "category"):
        if field in updates:
            updates[field] = updates[field].strip()
    if "allocated_amount" in updates:
        amount = _persisted_amount(updates["allocated_amount"])
        committed = _money(line["allocated_amount"]) - _live_remaining(db, line)
        if _money(amount) < committed:
            raise HTTPException(422, "allocated_amount cannot be below committed spend")
        updates["allocated_amount"] = amount
    for field in ("necessary_future_spend", "safety_reserve", "policy_maximum_transfer"):
        if field in updates:
            updates[field] = _persisted_amount(updates[field])
    db.budget_lines.update_one({"id": line_id}, {"$set": updates})
    line.update(updates)
    line["remaining_budget"] = _live_remaining(db, line)
    _record_setup_audit(db, user, "budget_line_update", budget_line_id=line_id, fields=list(updates))
    return BudgetLineOut(**line)


@router.delete("/budget-lines/{line_id}", status_code=204)
def delete_budget_line(
    line_id: int, db: Database = Depends(get_db), user: AuthContext = Depends(require_admin),
):
    line = db.budget_lines.find_one({"id": line_id})
    if not line:
        raise HTTPException(404, "Budget line not found")
    if db.spend_entries.count_documents({"budget_line_id": line_id}) or db.recommendations.count_documents({
        "$or": [{"source_line_id": line_id}, {"target_line_id": line_id}],
    }):
        raise HTTPException(409, "Budget line has spend or recommendations and cannot be deleted")
    if db.budget_lines.delete_one({"id": line_id}).deleted_count != 1:
        raise HTTPException(409, "Budget line was changed")
    _record_setup_audit(db, user, "budget_line_delete", budget_line_id=line_id)


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
    if req.source_line_id == req.target_line_id:
        raise HTTPException(422, "Source and target budget lines must be different")
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
        target_funding_gap=max(
            Decimal("0"),
            _money(target.get("allocated_amount")) - _money(target["remaining_budget"]),
        ),
        policy_maximum=source.get("policy_maximum_transfer", 0.0),
    )
    if guardrails.transfer <= 0:
        raise HTTPException(422, f"No transferable surplus (capped by: {guardrails.capped_by})")

    entries = list(db.spend_entries.find({"budget_line_id": source["id"]}).sort("period", 1))
    anomaly = detect_velocity_anomaly([e["amount_spent"] for e in entries])

    transfer = _persisted_amount(guardrails.transfer)
    reasoning = build_reasoning(
        source_name=source.get("name", "Unknown"),
        source_priority=source.get("priority_weight", 50),
        velocity_multiplier=anomaly.velocity_multiplier,
        target_name=target.get("name", "Unknown"),
        target_priority=target.get("priority_weight", 50),
        transfer=transfer,
        capped_by=guardrails.capped_by,
    )

    # FR-012: Validate reasoning output — verify line names + required fields present
    if (
        reasoning.validated_transfer is not None
        and _money(reasoning.validated_transfer) != _money(transfer)
    ):
        raise HTTPException(502, "Reasoning explanation disagreed with deterministic transfer")
    reasoning.validated_transfer = _money(transfer)
    src_name = source.get("name", "").lower()
    tgt_name = target.get("name", "").lower()
    rec_text = reasoning.recommendation.lower()
    if src_name not in rec_text and tgt_name not in rec_text:
        reasoning.recommendation += f" [Validated: {source['name']} → {target['name']}, ₹{guardrails.transfer:,.0f}]"
    if not reasoning.reasoning_steps or len(reasoning.reasoning_steps) < 1:
        raise HTTPException(500, "Reasoning missing reasoning_steps — generation failed")
    if not reasoning.rejection_consequence:
        raise HTTPException(500, "Reasoning missing rejection_consequence — generation failed")
    if f"{guardrails.transfer:,.0f}" not in reasoning.recommendation and str(int(guardrails.transfer)) not in reasoning.recommendation:
        reasoning.recommendation += f" [Validated Transfer: ₹{guardrails.transfer:,.0f}]"

    rec = {
        "id": get_next_id(db, "recommendations"),
        "source_line_id": source["id"],
        "target_line_id": target["id"],
        "amount": transfer,
        "rationale_json": reasoning.model_dump(),
        "status": RecommendationStatus.pending.value,
        "confidence": reasoning.confidence,
        "created_at": datetime.now(timezone.utc),
        "approved_at": None
    }
    db.recommendations.insert_one(rec)
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — list / get
# ---------------------------------------------------------------------------

@router.get("/recommendations")
def list_recommendations(
    status: RecommendationStatus | None = Query(None),
    page: int | None = Query(None),
    page_size: int | None = Query(None),
    db: Database = Depends(get_db),
):
    query = {"status": status.value} if status else {}
    recs = list(db.recommendations.find(query).sort("id", -1))
    return _page([RecommendationOut(**r) for r in recs], page, page_size)


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
def approve(
    rec_id: int,
    req: ApproveRequest,
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_approver),
):
    actor = _validate_actor(req.actor, user)
    rec = _get_pending(rec_id, db)

    # Enforce approval state machine
    policy = db.approval_policies.find_one({}) or {}
    decision = can_approve(rec, policy, user.user_id, user.role, user.display_name)
    if not decision.allowed:
        monitoring.increment("budgetiq_approval_transitions_total", {"action": "approve", "outcome": "denied"})
        raise HTTPException(403, decision.reason)

    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})
    if not source or not target:
        raise HTTPException(409, "Recommendation references a missing budget line")

    prev_src = _live_remaining(db, source)
    prev_tgt = _live_remaining(db, target)
    amount = _money(rec.get("amount"))

    next_state = decision.next_state
    app_time = datetime.now(timezone.utc)

    # Only move money when fully approved
    if next_state in (ApprovalState.approved, ApprovalState.modified):
        if prev_src < amount:
            raise HTTPException(422, f"Approval would make source budget negative (remaining: ₹{prev_src:,.2f}, amount: ₹{amount:,.2f})")

    tier_entry = build_tier_approval_entry(decision.required_tier, user.user_id, user.role, user.display_name, "approve")
    history_entry = {"from_state": rec.get("approval_state", "pending"), "to_state": next_state.value,
                     "actor_user_id": user.user_id, "actor_role": user.role,
                     "actor_display_name": user.display_name, "timestamp": app_time, "reason": ""}

    final_status = RecommendationStatus.approved.value if next_state == ApprovalState.approved else rec.get("status", "pending")
    claimed = db.recommendations.update_one(
        {"id": rec_id, "status": {"$in": [RecommendationStatus.pending.value, "awaiting_tier_2", "awaiting_dual_sign"]}},
        {"$set": {"status": final_status, "approval_state": next_state.value,
                  "approved_at": app_time if next_state == ApprovalState.approved else None},
         "$push": {"tier_approvals": tier_entry, "approval_history": history_entry}},
    )
    if claimed.modified_count != 1:
        raise HTTPException(409, "Recommendation was already changed")

    if next_state == ApprovalState.approved:
        if not _reserve_source(db, source["id"], amount):
            db.recommendations.update_one(
                {"id": rec_id, "approval_state": next_state.value},
                {"$set": {"status": RecommendationStatus.pending.value, "approval_state": ApprovalState.pending.value, "approved_at": None}},
            )
            raise HTTPException(422, "Approval would make source budget negative")
        if not _credit_target(db, target["id"], amount):
            db.budget_lines.update_one({"id": source["id"]}, {"$inc": {"remaining_budget": _persisted_amount(amount)}})
            db.recommendations.update_one(
                {"id": rec_id, "approval_state": next_state.value},
                {"$set": {"status": RecommendationStatus.pending.value, "approval_state": ApprovalState.pending.value, "approved_at": None}},
            )
            raise HTTPException(409, "Unable to reserve target budget")

    monitoring.increment("budgetiq_approval_transitions_total", {"action": "approve", "outcome": next_state.value})
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": f"approve_tier_{decision.required_tier}",
        "actor": actor,
        "event_metadata": _audit_metadata(
            user,
            previous_source=prev_src,
            new_source=prev_src - amount if next_state == ApprovalState.approved else prev_src,
            previous_target=prev_tgt,
            new_target=prev_tgt + amount if next_state == ApprovalState.approved else prev_tgt,
            amount=_persisted_amount(amount),
            next_state=next_state.value,
        ),
        "timestamp": app_time,
    })
    rec.update({"status": final_status, "approval_state": next_state.value, "approved_at": app_time if next_state == ApprovalState.approved else None})
    rec.setdefault("tier_approvals", [])
    rec.setdefault("approval_history", [])
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — modify
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/modify", response_model=RecommendationOut)
def modify(
    rec_id: int,
    req: ModifyRequest,
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_approver),
):
    actor = _validate_actor(req.actor, user)
    rec = _get_pending(rec_id, db)
    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})
    if not source or not target:
        raise HTTPException(409, "Recommendation references a missing budget line")

    # FIX: use live remaining
    source["remaining_budget"] = _live_remaining(db, source)
    target["remaining_budget"] = _live_remaining(db, target)

    guardrails = calculate_transfer(
        remaining_budget=source["remaining_budget"],
        necessary_future_spend=source.get("necessary_future_spend", 0.0),
        safety_reserve=source.get("safety_reserve", 0.0),
        target_funding_gap=max(
            Decimal("0"),
            _money(target.get("allocated_amount")) - _money(target["remaining_budget"]),
        ),
        policy_maximum=source.get("policy_maximum_transfer", 0.0),
    )
    # FR-019: verify raw remaining won't go negative after modify
    requested_amount = _money(req.amount)
    if source["remaining_budget"] - requested_amount < 0:
        raise HTTPException(422, f"Amount would make source budget negative (remaining: ₹{source['remaining_budget']:,.2f})")

    error = validate_custom_amount(
        requested_amount, guardrails.source_surplus,
        guardrails.target_funding_gap, source.get("policy_maximum_transfer", 0.0),
    )
    if error:
        raise HTTPException(422, error)

    prev_src = source["remaining_budget"]
    prev_tgt = target["remaining_budget"]

    app_time = datetime.now(timezone.utc)
    claimed = db.recommendations.update_one(
        {"id": rec_id, "status": RecommendationStatus.pending.value},
        {"$set": {
            "amount": _persisted_amount(requested_amount),
            "status": RecommendationStatus.modified.value,
            "approved_at": app_time,
        }},
    )
    if claimed.modified_count != 1:
        raise HTTPException(409, "Recommendation was already changed")
    if not _reserve_source(db, source["id"], requested_amount):
        db.recommendations.update_one(
            {"id": rec_id, "status": RecommendationStatus.modified.value},
            {"$set": {
                "amount": _persisted_amount(_money(rec["amount"])),
                "status": RecommendationStatus.pending.value,
                "approved_at": None,
            }},
        )
        raise HTTPException(422, "Modification would make source budget negative")
    if not _credit_target(db, target["id"], requested_amount):
        db.budget_lines.update_one(
            {"id": source["id"]},
            {"$inc": {"remaining_budget": _persisted_amount(requested_amount)}},
        )
        db.recommendations.update_one(
            {"id": rec_id, "status": RecommendationStatus.modified.value},
            {"$set": {
                "amount": _persisted_amount(_money(rec["amount"])),
                "status": RecommendationStatus.pending.value,
                "approved_at": None,
            }},
        )
        raise HTTPException(409, "Unable to reserve target budget")
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": "modify",
        "actor": actor,
        "event_metadata": _audit_metadata(
            user,
            previous_source=prev_src,
            new_source=prev_src - requested_amount,
            previous_target=prev_tgt,
            new_target=prev_tgt + requested_amount,
            original_amount=_persisted_amount(_money(rec["amount"])),
            modified_amount=_persisted_amount(requested_amount),
        ),
        "timestamp": app_time
    })

    rec["amount"] = _persisted_amount(requested_amount)
    rec["status"] = RecommendationStatus.modified.value
    rec["approved_at"] = app_time
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Recommendations — reject
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/reject", response_model=RecommendationOut)
def reject(
    rec_id: int,
    req: RejectRequest,
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_approver),
):
    actor = _validate_actor(req.actor, user)
    rec = _get_pending(rec_id, db)

    # Enforce approval state machine — any authorised approver can reject at any tier
    policy = db.approval_policies.find_one({}) or {}
    decision = can_reject(rec, policy, user.user_id, user.role)
    if not decision.allowed:
        monitoring.increment("budgetiq_approval_transitions_total", {"action": "reject", "outcome": "denied"})
        raise HTTPException(403, decision.reason)

    source = db.budget_lines.find_one({"id": rec["source_line_id"]})
    target = db.budget_lines.find_one({"id": rec["target_line_id"]})
    if not source or not target:
        raise HTTPException(409, "Recommendation references a missing budget line")
    current_src = _live_remaining(db, source)
    current_tgt = _live_remaining(db, target)

    app_time = datetime.now(timezone.utc)
    history_entry = {"from_state": rec.get("approval_state", "pending"), "to_state": ApprovalState.rejected.value,
                     "actor_user_id": user.user_id, "actor_role": user.role,
                     "actor_display_name": user.display_name, "timestamp": app_time, "reason": req.reason}
    claimed = db.recommendations.update_one(
        {"id": rec_id, "status": {"$in": [RecommendationStatus.pending.value, "awaiting_tier_2", "awaiting_dual_sign"]}},
        {"$set": {"status": RecommendationStatus.rejected.value, "approval_state": ApprovalState.rejected.value},
         "$push": {"approval_history": history_entry}},
    )
    if claimed.modified_count != 1:
        raise HTTPException(409, "Recommendation was already changed")
    monitoring.increment("budgetiq_approval_transitions_total", {"action": "reject", "outcome": "rejected"})
    db.audit_events.insert_one({
        "id": get_next_id(db, "audit_events"),
        "recommendation_id": rec_id,
        "action": "reject",
        "actor": actor,
        "event_metadata": _audit_metadata(
            user,
            previous_source=current_src,
            new_source=current_src,
            previous_target=current_tgt,
            new_target=current_tgt,
            reason=req.reason,
            amount=_persisted_amount(_money(rec["amount"])),
        ),
        "timestamp": app_time,
    })
    rec["status"] = RecommendationStatus.rejected.value
    rec["approval_state"] = ApprovalState.rejected.value
    rec.setdefault("tier_approvals", [])
    rec.setdefault("approval_history", [])
    return RecommendationOut(**rec)


# ---------------------------------------------------------------------------
# Policy update (PATCH /budget-lines/{id}/policy)
# ---------------------------------------------------------------------------

@router.patch("/budget-lines/{line_id}/policy", response_model=BudgetLineOut)
def update_policy(
    line_id: int,
    req: PolicyUpdateRequest,
    db: Database = Depends(get_db),
    _admin: AuthContext = Depends(require_admin),
):
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
    _record_setup_audit(db, _admin, "policy_update", budget_line_id=line_id, fields=list(updates))
    return BudgetLineOut(**line)


# ---------------------------------------------------------------------------
# Onboarding — persist workspace setup (#3)
# ---------------------------------------------------------------------------

@router.post("/onboarding/data", status_code=200)
def onboarding_data(
    req: OnboardingDataRequest,
    db: Database = Depends(get_db),
    _admin: AuthContext = Depends(require_admin),
):
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

    _record_setup_audit(db, _admin, "onboarding_data", created=created)
    return {"ok": True, "created": created}


@router.get("/onboarding/config")
def onboarding_config(db: Database = Depends(get_db)):
    """Return the persisted tenant onboarding configuration."""
    return db.org_config.find_one({}) or {}

@router.patch("/onboarding/config", response_model=OrganizationConfigOut)
@router.patch("/organization/config", response_model=OrganizationConfigOut)
def update_organization_config(
    req: OrganizationConfigUpdate,
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_admin),
):
    current = db.org_config.find_one({}) or {}
    updates = req.model_dump(exclude_none=True)
    if "org_name" in updates:
        updates["org_name"] = updates["org_name"].strip()
    if "fiscal_year" in updates:
        updates["fiscal_year"] = updates["fiscal_year"].strip()
    if "currency" in updates:
        updates["currency"] = updates["currency"].strip().upper()
    updates["updated_at"] = datetime.now(timezone.utc)
    db.org_config.update_one({}, {"$set": updates}, upsert=True)
    _record_setup_audit(db, user, "organization_config_update", fields=list(req.model_dump(exclude_none=True)))
    current.update(updates)
    return OrganizationConfigOut(
        org_name=current.get("org_name", ""),
        fiscal_year=current.get("fiscal_year", ""),
        currency=current.get("currency", "INR"),
        updated_at=current.get("updated_at"),
    )


@router.post("/onboarding/priorities", status_code=200)
def onboarding_priorities(
    req: OnboardingPrioritiesRequest,
    db: Database = Depends(get_db),
    _admin: AuthContext = Depends(require_admin),
):
    """Persist priority weight overrides from onboarding step 2."""
    updated = 0
    for item in req.line_priorities:
        result = db.budget_lines.update_one(
            {"name": item.name}, {"$set": {"priority_weight": item.priority_weight}}
        )
        if result.modified_count:
            updated += 1
    _record_setup_audit(db, _admin, "onboarding_priorities", updated=updated)
    return {"ok": True, "updated": updated}


@router.post("/onboarding/policies", status_code=200)
def onboarding_policies(
    req: OnboardingPoliciesRequest,
    db: Database = Depends(get_db),
    _admin: AuthContext = Depends(require_admin),
):
    """Persist policy limits from onboarding step 3."""
    updated = 0
    for item in req.line_policies:
        patch = item.model_dump(exclude={"name"}, exclude_none=True)
        result = db.budget_lines.update_one({"name": item.name}, {"$set": patch})
        if result.modified_count:
            updated += 1
    _record_setup_audit(db, _admin, "onboarding_policies", updated=updated)
    return {"ok": True, "updated": updated}


@router.post("/budget-lines/import", status_code=200)
async def import_budget_lines(
    file: UploadFile = File(...),
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_admin),
):
    """Import validated budget lines from a CSV without crossing tenant scope."""
    if file.content_type not in {None, "text/csv", "application/csv", "text/plain"}:
        raise HTTPException(415, "CSV file required")
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "CSV file must be 5 MB or smaller")
    try:
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    except (UnicodeDecodeError, csv.Error) as exc:
        raise HTTPException(422, f"Invalid CSV: {exc}")
    required = {"department_id", "name", "allocated_amount", "priority_weight", "category"}
    if not rows or not required.issubset(set(rows[0] or {})):
        raise HTTPException(422, f"CSV must include columns: {', '.join(sorted(required))}")
    pending, errors, seen = [], [], set()
    for row_number, row in enumerate(rows, 2):
        try:
            req = BudgetLineIn.model_validate({
                **row,
                "department_id": int(row["department_id"]),
                "priority_weight": int(row["priority_weight"]),
            })
            if not db.departments.find_one({"id": req.department_id}):
                raise ValueError(f"department {req.department_id} not found")
            key = (req.department_id, req.name)
            if key in seen or db.budget_lines.find_one({"department_id": req.department_id, "name": req.name}):
                raise ValueError("duplicate budget line")
            seen.add(key)
            line = req.model_dump()
            line.update(
                allocated_amount=_persisted_amount(req.allocated_amount),
                remaining_budget=_persisted_amount(req.allocated_amount),
            )
            for field in ("necessary_future_spend", "safety_reserve", "policy_maximum_transfer"):
                line[field] = _persisted_amount(line[field])
            pending.append(line)
        except (ValueError, TypeError, KeyError) as exc:
            errors.append({"row": row_number, "error": str(exc)})
    if errors:
        raise HTTPException(422, {"errors": errors})
    for line in pending:
        line["id"] = get_next_id(db, "budget_lines")
        db.budget_lines.insert_one(line)
    _record_setup_audit(db, user, "budget_line_import", created=len(pending), errors=0)
    return {"ok": True, "created": len(pending), "errors": []}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit")
def get_audit(
    recommendation_id: int | None = Query(None),
    page: int | None = Query(None),
    page_size: int | None = Query(None),
    db: Database = Depends(get_db),
):
    query = {"recommendation_id": recommendation_id} if recommendation_id is not None else {}
    events = list(db.audit_events.find(query).sort("timestamp", -1))
    return _page([AuditEventOut(**e) for e in events], page, page_size)


# ---------------------------------------------------------------------------
# Spend velocity (existing)
# ---------------------------------------------------------------------------

@router.get("/budget-lines/{line_id}/spend")
def get_spend_velocity(line_id: int, db: Database = Depends(get_db)):
    if not db.budget_lines.find_one({"id": line_id}):
        raise HTTPException(404, "Budget line not found")
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

@router.get("/budget-lines/{line_id}/forecast", response_model=ForecastOut)
def get_budget_line_forecast(
    line_id: int,
    horizon: int = Query(4, ge=1, le=52),
    db: Database = Depends(get_db),
):
    if not db.budget_lines.find_one({"id": line_id}):
        raise HTTPException(404, "Budget line not found")
    entries = list(db.spend_entries.find({"budget_line_id": line_id}).sort("period", 1))
    points = forecast_spend(entries, horizon)
    return ForecastOut(
        budget_line_id=line_id,
        horizon=horizon,
        points=[ForecastPointOut(period=p["period"], amount=p["amount"], projected=p.get("projected", True),
                                 lower_bound=p.get("lower_bound"), upper_bound=p.get("upper_bound")) for p in points],
    )


def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    stream = io.StringIO()
    if rows:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    else:
        stream.write("")
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/budget-lines.csv")
@router.get("/reports/budget-lines.csv")
@router.get("/budget-lines/export.csv")
@router.get("/dashboard/export.csv")
def export_budget_lines(
    department_id: int | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: Database = Depends(get_db),
):
    """Export the same tenant-scoped, filtered budget data used by the dashboard."""
    rows = []
    for line in _filtered_lines(db, department_id, category, search):
        detail = _line_detail(db, line)
        rows.append({
            "id": detail["id"], "department_id": detail["department_id"],
            "department_name": detail["department_name"], "name": detail["name"],
            "category": detail["category"], "allocated_amount": detail["allocated_amount"],
            "remaining_budget": detail["remaining_budget"],
            "priority_weight": detail["priority_weight"],
            "necessary_future_spend": detail.get("necessary_future_spend", 0),
            "safety_reserve": detail.get("safety_reserve", 0),
            "policy_maximum_transfer": detail.get("policy_maximum_transfer", 0),
        })
    return _csv_response(rows, "budgetiq_budget_lines.csv")


# ---------------------------------------------------------------------------
# Approval state query and escalation (new)
# ---------------------------------------------------------------------------

@router.get("/recommendations/{rec_id}/approval-state")
def get_approval_state(rec_id: int, db: Database = Depends(get_db),
                       user: AuthContext = Depends(require_auth)):
    rec = db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    policy = db.approval_policies.find_one({}) or {}
    escalation = check_escalation(rec, policy)
    return {
        "id": rec_id,
        "approval_state": rec.get("approval_state", rec.get("status", "pending")),
        "status": rec.get("status", "pending"),
        "tier_approvals": rec.get("tier_approvals", []),
        "approval_history": rec.get("approval_history", []),
        "escalation": {"overdue": escalation.overdue, "hours_overdue": escalation.hours_overdue,
                       "escalate_to": escalation.escalate_to} if escalation.overdue else None,
    }


@router.post("/recommendations/{rec_id}/escalate", status_code=200)
def escalate_recommendation(rec_id: int, db: Database = Depends(get_db),
                             user: AuthContext = Depends(require_admin)):
    """Operator-level escalation override — marks recommendation for priority review."""
    rec = db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    from .routes import FINAL_STATES  # noqa: circular guard
    if rec.get("approval_state", rec.get("status")) in {"approved", "rejected", "expired", "cancelled", "modified"}:
        raise HTTPException(409, "Cannot escalate a finalised recommendation")
    now = datetime.now(timezone.utc)
    db.recommendations.update_one({"id": rec_id}, {"$set": {"escalated": True, "escalated_at": now,
                                                              "escalated_by": user.user_id}})
    _record_setup_audit(db, user, "recommendation_escalated", recommendation_id=rec_id)
    return {"escalated": True, "recommendation_id": rec_id}


# ---------------------------------------------------------------------------
# Forecast backtest (new)
# ---------------------------------------------------------------------------

@router.get("/budget-lines/{line_id}/forecast/backtest", response_model=ForecastBacktestOut)
def get_forecast_backtest(
    line_id: int,
    holdout: int = Query(2, ge=1, le=10),
    db: Database = Depends(get_db),
):
    if not db.budget_lines.find_one({"id": line_id}):
        raise HTTPException(404, "Budget line not found")
    entries = list(db.spend_entries.find({"budget_line_id": line_id}).sort("period", 1))
    result = backtest_forecast(entries, holdout)
    if result is None:
        raise HTTPException(422, f"Insufficient data for backtest (need at least {3 + holdout} data points)")
    # Persist governance record
    record = dict(result, budget_line_id=line_id)
    db["forecasts"].insert_one(record)  # type: ignore[attr-defined]
    return ForecastBacktestOut(**result)


# ---------------------------------------------------------------------------
# Saved scenarios (new)
# ---------------------------------------------------------------------------

@router.post("/scenarios", response_model=ScenarioOut, status_code=201)
def create_scenario(req: ScenarioIn, db: Database = Depends(get_db),
                    user: AuthContext = Depends(require_auth)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": get_next_id(db, "scenarios"),
        "name": req.name.strip(),
        "organization_id": user.organization_id,
        "created_by": user.user_id,
        "filters": req.filters.model_dump(),
        "shared": req.shared,
        "created_at": now,
        "updated_at": now,
    }
    db.scenarios.insert_one(doc)
    return ScenarioOut(**doc)


@router.get("/scenarios", response_model=list[ScenarioOut])
def list_scenarios(
    page: int | None = Query(None),
    page_size: int | None = Query(None),
    db: Database = Depends(get_db),
    user: AuthContext = Depends(require_auth),
):
    all_scenarios = [ScenarioOut(**{**s, "filters": ScenarioFilters(**s.get("filters", {}))})
                     for s in db.scenarios.find({})]
    return _page(all_scenarios, page, page_size)


@router.get("/scenarios/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: int, db: Database = Depends(get_db),
                 user: AuthContext = Depends(require_auth)):
    s = db.scenarios.find_one({"id": scenario_id})
    if not s:
        raise HTTPException(404, "Scenario not found")
    return ScenarioOut(**{**s, "filters": ScenarioFilters(**s.get("filters", {}))})


@router.patch("/scenarios/{scenario_id}", response_model=ScenarioOut)
def update_scenario(scenario_id: int, req: ScenarioUpdate, db: Database = Depends(get_db),
                    user: AuthContext = Depends(require_auth)):
    s = db.scenarios.find_one({"id": scenario_id})
    if not s:
        raise HTTPException(404, "Scenario not found")
    if s.get("created_by") != user.user_id and user.role != "admin":
        raise HTTPException(403, "Only the creator or an admin can edit this scenario")
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if req.name is not None:
        updates["name"] = req.name.strip()
    if req.filters is not None:
        updates["filters"] = req.filters.model_dump()
    if req.shared is not None:
        if req.shared and user.role != "admin":
            raise HTTPException(403, "Only admins can share scenarios organisation-wide")
        updates["shared"] = req.shared
    db.scenarios.update_one({"id": scenario_id}, {"$set": updates})
    s.update(updates)
    return ScenarioOut(**{**s, "filters": ScenarioFilters(**s.get("filters", {}))})


@router.delete("/scenarios/{scenario_id}", status_code=204)
def delete_scenario(scenario_id: int, db: Database = Depends(get_db),
                    user: AuthContext = Depends(require_auth)):
    s = db.scenarios.find_one({"id": scenario_id})
    if not s:
        raise HTTPException(404, "Scenario not found")
    if s.get("created_by") != user.user_id and user.role != "admin":
        raise HTTPException(403, "Only the creator or an admin can delete this scenario")
    db.scenarios.delete_one({"id": scenario_id})


@router.post("/scenarios/{scenario_id}/duplicate", response_model=ScenarioOut, status_code=201)
def duplicate_scenario(scenario_id: int, db: Database = Depends(get_db),
                       user: AuthContext = Depends(require_auth)):
    s = db.scenarios.find_one({"id": scenario_id})
    if not s:
        raise HTTPException(404, "Scenario not found")
    now = datetime.now(timezone.utc)
    copy = {**s, "id": get_next_id(db, "scenarios"), "name": s["name"] + " (copy)",
            "created_by": user.user_id, "shared": False, "created_at": now, "updated_at": now}
    copy.pop("_id", None)
    db.scenarios.insert_one(copy)
    return ScenarioOut(**{**copy, "filters": ScenarioFilters(**copy.get("filters", {}))})


@router.post("/scenarios/{scenario_id}/share", status_code=200)
def share_scenario(scenario_id: int, db: Database = Depends(get_db),
                   user: AuthContext = Depends(require_admin)):
    s = db.scenarios.find_one({"id": scenario_id})
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.scenarios.update_one({"id": scenario_id}, {"$set": {"shared": True, "updated_at": datetime.now(timezone.utc)}})
    return {"shared": True, "scenario_id": scenario_id}


# ---------------------------------------------------------------------------
# Fiscal calendar (new)
# ---------------------------------------------------------------------------

@router.get("/organization/fiscal-calendar", response_model=FiscalCalendarOut)
def get_fiscal_calendar(db: Database = Depends(get_db), user: AuthContext = Depends(require_auth)):
    cal = db.fiscal_calendar.find_one({}) or {
        "organization_id": user.organization_id,
        "fiscal_year_start_month": 1,
        "period_type": "quarterly",
        "period_labels": ["Q1", "Q2", "Q3", "Q4"],
    }
    return FiscalCalendarOut(**cal)


@router.put("/organization/fiscal-calendar", response_model=FiscalCalendarOut)
def set_fiscal_calendar(req: FiscalCalendarIn, db: Database = Depends(get_db),
                        user: AuthContext = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    doc = {**req.model_dump(), "organization_id": user.organization_id, "updated_at": now}
    db.fiscal_calendar.update_one({}, {"$set": doc}, upsert=True)
    _record_setup_audit(db, user, "fiscal_calendar_updated", **req.model_dump())
    return FiscalCalendarOut(**doc)


# ---------------------------------------------------------------------------
# Member deactivation and invitation management (new)
# ---------------------------------------------------------------------------

@router.delete("/organization/members/{member_id}", status_code=204)
def deactivate_member(member_id: str, db: Database = Depends(get_db),
                      user: AuthContext = Depends(require_admin)):
    if member_id == user.user_id:
        raise HTTPException(400, "You cannot deactivate your own account")
    result = db.memberships.update_one(
        {"user_id": member_id, "status": "active"},
        {"$set": {"status": "deactivated", "deactivated_at": datetime.now(timezone.utc),
                  "deactivated_by": user.user_id}},
    )
    if result.modified_count != 1:
        raise HTTPException(404, "Active member not found")
    _governance_audit(db, user, "member_deactivated", member_id=member_id)


@router.post("/organization/members/{member_id}/resend-invitation", status_code=200)
def resend_invitation(member_id: str, db: Database = Depends(get_db),
                      user: AuthContext = Depends(require_admin)):
    invitation = db.invitations.find_one({"id": int(member_id)} if member_id.isdigit()
                                          else {"email": member_id, "status": "pending"})
    if not invitation:
        raise HTTPException(404, "Pending invitation not found")
    # Extend expiry and generate new token
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.invitations.update_one(
        {"id": invitation["id"]},
        {"$set": {"token_hash": hash_api_key(token),
                  "expires_at": now.timestamp() + 7 * 86400,
                  "resent_at": now, "resent_by": user.user_id}},
    )
    return {"resent": True, "invitation_id": invitation["id"], "token": token}


@router.get("/organization/invitations", response_model=list[InvitationOut])
def list_invitations(db: Database = Depends(get_db), user: AuthContext = Depends(require_auth)):
    invitations = list(db.invitations.find({"status": "pending"}))
    now_ts = datetime.now(timezone.utc).timestamp()
    result = []
    for inv in invitations:
        status = "pending" if float(inv.get("expires_at", 0)) > now_ts else "expired"
        result.append(InvitationOut(
            id=inv["id"], email=inv.get("email", ""), role=inv.get("role", ""),
            status=status, created_at=inv.get("created_at", datetime.now(timezone.utc)),
            expires_at=datetime.fromtimestamp(float(inv["expires_at"]), tz=timezone.utc) if inv.get("expires_at") else None,
            invited_by=str(inv.get("created_by", "")),
        ))
    return result


@router.delete("/organization/invitations/{invitation_id}", status_code=204)
def cancel_invitation(invitation_id: int, db: Database = Depends(get_db),
                      user: AuthContext = Depends(require_admin)):
    result = db.invitations.update_one(
        {"id": invitation_id, "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc),
                  "cancelled_by": user.user_id}},
    )
    if result.modified_count != 1:
        raise HTTPException(404, "Pending invitation not found")
    _governance_audit(db, user, "invitation_cancelled", invitation_id=invitation_id)
