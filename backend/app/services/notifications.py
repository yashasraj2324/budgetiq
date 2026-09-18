"""Email notifications for approval events.

Sends via SMTP when configured; logs to stdout when unconfigured.
Non-blocking — always called via FastAPI BackgroundTasks.
Idempotent — deduplicates by (rec_id, event_type, recipient).
"""
from __future__ import annotations

import hashlib
import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

logger = logging.getLogger(__name__)


def _notification_key(rec_id: int | str, event_type: str, recipient: str) -> str:
    raw = f"{rec_id}|{event_type}|{recipient}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _already_sent(db: Any, key: str) -> bool:
    return bool(db["_notification_log"].find_one({"key": key}))


def _mark_sent(db: Any, key: str, metadata: dict) -> None:
    try:
        db["_notification_log"].insert_one({
            "key": key,
            "sent_at": datetime.now(timezone.utc),
            **metadata,
        })
    except Exception:
        pass  # duplicate key from race is fine


def _send_smtp(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    recipient: str,
    subject: str,
    body: str,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = recipient
    msg.attach(MIMEText(body, "plain"))
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            if smtp_port != 25:
                server.starttls(context=context)
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, recipient, msg.as_string())
    except Exception as exc:
        logger.error("SMTP delivery failed to %s: %s", recipient, exc)
        raise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

EVENT_SUBJECTS = {
    "approval_requested": "Action required: Budget reallocation pending your approval",
    "approved": "Budget reallocation approved",
    "modified": "Budget reallocation approved with modifications",
    "rejected": "Budget reallocation rejected",
    "escalation_warning": "Escalation: Budget reallocation approval overdue",
    "expired": "Approval expired: Budget reallocation requires attention",
}


def send_approval_notification(
    *,
    raw_db: Any,
    event_type: str,
    rec: dict,
    recipients: list[str],
    org_config: dict | None = None,
    extra: dict | None = None,
) -> None:
    """Send an approval notification. Safe to call from BackgroundTasks.

    ``raw_db`` must be the raw (non-tenant-scoped) MongoDB database so that
    the notification log is accessible across organizations.
    """
    from .config import get_settings  # type: ignore[import]

    try:
        from ..config import get_settings as _gs
        settings = _gs()
    except Exception:
        settings = None  # type: ignore[assignment]

    rec_id = rec.get("id", "unknown")
    org_name = (org_config or {}).get("org_name", "BudgetIQ")
    subject = EVENT_SUBJECTS.get(event_type, f"BudgetIQ: {event_type}")
    amount = rec.get("amount", 0)
    body = (
        f"Organisation: {org_name}\n"
        f"Event: {event_type}\n"
        f"Recommendation #{rec_id}\n"
        f"Amount: {amount}\n"
        f"Status: {rec.get('approval_state', rec.get('status', ''))}\n"
        + (f"\n{extra}" if extra else "")
    )

    smtp_host = settings.smtp_host if settings else ""

    for recipient in recipients:
        key = _notification_key(rec_id, event_type, recipient)
        if _already_sent(raw_db, key):
            logger.debug("Notification already sent: key=%s", key)
            continue

        if smtp_host:
            try:
                _send_smtp(
                    smtp_host=smtp_host,
                    smtp_port=settings.smtp_port,
                    smtp_user=settings.smtp_user,
                    smtp_password=settings.smtp_password,
                    smtp_from=settings.smtp_from,
                    recipient=recipient,
                    subject=subject,
                    body=body,
                )
                logger.info(
                    "Notification sent event=%s rec_id=%s recipient=%s",
                    event_type,
                    rec_id,
                    recipient,
                )
            except Exception as exc:
                logger.error("Notification failed: %s", exc)
                continue
        else:
            logger.info(
                "[NOTIFICATION] event=%s rec_id=%s recipient=%s subject=%s "
                "(SMTP not configured — logged only)",
                event_type,
                rec_id,
                recipient,
                subject,
            )

        _mark_sent(raw_db, key, {"event_type": event_type, "rec_id": rec_id, "recipient": recipient})
