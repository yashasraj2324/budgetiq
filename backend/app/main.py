"""
FastAPI app entry point.
"""
import logfire
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_tables
from .api.routes import router
from .seed import seed

logfire.configure()  # reads LOGFIRE_TOKEN from env; noop if not set

app = FastAPI(title="BudgetIQ", version="0.1.0")
logfire.instrument_fastapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ponytail: lock to frontend origin in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def startup():
    create_tables()
    seed()
