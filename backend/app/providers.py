"""Provider status boundaries for integrations."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol


class FinancialDataProvider(Protocol):
    name: str

    async def healthcheck(self) -> bool:
        ...


@dataclass(frozen=True)
class ProviderStatus:
    name: str
    state: str
    configured: bool
    message: str


def configured_provider_status() -> list[ProviderStatus]:
    qwen_key = os.getenv("QWEN_API_KEY", "").strip()
    qwen_configured = bool(qwen_key) and qwen_key.lower() not in {
        "your-qwen-key-here",
        "dummy_key_for_testing",
    }
    stripe_configured = all(os.getenv(name, "").strip() for name in (
        "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"
    ))
    return [
        ProviderStatus(
            name="erp",
            state="not_connected",
            configured=bool(os.getenv("ERP_PROVIDER")),
            message="No ERP adapter is enabled in Slice 1.",
        ),
        ProviderStatus(
            name="billing",
            state="configured" if stripe_configured else "not_configured",
            configured=stripe_configured,
            message="Stripe Checkout, customer portal, and signed subscription webhooks are available." if stripe_configured else "Configure Stripe secret, webhook, and price settings.",
        ),
        ProviderStatus(
            name="explanation",
            state="configured" if qwen_configured else "fallback",
            configured=qwen_configured,
            message="Qwen explains deterministic results; it never sets amounts.",
        ),
    ]
