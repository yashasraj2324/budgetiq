"""Small Stripe REST adapter with explicit configuration and webhook checks."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(503, f"{name} is not configured")
    return value


def stripe_request(method: str, path: str, data: dict[str, str]) -> dict:
    key = _required("STRIPE_SECRET_KEY")
    request = Request(
        f"https://api.stripe.com/v1/{path.lstrip('/')}",
        data=urlencode(data).encode(),
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode())
    except Exception as exc:
        raise HTTPException(502, f"Stripe request failed: {exc}") from exc


def stripe_get(path: str, query: dict[str, str] | None = None) -> dict:
    key = _required("STRIPE_SECRET_KEY")
    suffix = f"?{urlencode(query)}" if query else ""
    request = Request(
        f"https://api.stripe.com/v1/{path.lstrip('/')}{suffix}",
        method="GET",
        headers={"Authorization": f"Bearer {key}"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode())
    except Exception as exc:
        raise HTTPException(502, f"Stripe request failed: {exc}") from exc


def verify_webhook(payload: bytes, signature: str) -> dict:
    secret = _required("STRIPE_WEBHOOK_SECRET")
    timestamp = next((part[2:] for part in signature.split(",") if part.startswith("t=")), "")
    signatures = [part[3:] for part in signature.split(",") if part.startswith("v1=")]
    if not timestamp or not signatures:
        raise HTTPException(400, "Invalid Stripe signature")
    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(400, "Invalid Stripe signature timestamp") from exc
    if abs(time.time() - timestamp_value) > 300:
        raise HTTPException(400, "Expired Stripe webhook")
    expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, candidate) for candidate in signatures):
        raise HTTPException(400, "Invalid Stripe signature")
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Invalid Stripe payload") from exc
