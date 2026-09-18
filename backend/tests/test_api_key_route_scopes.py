import os
import sys

import pytest
from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth import AuthContext, _required_scope_for_request, require_auth  # noqa: E402


def _request(path: str, method: str = "GET", api_key: str | None = None) -> Request:
    headers = []
    if api_key is not None:
        headers.append((b"x-api-key", api_key.encode("utf-8")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "headers": headers,
    }
    return Request(scope)


def test_scope_mapping_for_api_paths():
    assert _required_scope_for_request(_request("/api/scenarios", "GET")) == "scenarios:read"
    assert _required_scope_for_request(_request("/api/scenarios", "POST")) == "scenarios:write"
    assert _required_scope_for_request(_request("/api/recommendations/1/approve", "POST")) == "approvals:write"
    assert _required_scope_for_request(_request("/api/reports/budget-lines.csv", "GET")) == "reports:read"


def test_require_auth_rejects_api_key_missing_route_scope(monkeypatch):
    context = AuthContext(
        user_id="key-user",
        organization_id="org-a",
        role="admin",
        display_name="API Key",
        auth_mode="api_key",
        scopes=frozenset({"budgets:read"}),
    )

    monkeypatch.setattr("app.auth._api_key_context", lambda value: context)
    request = _request("/api/scenarios", "POST", api_key="k_test")

    with pytest.raises(HTTPException) as error:
        require_auth(credentials=None, request=request)
    assert error.value.status_code == 403
    assert "scenarios:write" in str(error.value.detail)


def test_require_auth_accepts_api_key_with_scope(monkeypatch):
    context = AuthContext(
        user_id="key-user",
        organization_id="org-a",
        role="admin",
        display_name="API Key",
        auth_mode="api_key",
        scopes=frozenset({"scenarios:write"}),
    )

    monkeypatch.setattr("app.auth._api_key_context", lambda value: context)
    request = _request("/api/scenarios", "POST", api_key="k_test")

    resolved = require_auth(credentials=None, request=request)
    assert resolved.organization_id == "org-a"
