import os
from pymongo import MongoClient
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

    def insert_one(self, document: dict, *args: Any, **kwargs: Any):
        document = dict(document)
        document["organization_id"] = self._organization_id
        return self._collection.insert_one(document, *args, **kwargs)

    def insert_many(self, documents: list[dict], *args: Any, **kwargs: Any):
        documents = [dict(d, organization_id=self._organization_id) for d in documents]
        return self._collection.insert_many(documents, *args, **kwargs)

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

def create_tables():
    """Create optional Mongo indexes without making startup destructive."""
    if os.getenv("MONGO_ENSURE_INDEXES", "false").lower() not in {"1", "true", "yes"}:
        return
    for collection in ("org_config", "departments", "budget_lines", "spend_entries",
                       "performance_scores", "recommendations", "audit_events", "billing",
                       "billing_events", "api_keys", "memberships", "invitations",
                       "approval_policies", "forecasts"):
        db[collection].create_index([("organization_id", 1), ("id", 1)], unique=True)
        db[collection].create_index("organization_id")
    db.spend_entries.create_index("budget_line_id")
    db.recommendations.create_index("status")
    db.audit_events.create_index([("organization_id", 1), ("recommendation_id", 1), ("timestamp", -1)])
    db.billing_events.create_index([("event_id", 1)], unique=True)
    db.api_keys.create_index([("key_hash", 1)], unique=True)
