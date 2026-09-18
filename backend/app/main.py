"""
FastAPI app entry point.
"""
import logfire
import logging
import os
import time
from collections import defaultdict, deque
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import create_tables
from .api.routes import router
from .seed import seed

logger = logging.getLogger(__name__)
if os.getenv("LOGFIRE_TOKEN"):
    logfire.configure(token=os.environ["LOGFIRE_TOKEN"], send_to_logfire=True)
else:
    # Never let Logfire's interactive project setup block a headless server.
    logfire.configure(send_to_logfire=False)

app = FastAPI(title="BudgetIQ", version="0.1.0")
logfire.instrument_fastapi(app)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    now = time.monotonic()
    window = 60.0
    limit = int(os.getenv("BUDGETIQ_RATE_LIMIT_PER_MINUTE", "120"))
    client = request.client.host if request.client else "unknown"
    bucket = getattr(app.state, "rate_buckets", None)
    if bucket is None:
        bucket = app.state.rate_buckets = defaultdict(deque)
    timestamps = bucket[client]
    while timestamps and now - timestamps[0] > window:
        timestamps.popleft()
    if len(timestamps) >= limit:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    timestamps.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api") else response.headers.get("Cache-Control", "public, max-age=60")
    return response

app.include_router(router)


@app.on_event("startup")
def startup():
    # Indexes and demo fixtures are both opt-in. A database outage must not
    # prevent the liveness endpoint from starting the API process.
    try:
        create_tables()
        seed()
    except Exception:
        logger.exception("Optional database startup tasks failed; API remains live")
