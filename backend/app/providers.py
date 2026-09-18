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
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_configured = bool(groq_key) and groq_key.lower() not in {
        "your-groq-key-here",
        "dummy_key_for_testing",
    }

    billing_enabled = os.getenv("BUDGETIQ_BILLING_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
    stripe_configured = all(os.getenv(name, "").strip() for name in (
        "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"
    ))

    if not billing_enabled:
        billing_state = "deferred"
        billing_configured = False
        billing_message = "Stripe billing is deferred for this milestone and does not block core workflows."
    else:
        billing_state = "configured" if stripe_configured else "not_configured"
        billing_configured = stripe_configured
        billing_message = (
            "Stripe Checkout, customer portal, and signed subscription webhooks are available."
            if stripe_configured
            else "Configure Stripe secret, webhook, and price settings."
        )

    return [
        ProviderStatus(
            name="erp",
            state="deferred",
            configured=bool(os.getenv("ERP_PROVIDER")),
            message="Direct ERP connectors are deferred; CSV/manual ingestion is the supported path.",
        ),
        ProviderStatus(
            name="billing",
            state=billing_state,
            configured=billing_configured,
            message=billing_message,
        ),
        ProviderStatus(
            name="explanation",
            state="configured" if groq_configured else "fallback",
            configured=groq_configured,
            message="Groq explains deterministic results; it never sets transfer amounts.",
        ),
    ]
