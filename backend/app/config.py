"""Central configuration and startup validation for BudgetIQ.

Production start-up will raise ``RuntimeError`` if mandatory secrets are absent.
Development mode is explicitly gated and never leaks into production.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    development = "development"
    test = "test"
    staging = "staging"
    production = "production"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def get_environment() -> Environment:
    raw = _env("BUDGETIQ_ENV", "development").lower()
    try:
        return Environment(raw)
    except ValueError:
        logger.warning("Unknown BUDGETIQ_ENV=%r - defaulting to development", raw)
        return Environment.development


def is_production() -> bool:
    return get_environment() == Environment.production


def is_development() -> bool:
    return get_environment() == Environment.development


@dataclass
class Settings:
    # Environment
    env: Environment = field(default_factory=get_environment)

    # Auth
    auth_mode: str = field(default_factory=lambda: _env("BUDGETIQ_AUTH_MODE", "dev"))
    supabase_jwt_secret: str = field(
        default_factory=lambda: _env("SUPABASE_JWT_SECRET") or _env("AUTH_JWT_SECRET")
    )
    jwt_audience: str = field(default_factory=lambda: _env("AUTH_JWT_AUDIENCE"))
    jwt_issuer: str = field(default_factory=lambda: _env("AUTH_JWT_ISSUER"))
    dev_auth_token: str = field(default_factory=lambda: _env("BUDGETIQ_DEV_AUTH_TOKEN"))
    dev_org_id: str = field(default_factory=lambda: _env("BUDGETIQ_DEV_ORGANIZATION_ID"))
    dev_user_id: str = field(default_factory=lambda: _env("BUDGETIQ_DEV_USER_ID"))
    dev_role: str = field(default_factory=lambda: _env("BUDGETIQ_DEV_ROLE"))

    # CSRF
    csrf_secret: str = field(default_factory=lambda: _env("CSRF_SECRET"))

    # MongoDB
    mongo_uri: str = field(
        default_factory=lambda: _env("MONGO_URI", "mongodb://localhost:27017")
    )
    mongo_database: str = field(
        default_factory=lambda: _env("MONGO_DATABASE", "budgetiq")
    )

    # SMTP / notifications
    smtp_host: str = field(default_factory=lambda: _env("SMTP_HOST"))
    smtp_port: int = field(
        default_factory=lambda: int(_env("SMTP_PORT", "587") or "587")
    )
    smtp_user: str = field(default_factory=lambda: _env("SMTP_USER"))
    smtp_password: str = field(default_factory=lambda: _env("SMTP_PASSWORD"))
    smtp_from: str = field(
        default_factory=lambda: _env("SMTP_FROM", "noreply@budgetiq.app")
    )

    # Application
    app_base_url: str = field(
        default_factory=lambda: _env("APP_BASE_URL", "http://localhost:3000")
    )
    cors_origins: list = field(
        default_factory=lambda: [
            o.strip()
            for o in _env(
                "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if o.strip()
        ]
    )
    rate_limit_per_minute: int = field(
        default_factory=lambda: int(
            _env("BUDGETIQ_RATE_LIMIT_PER_MINUTE", "120") or "120"
        )
    )

    # Stripe
    stripe_secret_key: str = field(default_factory=lambda: _env("STRIPE_SECRET_KEY"))
    stripe_webhook_secret: str = field(
        default_factory=lambda: _env("STRIPE_WEBHOOK_SECRET")
    )
    stripe_price_id: str = field(default_factory=lambda: _env("STRIPE_PRICE_ID"))

    # Feature flags
    billing_enabled: bool = field(
        default_factory=lambda: _env("BUDGETIQ_BILLING_ENABLED", "false").lower()
        in {"1", "true", "yes", "on"}
    )

    # Background jobs
    job_poll_interval: int = field(
        default_factory=lambda: int(
            _env("JOB_POLL_INTERVAL_SECONDS", "60") or "60"
        )
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# ---------------------------------------------------------------------------
# Production startup validation
# ---------------------------------------------------------------------------

_REQUIRED_PRODUCTION = [
    (
        "SUPABASE_JWT_SECRET or AUTH_JWT_SECRET",
        lambda s: bool(s.supabase_jwt_secret),
    ),
    (
        "CSRF_SECRET",
        lambda s: bool(s.csrf_secret),
    ),
]

_PRODUCTION_FORBIDDEN = [
    (
        "BUDGETIQ_AUTH_MODE must not be 'dev' in production",
        lambda s: s.auth_mode.lower() != "dev",
    ),
]


def startup_validate() -> None:
    """Fail fast in production when mandatory secrets are missing.

    In development/test this is a no-op (warns instead of raising).
    """
    settings = get_settings()
    env = settings.env

    # Never log secret values - only presence/absence
    logger.info(
        "BudgetIQ starting - environment=%s auth_mode=%s",
        env.value,
        settings.auth_mode,
    )

    if env in (Environment.development, Environment.test):
        if settings.auth_mode.lower() == "dev":
            if not settings.dev_auth_token:
                logger.warning(
                    "BUDGETIQ_DEV_AUTH_TOKEN is not set; development auth will reject all requests"
                )
            if not settings.dev_org_id:
                logger.warning(
                    "BUDGETIQ_DEV_ORGANIZATION_ID is not set; development auth will reject all requests"
                )
        return  # non-production: no hard failures

    # staging / production: enforce required secrets
    missing: list[str] = []
    for label, check in _REQUIRED_PRODUCTION:
        try:
            if not check(settings):
                missing.append(label)
        except Exception:
            missing.append(label)

    forbidden: list[str] = []
    for label, check in _PRODUCTION_FORBIDDEN:
        try:
            if not check(settings):
                forbidden.append(label)
        except Exception:
            forbidden.append(label)

    errors = [f"Missing required secret: {m}" for m in missing] + forbidden
    if errors:
        for err in errors:
            logger.critical("STARTUP VALIDATION FAILED: %s", err)
        raise RuntimeError(
            "BudgetIQ cannot start in %s mode:\n%s"
            % (env.value, "\n".join(f"  - {e}" for e in errors))
        )

    logger.info("Startup validation passed for environment=%s", env.value)
