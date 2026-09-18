from decimal import Decimal
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.models import OrganizationConfigUpdate
from app.services.forecast import forecast_spend


def test_forecast_preserves_actuals_and_projects_bounded_weeks():
    points = forecast_spend(
        [{"period": "2026-W01", "amount_spent": Decimal("100")},
         {"period": "2026-W02", "amount_spent": Decimal("120")},
         {"period": "2026-W03", "amount_spent": Decimal("110")}],
        horizon=2,
    )
    assert [point["projected"] for point in points] == [False, False, False, True, True]
    assert [point["period"] for point in points[-2:]] == ["2026-W04", "2026-W05"]
    assert points[-1]["lower_bound"] <= points[-1]["amount"] <= points[-1]["upper_bound"]


def test_organization_settings_require_a_value_and_normalize_at_route_boundary():
    with pytest.raises(ValidationError):
        OrganizationConfigUpdate()
    update = OrganizationConfigUpdate(org_name=" Acme ", currency="INR")
    assert update.org_name == " Acme "
    assert update.currency == "INR"
