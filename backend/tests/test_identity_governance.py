import pytest
import os
import sys
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth import AuthContext, generate_api_key, hash_api_key, require_scope
from app.models import ApprovalPolicyIn, ApiKeyCreate, InvitationCreate


def test_api_key_generation_is_random_and_hashable():
    first, first_hash = generate_api_key()
    second, second_hash = generate_api_key()
    assert first.startswith("biq_")
    assert first != second
    assert first_hash == hash_api_key(first)
    assert first_hash != second_hash
    assert first not in first_hash


def test_governance_models_validate_tiers_and_expiry():
    policy = ApprovalPolicyIn(
        tiers=[{"level": 1, "min_amount": 0, "approver_roles": ["CFO"]}],
        dual_sign=True,
        escalation_hours=48,
    )
    assert policy.dual_sign is True
    key = ApiKeyCreate(name="ERP sync", scopes=["budgets:read", "budgets:write"], expires_in_days=30)
    assert key.expires_in_days == 30
    invitation = InvitationCreate(email="user@example.com", role="finance_user")
    assert invitation.email == "user@example.com"


def test_scope_dependency_allows_wildcard_and_rejects_missing_scope():
    allowed = require_scope("budgets:read")(AuthContext("u", "o", "finance_user", "U", "api_key", frozenset({"budgets:read"})))
    assert allowed.user_id == "u"
    with pytest.raises(HTTPException):
        require_scope("budgets:write")(AuthContext("u", "o", "finance_user", "U", "api_key", frozenset({"budgets:read"})))
