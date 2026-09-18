"""Tests for tenant isolation — Org A cannot access Org B's data.

Uses the in-memory mongomock approach (mongomock is optional; falls back to
a simple dictionary-based stub if not installed).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, patch
from app.database import TenantCollection, TenantDatabase
from app.auth import AuthContext


# ---------------------------------------------------------------------------
# TenantCollection unit tests using a mock PyMongo collection
# ---------------------------------------------------------------------------

def _make_collection(docs: list[dict]):
    """Create a mock collection pre-populated with docs."""
    col = MagicMock()
    col.find.side_effect = lambda query, *a, **kw: [d for d in docs if _matches(d, query)]
    col.find_one.side_effect = lambda query, *a, **kw: next(
        (d for d in docs if _matches(d, query)), None
    )
    col.count_documents.side_effect = lambda query, *a, **kw: sum(
        1 for d in docs if _matches(d, query)
    )
    return col


def _matches(doc: dict, query: dict) -> bool:
    """Simplistic query matcher sufficient for $and + equality tests."""
    if "$and" not in query:
        return all(doc.get(k) == v for k, v in query.items())
    for clause in query["$and"]:
        if "$and" in clause:
            if not _matches(doc, clause):
                return False
        else:
            for k, v in clause.items():
                if doc.get(k) != v:
                    return False
    return True


ORG_A_DOCS = [
    {"id": 1, "organization_id": "org-a", "name": "Line A1"},
    {"id": 2, "organization_id": "org-a", "name": "Line A2"},
]
ORG_B_DOCS = [
    {"id": 10, "organization_id": "org-b", "name": "Line B1"},
]
ALL_DOCS = ORG_A_DOCS + ORG_B_DOCS


class TestTenantCollectionIsolation:
    def setup_method(self):
        self.raw_col = _make_collection(ALL_DOCS)
        self.col_a = TenantCollection(self.raw_col, "org-a")
        self.col_b = TenantCollection(self.raw_col, "org-b")

    def test_org_a_cannot_read_org_b_lines(self):
        results = self.col_a.find()
        names = [r["name"] for r in results]
        assert "Line B1" not in names
        assert "Line A1" in names

    def test_org_b_cannot_read_org_a_lines(self):
        results = self.col_b.find()
        names = [r["name"] for r in results]
        assert "Line A1" not in names
        assert "Line B1" in names

    def test_find_one_scoped_to_org(self):
        # Org A looking for id=10 (which belongs to Org B) should return None
        doc = self.col_a.find_one({"id": 10})
        assert doc is None

    def test_count_documents_scoped(self):
        count_a = self.col_a.count_documents({})
        count_b = self.col_b.count_documents({})
        assert count_a == 2
        assert count_b == 1


class TestTenantCollectionInsert:
    def test_insert_always_stamps_org_id(self):
        raw_col = MagicMock()
        inserted = {}

        def capture_insert(doc, *a, **kw):
            inserted.update(doc)

        raw_col.insert_one.side_effect = capture_insert
        col = TenantCollection(raw_col, "org-x")
        col.insert_one({"id": 99, "name": "test"})
        assert inserted.get("organization_id") == "org-x"

    def test_insert_does_not_allow_override_of_org_id(self):
        """A caller cannot override organization_id by passing their own value."""
        raw_col = MagicMock()
        captured = {}

        def capture(doc, *a, **kw):
            captured.update(doc)

        raw_col.insert_one.side_effect = capture
        col = TenantCollection(raw_col, "org-correct")
        col.insert_one({"id": 1, "organization_id": "org-attacker"})
        # The TenantCollection should override with the authenticated org
        assert captured["organization_id"] == "org-correct"


class TestTenantCollectionAggregate:
    def test_aggregate_prepends_org_scope(self):
        raw_col = MagicMock()
        captured_pipeline = []

        def capture_agg(pipeline, *a, **kw):
            captured_pipeline.extend(pipeline)
            return []

        raw_col.aggregate.side_effect = capture_agg
        col = TenantCollection(raw_col, "org-q")
        list(col.aggregate([{"$group": {"_id": "$category"}}]))

        assert captured_pipeline[0] == {"$match": {"organization_id": "org-q"}}
        assert captured_pipeline[1] == {"$group": {"_id": "$category"}}


class TestTenantCollectionDeleteOne:
    def test_delete_scoped_to_org(self):
        raw_col = MagicMock()
        captured_query = {}

        def capture_delete(query, *a, **kw):
            captured_query.update(query)
            return MagicMock(deleted_count=1)

        raw_col.delete_one.side_effect = capture_delete
        col = TenantCollection(raw_col, "org-d")
        col.delete_one({"id": 5})

        # The scoped query must include the organization_id guard
        assert any(
            "organization_id" in str(captured_query) for _ in [1]
        )
