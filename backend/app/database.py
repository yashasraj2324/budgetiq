import os
from pymongo import MongoClient, ASCENDING, DESCENDING
from typing import Any

from fastapi import Depends
from .auth import AuthContext, require_auth

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DATABASE = os.getenv("MONGO_DATABASE", "budgetiq")

# MongoClient is intentionally lazy: importing the API must not require a live
# database. The first request that needs MongoDB will surface a connection error
# instead of making the process fail during module import.
client = MongoClient(MONGO_URI, connect=False, serverSelectionTimeoutMS=3000)
db = client[MONGO_DATABASE]


class TenantCollection:
    """Small Mongo collection facade that makes tenant filtering unavoidable."""

    def __init__(self, collection: Any, organization_id: str):
        self._collection = collection
        self._organization_id = organization_id

    def _scope(self, query: dict | None) -> dict:
        return {
            "$and": [
                query or {},
                {"organization_id": self._organization_id},
            ]
        }

    def find(self, query: dict | None = None, *args: Any, **kwargs: Any):
        return self._collection.find(self._scope(query), *args, **kwargs)

    def find_one(self, query: dict | None = None, *args: Any, **kwargs: Any):
        return self._collection.find_one(self._scope(query), *args, **kwargs)

    def count_documents(self, query: dict | None = None, *args: Any, **kwargs: Any):
        return self._collection.count_documents(self._scope(query), *args, **kwargs)

    def update_one(self, query: dict, update: dict, *args: Any, **kwargs: Any):
        update = {key: (dict(value) if isinstance(value, dict) else value) for key, value in update.items()}
        if kwargs.get("upsert") and "$setOnInsert" not in update:
            update["$setOnInsert"] = {"organization_id": self._organization_id}
        elif kwargs.get("upsert"):
            update["$setOnInsert"].setdefault("organization_id", self._organization_id)
        return self._collection.update_one(self._scope(query), update, *args, **kwargs)

    def update_many(self, query: dict, update: dict, *args: Any, **kwargs: Any):
        return self._collection.update_many(self._scope(query), update, *args, **kwargs)

    def insert_one(self, document: dict, *args: Any, **kwargs: Any):
        document = dict(document)
        document["organization_id"] = self._organization_id
        return self._collection.insert_one(document, *args, **kwargs)

    def insert_many(self, documents: list[dict], *args: Any, **kwargs: Any):
        documents = [dict(d, organization_id=self._organization_id) for d in documents]
        return self._collection.insert_many(documents, *args, **kwargs)

    def delete_one(self, query: dict, *args: Any, **kwargs: Any):
        """Delete one document scoped to the authenticated organization."""
        return self._collection.delete_one(self._scope(query), *args, **kwargs)

    def delete_many(self, query: dict, *args: Any, **kwargs: Any):
        return self._collection.delete_many(self._scope(query), *args, **kwargs)

    def aggregate(self, pipeline: list, *args: Any, **kwargs: Any):
        """Run an aggregation, prepending an org-scope match stage."""
        org_match = {"$match": {"organization_id": self._organization_id}}
        scoped_pipeline = [org_match] + list(pipeline)
        return self._collection.aggregate(scoped_pipeline, *args, **kwargs)

    def create_index(self, *args: Any, **kwargs: Any):
        return self._collection.create_index(*args, **kwargs)


class TenantDatabase:
    def __init__(self, raw_db: Any, user: AuthContext):
        self._raw_db = raw_db
        self.user = user

    def __getattr__(self, name: str):
        return TenantCollection(getattr(self._raw_db, name), self.user.organization_id)

    def __getitem__(self, name: str):
        return TenantCollection(self._raw_db[name], self.user.organization_id)


def get_db(user: AuthContext = Depends(require_auth)):
    """Return a database facade scoped to the authenticated organization."""
    return TenantDatabase(db, user)


_TENANT_COLLECTIONS = [
    "org_config", "departments", "budget_lines", "spend_entries",
    "performance_scores", "recommendations", "audit_events", "billing",
    "billing_events", "api_keys", "memberships", "invitations",
    "approval_policies", "forecasts", "scenarios", "jobs",
    "_notification_log", "fiscal_calendar",
]


def create_tables() -> None:
    """Create production-required indexes idempotently.

    Called at startup — always runs in any environment (not opt-in).
    A best-effort try/except in the caller prevents database unavailability
    from breaking liveness, but indexes are always attempted.
    """
    ensure = os.getenv("MONGO_ENSURE_INDEXES", "true").lower() not in {"0", "false", "no"}
    if not ensure:
        return

    for collection in _TENANT_COLLECTIONS:
        try:
            db[collection].create_index(
                [("organization_id", ASCENDING), ("id", ASCENDING)],
                unique=False,
                background=True,
            )
            db[collection].create_index(
                [("organization_id", ASCENDING)], background=True
            )
        except Exception:
            pass  # collection may not exist yet

    # Specific indexes for performance-critical queries
    try:
        db.spend_entries.create_index(
            [("organization_id", ASCENDING), ("budget_line_id", ASCENDING)], background=True
        )
        db.recommendations.create_index(
            [("organization_id", ASCENDING), ("status", ASCENDING)], background=True
        )
        db.recommendations.create_index(
            [("organization_id", ASCENDING), ("approval_state", ASCENDING)], background=True
        )
        db.audit_events.create_index(
            [("organization_id", ASCENDING), ("recommendation_id", ASCENDING), ("timestamp", DESCENDING)],
            background=True,
        )
        db.billing_events.create_index(
            [("event_id", ASCENDING)], unique=True, background=True
        )
        db.api_keys.create_index(
            [("key_hash", ASCENDING)], unique=True, background=True
        )
        db.api_keys.create_index(
            [("organization_id", ASCENDING), ("revoked_at", ASCENDING)], background=True
        )
        db.invitations.create_index(
            [("token_hash", ASCENDING)], background=True
        )
        db.scenarios.create_index(
            [("organization_id", ASCENDING), ("created_by", ASCENDING)], background=True
        )
        db.jobs.create_index(
            [("status", ASCENDING), ("next_retry_at", ASCENDING)], background=True
        )
        db["_notification_log"].create_index(
            [("key", ASCENDING)], unique=True, background=True
        )
    except Exception:
        pass


def check_database_ready() -> bool:
    """Ping MongoDB and return True if reachable, False otherwise."""
    try:
        db.command("ping")
        return True
    except Exception:
        return False
