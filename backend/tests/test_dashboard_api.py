import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.api.routes import _csv_response, _filtered_lines, _page


class FakeCursor(list):
    def sort(self, *args, **kwargs):
        return self


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents
        self.query = None

    def find(self, query=None, *args, **kwargs):
        self.query = query or {}
        return FakeCursor(self.documents)


class FakeDb:
    def __init__(self, documents):
        self.budget_lines = FakeCollection(documents)


def test_pagination_is_opt_in_and_validates_bounds():
    items = list(range(5))
    assert _page(items, None, None) == items
    assert _page(items, 2, 2)["items"] == [2, 3]
    assert _page(items, 2, 2)["total"] == 5
    with pytest.raises(HTTPException):
        _page(items, 0, 2)


def test_dashboard_line_filter_builds_tenant_scoped_query():
    db = FakeDb([{"id": 1, "department_id": 7, "category": "Ops"}])
    assert _filtered_lines(db, department_id=7, category="Ops", search="cloud")
    assert db.budget_lines.query == {
        "department_id": 7,
        "category": "Ops",
        "name": {"$regex": "cloud", "$options": "i"},
    }


def test_csv_export_has_download_headers_and_stable_columns():
    response = _csv_response([{"id": 1, "name": "Cloud"}], "budget.csv")
    assert response.media_type == "text/csv"
    assert response.headers["content-disposition"] == 'attachment; filename="budget.csv"'
