"""Tests for API key scope enforcement and billing webhook state machine."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from pydantic import ValidationError
from app.models import ApiKeyCreate, ALL_SCOPES


# ---------------------------------------------------------------------------
# API key scope validation (Pydantic model level)
# ---------------------------------------------------------------------------

class TestApiKeyScopeValidation:
    def test_valid_scope_accepted(self):
        key = ApiKeyCreate(name="test", scopes=["budgets:read"])
        assert key.scopes == ["budgets:read"]

    def test_multiple_valid_scopes(self):
        key = ApiKeyCreate(name="test", scopes=["budgets:read", "budgets:write", "reports:read"])
        assert len(key.scopes) == 3

    def test_wildcard_scope_accepted(self):
        key = ApiKeyCreate(name="admin-key", scopes=["*"])
        assert key.scopes == ["*"]

    def test_invalid_scope_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ApiKeyCreate(name="bad-key", scopes=["read"])  # old coarse scope
        assert "Unknown scopes" in str(exc_info.value)

    def test_old_write_scope_rejected(self):
        with pytest.raises(ValidationError):
            ApiKeyCreate(name="bad-key", scopes=["write"])

    def test_old_admin_scope_rejected(self):
        with pytest.raises(ValidationError):
            ApiKeyCreate(name="bad-key", scopes=["admin"])

    def test_all_defined_scopes_are_valid(self):
        for scope in ALL_SCOPES:
            key = ApiKeyCreate(name=f"key-{scope}", scopes=[scope])
            assert scope in key.scopes

    def test_default_scope_is_budgets_read(self):
        key = ApiKeyCreate(name="default-key")
        assert key.scopes == ["budgets:read"]

    def test_empty_scopes_rejected(self):
        """Empty scopes list should fail — no permissions is an error."""
        with pytest.raises(ValidationError):
            ApiKeyCreate(name="no-scopes", scopes=[])

    def test_mixed_valid_invalid_rejected(self):
        with pytest.raises(ValidationError):
            ApiKeyCreate(name="mixed", scopes=["budgets:read", "definitely-not-a-scope"])


# ---------------------------------------------------------------------------
# ALL_SCOPES catalogue completeness
# ---------------------------------------------------------------------------

class TestScopeCatalogue:
    EXPECTED_SCOPES = {
        "budgets:read", "budgets:write",
        "recommendations:read", "recommendations:write",
        "approvals:read", "approvals:write",
        "reports:read",
        "organization:read", "organization:write",
        "billing:read", "billing:write",
        "api_keys:manage",
        "scenarios:read", "scenarios:write",
        "*",
    }

    def test_all_expected_scopes_present(self):
        for scope in self.EXPECTED_SCOPES:
            assert scope in ALL_SCOPES, f"Missing scope: {scope}"

    def test_no_unexpected_scopes(self):
        for scope in ALL_SCOPES:
            assert scope in self.EXPECTED_SCOPES, f"Unexpected scope in catalogue: {scope}"
