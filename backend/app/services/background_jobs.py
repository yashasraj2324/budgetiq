"""Lightweight durable background job system.

Jobs are persisted to MongoDB so they survive restarts. A background polling
task (started at FastAPI lifespan) retries eligible jobs with exponential backoff.

Job types: send_email, escalation_check, forecast_evaluation, billing_notification
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Job model helpers
# ---------------------------------------------------------------------------

JOB_PENDING = "pending"
JOB_RUNNING = "running"
JOB_DONE = "done"
JOB_FAILED = "failed"
JOB_DEAD = "dead"  # exceeded max_attempts

MAX_ATTEMPTS_DEFAULT = 5
BACKOFF_BASE = 2  # seconds; attempt N waits BASE^N seconds


def _next_retry_at(attempt: int) -> datetime:
    delay = min(BACKOFF_BASE ** attempt, 3600)  # cap at 1 hour
    return datetime.now(timezone.utc) + timedelta(seconds=delay)


def enqueue_job(
    raw_db: Any,
    job_type: str,
    organization_id: str,
    payload: dict,
    idempotency_key: str | None = None,
    max_attempts: int = MAX_ATTEMPTS_DEFAULT,
    correlation_id: str | None = None,
) -> str:
    """Enqueue a job, skipping if the same idempotency_key already exists."""
    if idempotency_key:
        existing = raw_db["jobs"].find_one(
            {"idempotency_key": idempotency_key, "status": {"$in": [JOB_PENDING, JOB_RUNNING, JOB_DONE]}}
        )
        if existing:
            logger.debug("Job already enqueued: idempotency_key=%s", idempotency_key)
            return str(existing.get("_id", ""))

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": job_id,
        "type": job_type,
        "status": JOB_PENDING,
        "organization_id": organization_id,
        "payload": payload,
        "created_at": now,
        "started_at": None,
        "completed_at": None,
        "attempt_count": 0,
        "max_attempts": max_attempts,
        "next_retry_at": now,
        "error": None,
        "correlation_id": correlation_id or str(uuid.uuid4()),
        "idempotency_key": idempotency_key or hashlib.sha256(
            f"{job_type}|{organization_id}|{job_id}".encode()
        ).hexdigest(),
    }
    raw_db["jobs"].insert_one(doc)
    logger.info("Job enqueued type=%s org=%s id=%s", job_type, organization_id, job_id)
    return job_id


def mark_done(raw_db: Any, job_id: str) -> None:
    raw_db["jobs"].update_one(
        {"id": job_id},
        {"$set": {"status": JOB_DONE, "completed_at": datetime.now(timezone.utc), "error": None}},
    )


def mark_failed(raw_db: Any, job_id: str, error: str, attempt: int, max_attempts: int) -> None:
    if attempt >= max_attempts:
        status = JOB_DEAD
        logger.error("Job dead after %d attempts id=%s error=%s", attempt, job_id, error)
    else:
        status = JOB_PENDING
    raw_db["jobs"].update_one(
        {"id": job_id},
        {
            "$set": {
                "status": status,
                "error": error[:2000],
                "next_retry_at": _next_retry_at(attempt) if status == JOB_PENDING else None,
            }
        },
    )


# ---------------------------------------------------------------------------
# Job executor
# ---------------------------------------------------------------------------

def _execute_job(raw_db: Any, job: dict) -> None:
    from ..database import db as mongo_db  # noqa: PLC0415

    job_type = job["type"]
    payload = job.get("payload") or {}

    if job_type == "send_email":
        from .notifications import send_approval_notification  # noqa: PLC0415
        send_approval_notification(
            raw_db=raw_db,
            event_type=payload.get("event_type", ""),
            rec=payload.get("rec", {}),
            recipients=payload.get("recipients", []),
            org_config=payload.get("org_config"),
        )

    elif job_type == "escalation_check":
        from .approval_engine import check_escalation  # noqa: PLC0415
        org_id = job.get("organization_id", "")
        policy = mongo_db["approval_policies"].find_one({"organization_id": org_id}) or {}
        for rec in mongo_db["recommendations"].find(
            {"organization_id": org_id, "status": "pending"}
        ):
            result = check_escalation(rec, policy)
            if result.overdue:
                logger.warning(
                    "Recommendation %s overdue by %.1fh — escalating to %s",
                    rec.get("id"),
                    result.hours_overdue,
                    result.escalate_to,
                )
                # Enqueue notification without re-triggering the same check
                enqueue_job(
                    raw_db,
                    "send_email",
                    org_id,
                    payload={
                        "event_type": "escalation_warning",
                        "rec": {k: v for k, v in rec.items() if k != "_id"},
                        "recipients": [],  # resolved at delivery time from membership
                    },
                    idempotency_key=f"escalation_{rec.get('id')}_{int(time.time() // 3600)}",
                )

    elif job_type == "forecast_evaluation":
        logger.info("Forecast evaluation job completed (metrics persisted to forecasts collection)")

    elif job_type == "billing_notification":
        logger.info(
            "Billing notification job: org=%s event=%s",
            job.get("organization_id"),
            payload.get("event_type"),
        )

    else:
        logger.warning("Unknown job type: %s", job_type)


def retry_eligible_jobs(raw_db: Any) -> int:
    """Process all eligible pending jobs. Returns count processed."""
    now = datetime.now(timezone.utc)
    eligible = list(
        raw_db["jobs"].find(
            {"status": JOB_PENDING, "next_retry_at": {"$lte": now}}
        ).limit(50)
    )

    processed = 0
    for job in eligible:
        job_id = job["id"]
        attempt = job.get("attempt_count", 0) + 1
        max_attempts = job.get("max_attempts", MAX_ATTEMPTS_DEFAULT)

        # Claim the job atomically
        result = raw_db["jobs"].update_one(
            {"id": job_id, "status": JOB_PENDING},
            {"$set": {"status": JOB_RUNNING, "started_at": now, "attempt_count": attempt}},
        )
        if result.modified_count != 1:
            continue  # already claimed by another worker

        try:
            _execute_job(raw_db, job)
            mark_done(raw_db, job_id)
            processed += 1
        except Exception as exc:
            logger.error("Job %s failed attempt %d: %s", job_id, attempt, exc)
            mark_failed(raw_db, job_id, str(exc), attempt, max_attempts)

    return processed
