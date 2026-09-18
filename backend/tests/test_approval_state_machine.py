"""Tests for the approval state machine (approval_engine.py).

Runs fully offline — no database, no network.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import datetime, timezone, timedelta
from app.services.approval_engine import (
    can_approve, can_reject, check_escalation,
    ApprovalState, build_tier_approval_entry, FINAL_STATES,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_POLICY_NO_TIERS = {}
_POLICY_SINGLE_TIER = {
    "tiers": [{"level": 1, "min_amount": 0, "approver_roles": ["CFO", "VP Finance"]}],
    "escalation_hours": 24,
    "dual_sign": False,
}
_POLICY_TWO_TIERS = {
    "tiers": [
        {"level": 1, "min_amount": 0, "approver_roles": ["Finance Manager"]},
        {"level": 2, "min_amount": 100_000, "approver_roles": ["CFO"]},
    ],
    "escalation_hours": 24,
    "dual_sign": False,
}
_POLICY_DUAL_SIGN = {
    "tiers": [{"level": 1, "min_amount": 0, "approver_roles": ["CFO", "VP Finance"]}],
    "escalation_hours": 24,
    "dual_sign": True,
}


def _rec(state="pending", amount=500_000, tier_approvals=None, approval_history=None, created_ago_hours=1):
    return {
        "id": 1,
        "status": state,
        "approval_state": state,
        "amount": amount,
        "source_line_id": 10,
        "target_line_id": 20,
        "tier_approvals": tier_approvals or [],
        "approval_history": approval_history or [],
        "created_at": datetime.now(timezone.utc) - timedelta(hours=created_ago_hours),
    }


# ---------------------------------------------------------------------------
# 1. No-policy fast-path
# ---------------------------------------------------------------------------

class TestNoPolicyApproval:
    def test_any_approver_succeeds_with_no_tiers(self):
        d = can_approve(_rec(), _POLICY_NO_TIERS, "u1", "finance_user", "Alice")
        assert d.allowed
        assert d.next_state == ApprovalState.approved

    def test_reject_allowed_with_no_tiers(self):
        d = can_reject(_rec(), _POLICY_NO_TIERS, "u1", "finance_user")
        assert d.allowed
        assert d.next_state == ApprovalState.rejected


# ---------------------------------------------------------------------------
# 2. Single-tier
# ---------------------------------------------------------------------------

class TestSingleTierApproval:
    def test_happy_path(self):
        d = can_approve(_rec(), _POLICY_SINGLE_TIER, "u1", "CFO", "Alice")
        assert d.allowed
        assert d.next_state == ApprovalState.approved

    def test_wrong_role_rejected(self):
        d = can_approve(_rec(), _POLICY_SINGLE_TIER, "u1", "finance_user", "Bob")
        assert not d.allowed
        assert "finance_user" in d.reason

    def test_reject_allowed_by_approver_role(self):
        d = can_reject(_rec(), _POLICY_SINGLE_TIER, "u1", "VP Finance")
        assert d.allowed

    def test_reject_denied_for_wrong_role(self):
        d = can_reject(_rec(), _POLICY_SINGLE_TIER, "u1", "finance_user")
        assert not d.allowed

    def test_finalised_cannot_be_approved_again(self):
        for final_state in ["approved", "rejected", "expired", "cancelled", "modified"]:
            d = can_approve(_rec(state=final_state), _POLICY_SINGLE_TIER, "u1", "CFO", "Alice")
            assert not d.allowed, f"Should not approve from state {final_state}"

    def test_finalised_cannot_be_rejected(self):
        d = can_reject(_rec(state="approved"), _POLICY_SINGLE_TIER, "u1", "CFO")
        assert not d.allowed


# ---------------------------------------------------------------------------
# 3. Two-tier
# ---------------------------------------------------------------------------

class TestTwoTierApproval:
    def test_tier1_advances_to_awaiting_tier2(self):
        d = can_approve(_rec(), _POLICY_TWO_TIERS, "u1", "Finance Manager", "Alice")
        assert d.allowed
        assert d.next_state == ApprovalState.awaiting_tier_2
        assert d.required_tier == 1

    def test_tier2_finishes_after_tier1(self):
        tier_hist = [build_tier_approval_entry(1, "u1", "Finance Manager", "Alice", "approve")]
        rec = _rec(state="awaiting_tier_2", tier_approvals=tier_hist)
        d = can_approve(rec, _POLICY_TWO_TIERS, "u2", "CFO", "Bob")
        assert d.allowed
        assert d.next_state == ApprovalState.approved

    def test_tier2_cannot_skip_tier1(self):
        # No tier history — CFO tries to approve before FM
        d = can_approve(_rec(), _POLICY_TWO_TIERS, "u2", "CFO", "Bob")
        # CFO is not a tier1 approver role so must be rejected
        assert not d.allowed


# ---------------------------------------------------------------------------
# 4. Dual-sign
# ---------------------------------------------------------------------------

class TestDualSign:
    def test_first_signer_moves_to_awaiting_dual_sign(self):
        d = can_approve(_rec(), _POLICY_DUAL_SIGN, "u1", "CFO", "Alice")
        assert d.allowed
        assert d.next_state == ApprovalState.awaiting_dual_sign

    def test_second_different_signer_completes(self):
        tier_hist = [build_tier_approval_entry(1, "u1", "CFO", "Alice", "approve")]
        rec = _rec(state="awaiting_dual_sign", tier_approvals=tier_hist)
        d = can_approve(rec, _POLICY_DUAL_SIGN, "u2", "VP Finance", "Bob")
        assert d.allowed
        assert d.next_state == ApprovalState.approved

    def test_same_signer_cannot_dual_sign(self):
        tier_hist = [build_tier_approval_entry(1, "u1", "CFO", "Alice", "approve")]
        rec = _rec(state="awaiting_dual_sign", tier_approvals=tier_hist)
        d = can_approve(rec, _POLICY_DUAL_SIGN, "u1", "CFO", "Alice")
        assert not d.allowed
        assert "dual" in d.reason.lower() or "different" in d.reason.lower()


# ---------------------------------------------------------------------------
# 5. Escalation
# ---------------------------------------------------------------------------

class TestEscalation:
    def test_not_overdue_when_fresh(self):
        result = check_escalation(_rec(created_ago_hours=1), _POLICY_SINGLE_TIER)
        assert not result.overdue

    def test_overdue_after_deadline(self):
        result = check_escalation(_rec(created_ago_hours=30), _POLICY_SINGLE_TIER)
        assert result.overdue
        assert result.hours_overdue >= 6
        assert result.escalate_to in {"CFO", "VP Finance"}

    def test_no_escalation_for_finalised(self):
        for state in ["approved", "rejected", "cancelled", "expired"]:
            result = check_escalation(_rec(state=state, created_ago_hours=100), _POLICY_SINGLE_TIER)
            assert not result.overdue, f"Should not escalate {state}"

    def test_no_escalation_without_created_at(self):
        rec = _rec()
        rec.pop("created_at")
        result = check_escalation(rec, _POLICY_SINGLE_TIER)
        assert not result.overdue
