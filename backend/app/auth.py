"""Authentication and tenant context for the API.

The local development mode is deliberately explicit: callers still need a
configured bearer token and every request receives one organization context.
Production uses the same dependency with a Supabase-compatible HS256 JWT.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import time
import secrets
from dataclasses import dataclass
from fastapi import Request

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


APPROVER_ROLES = frozenset(
    {"admin", "CFO", "VP Finance", "Finance Manager", "Controller"}
)
ADMIN_ROLES = frozenset({"admin", "CFO", "VP Finance"})
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    organization_id: str
    role: str
    display_name: str
    auth_mode: str
    scopes: frozenset[str] = frozenset({"*"})


def _setting(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _decode_segment(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _jwt_context(token: str) -> AuthContext:
    secret = _setting("SUPABASE_JWT_SECRET") or _setting("AUTH_JWT_SECRET")
    if not secret:
        raise HTTPException(503, "Authentication is not configured")
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(401, "Invalid access token")
    try:
        header = json.loads(_decode_segment(parts[0]))
        claims = json.loads(_decode_segment(parts[1]))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError, binascii.Error, TypeError):
        raise HTTPException(401, "Invalid access token")
    if header.get("alg") != "HS256":
        raise HTTPException(401, "Unsupported access token algorithm")
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{parts[0]}.{parts[1]}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected, _decode_segment(parts[2])):
        raise HTTPException(401, "Invalid access token")
    if claims.get("exp") is not None and float(claims["exp"]) <= time.time():
        raise HTTPException(401, "Access token expired")
    configured_audience = _setting("AUTH_JWT_AUDIENCE")
    if configured_audience and claims.get("aud") != configured_audience:
        raise HTTPException(401, "Invalid access token audience")
    metadata = claims.get("app_metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    user_id = str(claims.get("sub") or "")
    organization_id = str(
        claims.get("organization_id")
        or claims.get("org_id")
        or metadata.get("organization_id")
        or ""
    )
    if not user_id or not organization_id:
        raise HTTPException(403, "Access token has no organization membership")
    role = str(
        claims.get("role")
        or metadata.get("role")
        or "finance_user"
    )
    return AuthContext(
        user_id=user_id,
        organization_id=organization_id,
        role=role,
        display_name=str(claims.get("name") or claims.get("email") or user_id),
        auth_mode="jwt",
        scopes=frozenset(claims.get("scope", "").split()) if claims.get("scope") else frozenset({"*"}),
    )


def hash_api_key(value: str) -> str:
    """Store only a digest; the clear-text key is returned exactly once."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_api_key(prefix: str = "biq") -> tuple[str, str]:
    raw = f"{prefix}_{secrets.token_urlsafe(32)}"
    return raw, hash_api_key(raw)


def _api_key_context(value: str) -> AuthContext | None:
    from .database import db
    record = db.api_keys.find_one({"key_hash": hash_api_key(value), "revoked_at": None})
    if not record:
        return None
    expires = record.get("expires_at")
    if expires:
        if hasattr(expires, "timestamp"):
            if expires.timestamp() <= time.time():
                return None
        elif float(expires) <= time.time():
            return None
    scopes = frozenset(record.get("scopes") or [])
    return AuthContext(
        user_id=str(record.get("created_by", "api-key")),
        organization_id=str(record["organization_id"]),
        role=str(record.get("role", "finance_user")),
        display_name=str(record.get("name", "API key")),
        auth_mode="api_key",
        scopes=scopes,
    )


def _dev_context(token: str | None) -> AuthContext:
    if _setting("BUDGETIQ_ENV", "development").lower() == "production":
        raise HTTPException(503, "Production authentication must use JWT")
    expected = _setting("BUDGETIQ_DEV_AUTH_TOKEN", "local-dev-token")
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(401, "Bearer authentication required")
    organization_id = _setting("BUDGETIQ_DEV_ORGANIZATION_ID", "local-demo")
    if not organization_id:
        raise HTTPException(503, "Development organization is not configured")
    return AuthContext(
        user_id=_setting("BUDGETIQ_DEV_USER_ID", "local-developer"),
        organization_id=organization_id,
        role=_setting("BUDGETIQ_DEV_ROLE", "VP Finance"),
        display_name=_setting("BUDGETIQ_DEV_DISPLAY_NAME", "Local Developer"),
        auth_mode="dev",
    )


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    request: Request = None,
) -> AuthContext:
    if request is not None:
        api_key = request.headers.get("X-API-Key")
        if api_key:
            context = _api_key_context(api_key)
            if context:
                return context
            raise HTTPException(401, "Invalid or revoked API key")
    mode = _setting(
        "BUDGETIQ_AUTH_MODE",
        "jwt" if _setting("BUDGETIQ_ENV", "development").lower() == "production" else "dev",
    ).lower()
    if mode == "dev":
        return _dev_context(credentials.credentials if credentials else None)
    if mode in {"jwt", "supabase"}:
        token = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else None
        if not token and request is not None:
            token = request.cookies.get("sb-access-token") or request.cookies.get("supabase-auth-token")
        if not token:
            raise HTTPException(401, "Bearer authentication required")
        return _jwt_context(token)
    raise HTTPException(503, "Unsupported authentication mode")


def require_approver(user: AuthContext = Depends(require_auth)) -> AuthContext:
    if user.role not in APPROVER_ROLES:
        raise HTTPException(403, "Finance approver role required")
    return user


def require_admin(user: AuthContext = Depends(require_auth)) -> AuthContext:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(403, "Organization administrator role required")
    return user


def require_scope(scope: str):
    def dependency(user: AuthContext = Depends(require_auth)) -> AuthContext:
        if "*" not in user.scopes and scope not in user.scopes:
            raise HTTPException(403, f"API key scope '{scope}' required")
        return user
    return dependency
