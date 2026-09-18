"""
FastAPI app entry point — production-hardened.
"""
import asyncio
import logfire
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import startup_validate, get_settings
from .database import create_tables, check_database_ready
from .api.routes import router
from .seed import seed
from . import monitoring

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":%(message)s}',
)

if os.getenv("LOGFIRE_TOKEN"):
    logfire.configure(token=os.environ["LOGFIRE_TOKEN"], send_to_logfire=True)
else:
    logfire.configure(send_to_logfire=False)

# ---------------------------------------------------------------------------
# Background job worker
# ---------------------------------------------------------------------------

_worker_task: asyncio.Task | None = None


async def _job_worker() -> None:
    from .database import db as raw_db
    from .services.background_jobs import retry_eligible_jobs
    settings = get_settings()
    poll_interval = settings.job_poll_interval
    logger.info("Background job worker started (poll_interval=%ds)", poll_interval)
    while True:
        try:
            count = retry_eligible_jobs(raw_db)
            if count:
                monitoring.increment("budgetiq_jobs_processed_total", {"count": str(count)})
                logger.info("Job worker processed %d jobs", count)
        except Exception as exc:
            logger.error("Job worker error: %s", exc)
            monitoring.increment("budgetiq_jobs_failed_total", {})
        await asyncio.sleep(poll_interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task
    # Startup
    try:
        startup_validate()
    except RuntimeError as exc:
        logger.critical("Startup validation failed: %s", exc)
        raise

    try:
        create_tables()
        seed()
    except Exception:
        logger.exception("Optional database startup tasks failed; API remains live")

    _worker_task = asyncio.create_task(_job_worker())
    logger.info("BudgetIQ API started")

    yield

    # Shutdown
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    logger.info("BudgetIQ API shut down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="BudgetIQ", version="0.1.0", lifespan=lifespan)
logfire.instrument_fastapi(app)

settings = get_settings()
cors_origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*", "X-Request-ID", "X-CSRF-Token"],
    expose_headers=["X-Request-ID"],
)

# ---------------------------------------------------------------------------
# Middleware: request ID, rate limiting, security headers, metrics
# ---------------------------------------------------------------------------

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start = time.monotonic()

    # Rate limiting
    now = start
    window = 60.0
    limit = settings.rate_limit_per_minute
    client = request.client.host if request.client else "unknown"
    bucket = getattr(app.state, "rate_buckets", None)
    if bucket is None:
        bucket = app.state.rate_buckets = defaultdict(deque)
    timestamps = bucket[client]
    while timestamps and now - timestamps[0] > window:
        timestamps.popleft()
    if len(timestamps) >= limit:
        monitoring.increment("budgetiq_rate_limit_exceeded_total", {"client": "ip"})
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    timestamps.append(now)

    # CSRF protection for cookie-based mutations
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        auth_header = request.headers.get("Authorization", "")
        # If no explicit Bearer token is provided, it falls back to cookies (if present).
        if not auth_header.startswith("Bearer "):
            origin = request.headers.get("Origin")
            if origin and origin not in settings.cors_origins and "*" not in settings.cors_origins:
                monitoring.increment("budgetiq_csrf_violation_total", {"client": "ip"})
                return JSONResponse(status_code=403, content={"detail": "Cross-origin mutation denied"})

    response = await call_next(request)
    duration = time.monotonic() - start

    # Metrics
    monitoring.increment(
        "budgetiq_http_requests_total",
        {"method": request.method, "path": request.url.path, "status": str(response.status_code)},
    )
    monitoring.observe(
        "budgetiq_http_request_duration_seconds",
        duration,
        {"method": request.method, "path": request.url.path},
    )

    # Security headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"

    return response

app.include_router(router)


# ---------------------------------------------------------------------------
# Compatibility: keep @app.on_event startup for environments that don't
# support lifespan yet (some test runners). Safe because startup_validate
# is idempotent.
# ---------------------------------------------------------------------------

@app.on_event("startup")
def _legacy_startup():
    pass  # lifespan handles everything; this keeps old test fixtures working
