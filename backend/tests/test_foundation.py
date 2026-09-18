from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import require_auth
from app.database import TenantCollection
from app.api.routes import _persisted_amount, _reserve_source
from app.services.engine import calculate_transfer


class FakeCollection:
    def __init__(self):
        self.last_query = None
        self.documents = []

    def find(self, query, *args, **kwargs):
        self.last_query = query
        return []

    def insert_one(self, document, *args, **kwargs):
        self.documents.append(document)


class FakeUpdateResult:
    modified_count = 1


class FakeBudgetLines:
    def __init__(self):
        self.query = None
        self.update = None

    def update_one(self, query, update):
        self.query = query
        self.update = update
        return FakeUpdateResult()


class FakeBudgetDb:
    def __init__(self):
        self.budget_lines = FakeBudgetLines()


def test_dev_auth_requires_configured_bearer(monkeypatch):
    monkeypatch.setenv("BUDGETIQ_ENV", "development")
    monkeypatch.setenv("BUDGETIQ_AUTH_MODE", "dev")
    monkeypatch.setenv("BUDGETIQ_DEV_AUTH_TOKEN", "test-token")
    monkeypatch.setenv("BUDGETIQ_DEV_ORGANIZATION_ID", "org-a")

    with pytest.raises(HTTPException) as error:
        require_auth(None)
    assert error.value.status_code == 401

    context = require_auth(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
    )
    assert context.organization_id == "org-a"
    assert context.auth_mode == "dev"


def test_tenant_collection_scopes_reads_and_tags_writes():
    raw = FakeCollection()
    collection = TenantCollection(raw, "org-a")
    list(collection.find({"id": 7}))
    assert {"organization_id": "org-a"} in raw.last_query["$and"]
    collection.insert_one({"id": 7, "name": "line"})
    assert raw.documents[0]["organization_id"] == "org-a"


def test_decimal_engine_and_storage_rounding_are_stable():
    result = calculate_transfer(
        Decimal("10.10"), Decimal("0.05"), Decimal("0.05"),
        Decimal("9.999"), Decimal("20"),
    )
    assert result.transfer == Decimal("9.999")
    assert _persisted_amount(result.transfer) == 9.99


def test_source_reservation_is_conditional_and_cannot_go_negative():
    db = FakeBudgetDb()
    assert _reserve_source(db, 4, Decimal("12.34"))
    assert db.budget_lines.query["remaining_budget"] == {"$gte": 12.34}
    assert db.budget_lines.update["$inc"]["remaining_budget"] == -12.34
