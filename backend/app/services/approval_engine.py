"""Approval state machine for BudgetIQ.

Enforces multi-tier approval policies, dual-sign requirements, delegated
approvers, and escalation windows. Every transition is auditable.

States:
    pending           — freshly generated, waiting for first tier approval
    awaiting_tier_2   — tier 1 approved, waiting for tier 2
    awaiting_dual_sign — waiting for second signer (dual-sign policy)
    approved          — fully approved
    modified          — approved with amount change
    rejected          — rejected by any authorised approver
    expired           — escalation deadline exceeded without action
    cancelled         — operator-cancelled before finalisation
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any


class ApprovalState(str, enum.Enum):
    pending = "pending"
    awaiting_tier_2 = "awaiting_tier_2"
    awaiting_dual_sign = "awaiting_dual_sign"
    approved = "approved"
    modified = "modified"
    rejected = "rejected"
    expired = "expired"
    cancelled = "cancelled"


# States that are considered "final" — no further transitions allowed
FINAL_STATES = frozenset({
    ApprovalState.approved,
    ApprovalState.modified,
    ApprovalState.rejected,
    ApprovalState.expired,
    ApprovalState.cancelled,
})

# States where approve / modify can be called
APPROVABLE_STATES = frozenset({
    ApprovalState.pending,
    ApprovalState.awaiting_tier_2,
    ApprovalState.awaiting_dual_sign,
})

# States where reject can be called
REJECTABLE_STATES = frozenset({
    ApprovalState.pending,
    ApprovalState.awaiting_tier_2,
    ApprovalState.awaiting_dual_sign,
})


@dataclass
class TierApproval:
    tier_level: int
    actor_user_id: str
    actor_role: str
    actor_display_name: str
    approved_at: datetime
    action: str = "approve"  # approve | modify | reject


@dataclass
class EscalationResult:
    overdue: bool
    escalate_to: str = ""
    hours_overdue: float = 0.0


@dataclass
class ApprovalDecision:
    allowed: bool
    reason: str
    next_state: ApprovalState | None = None
    required_tier: int = 1


def _get_amount(rec: dict) -> Decimal:
    try:
        return Decimal(str(rec.get("amount") or 0))
    except Exception:
        return Decimal("0")


def _approval_state(rec: dict) -> ApprovalState:
    raw = rec.get("approval_state", rec.get("status", "pending"))
    try:
        return ApprovalState(raw)
    except ValueError:
        # Legacy records that only have status
        status = rec.get("status", "pending")
        mapping = {
            "pending": ApprovalState.pending,
            "approved": ApprovalState.approved,
            "modified": ApprovalState.modified,
            "rejected": ApprovalState.rejected,
        }
        return mapping.get(status, ApprovalState.pending)


def _tier_approvals(rec: dict) -> list[TierApproval]:
    raw = rec.get("tier_approvals") or []
    result = []
    for item in raw:
        try:
            result.append(TierApproval(
                tier_level=int(item["tier_level"]),
                actor_user_id=str(item["actor_user_id"]),
                actor_role=str(item["actor_role"]),
                actor_display_name=str(item.get("actor_display_name", "")),
                approved_at=item["approved_at"] if isinstance(item["approved_at"], datetime)
                            else datetime.fromisoformat(str(item["approved_at"])),
                action=str(item.get("action", "approve")),
            ))
        except (KeyError, ValueError):
            continue
    return result


def _find_applicable_tier(amount: Decimal, policy: dict) -> dict | None:
    """Return the highest tier whose min_amount <= amount, or the lowest tier."""
    tiers = sorted(policy.get("tiers") or [], key=lambda t: float(t.get("min_amount", 0)))
    applicable = [t for t in tiers if Decimal(str(t.get("min_amount", 0))) <= amount]
    return applicable[-1] if applicable else (tiers[0] if tiers else None)


def _actor_in_tier(user_role: str, user_id: str, tier: dict, policy: dict) -> bool:
    """Check if the actor is eligible to approve the given tier."""
    tier_roles = set(tier.get("approver_roles") or [])
    # Direct role match
    if user_role in tier_roles:
        return True
    # Delegated approvers
    delegated = policy.get("delegated_approvers") or []
    if user_id in delegated:
        return True
    return False


def can_approve(rec: dict, policy: dict, user_id: str, user_role: str, user_display: str = "") -> ApprovalDecision:
    """Determine whether this actor can advance the approval.

    Returns an ``ApprovalDecision`` that callers must check before mutating state.
    """
    state = _approval_state(rec)
    amount = _get_amount(rec)
    tier_history = _tier_approvals(rec)

    if state in FINAL_STATES:
        return ApprovalDecision(
            allowed=False,
            reason=f"Recommendation is already {state.value}",
        )
    if state not in APPROVABLE_STATES:
        return ApprovalDecision(allowed=False, reason=f"Cannot approve in state {state.value}")

    tiers = sorted(policy.get("tiers") or [], key=lambda t: float(t.get("min_amount", 0)))
    if not tiers:
        # No policy tiers — any approver role is sufficient
        return ApprovalDecision(allowed=True, reason="", next_state=ApprovalState.approved, required_tier=1)

    # Determine which tier we are currently on
    completed_levels = {t.tier_level for t in tier_history if t.action in ("approve", "modify")}
    current_level = max(completed_levels, default=0) + 1
    max_level = max(t["level"] for t in tiers)

    # Find the tier definition for current_level
    tier_def = next((t for t in tiers if t["level"] == current_level), None)
    if tier_def is None:
        tier_def = tiers[-1]  # use highest if out of range

    if not _actor_in_tier(user_role, user_id, tier_def, policy):
        return ApprovalDecision(
            allowed=False,
            reason=f"Role '{user_role}' is not in the approver roles for tier {current_level}",
            required_tier=current_level,
        )

    # Self-approval guard: cannot be the same person who requested it (same user_id as creator)
    # (we allow same role, but not same user if they were the sole generator)
    # — not enforced here; the request itself came from a different endpoint

    # Dual-sign check: same actor cannot sign twice when dual_sign is active
    dual_sign = policy.get("dual_sign", False)
    if dual_sign and state == ApprovalState.awaiting_dual_sign:
        prior_signers = {t.actor_user_id for t in tier_history}
        if user_id in prior_signers:
            return ApprovalDecision(
                allowed=False,
                reason="Dual-sign requires a different actor for the second signature",
            )
        return ApprovalDecision(
            allowed=True,
            reason="",
            next_state=ApprovalState.approved,
            required_tier=current_level,
        )

    # Determine next state
    if current_level < max_level:
        next_state = ApprovalState.awaiting_tier_2
    elif dual_sign and len(tier_history) < 2:
        next_state = ApprovalState.awaiting_dual_sign
    else:
        next_state = ApprovalState.approved

    return ApprovalDecision(
        allowed=True,
        reason="",
        next_state=next_state,
        required_tier=current_level,
    )


def can_reject(rec: dict, policy: dict, user_id: str, user_role: str) -> ApprovalDecision:
    state = _approval_state(rec)

    if state in FINAL_STATES:
        return ApprovalDecision(allowed=False, reason=f"Recommendation is already {state.value}")
    if state not in REJECTABLE_STATES:
        return ApprovalDecision(allowed=False, reason=f"Cannot reject in state {state.value}")

    tiers = policy.get("tiers") or []
    if not tiers:
        return ApprovalDecision(allowed=True, reason="", next_state=ApprovalState.rejected)

    # Any tier's approver can reject at any stage
    for tier_def in tiers:
        if _actor_in_tier(user_role, user_id, tier_def, policy):
            return ApprovalDecision(allowed=True, reason="", next_state=ApprovalState.rejected)

    return ApprovalDecision(
        allowed=False,
        reason=f"Role '{user_role}' is not authorised to reject this recommendation",
    )


def check_escalation(rec: dict, policy: dict) -> EscalationResult:
    """Check whether a recommendation is overdue for escalation."""
    state = _approval_state(rec)
    if state in FINAL_STATES:
        return EscalationResult(overdue=False)

    escalation_hours = float(policy.get("escalation_hours", 24))
    created_at = rec.get("created_at")
    if not created_at:
        return EscalationResult(overdue=False)

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except ValueError:
            return EscalationResult(overdue=False)

    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    elapsed_hours = (now - created_at).total_seconds() / 3600
    if elapsed_hours > escalation_hours:
        hours_overdue = elapsed_hours - escalation_hours
        # Escalate to the highest-level approver role
        tiers = sorted(policy.get("tiers") or [], key=lambda t: -t.get("level", 1))
        escalate_to = ""
        if tiers:
            roles = tiers[0].get("approver_roles") or []
            escalate_to = roles[0] if roles else ""
        return EscalationResult(overdue=True, escalate_to=escalate_to, hours_overdue=hours_overdue)

    return EscalationResult(overdue=False)


def build_tier_approval_entry(
    tier_level: int,
    user_id: str,
    user_role: str,
    user_display: str,
    action: str = "approve",
) -> dict[str, Any]:
    return {
        "tier_level": tier_level,
        "actor_user_id": user_id,
        "actor_role": user_role,
        "actor_display_name": user_display,
        "approved_at": datetime.now(timezone.utc),
        "action": action,
    }
