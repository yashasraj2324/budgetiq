import pytest
import os
import sys
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.models import (
    BudgetLineIn,
    BudgetLineUpdate,
    OnboardingDataRequest,
    OnboardingPoliciesRequest,
    OnboardingPrioritiesRequest,
)


def test_onboarding_config_and_lines_are_validated():
    request = OnboardingDataRequest(
        org_name="Acme", fiscal_year="2026", currency="inr",
        departments=[{"name": "Operations", "priority_weight": 60}],
        budget_lines=[{
            "department_name": "Operations", "name": "Cloud",
            "allocated_amount": "100.00", "priority_weight": 70,
            "category": "Technology",
        }],
    )
    assert request.currency == "INR"
    assert request.budget_lines[0].allocated_amount == 100

    with pytest.raises(ValidationError):
        OnboardingDataRequest(org_name="", fiscal_year="2026", currency="USD")


def test_priority_and_policy_updates_reject_invalid_values():
    with pytest.raises(ValidationError):
        OnboardingPrioritiesRequest(line_priorities=[{"name": "Cloud", "priority_weight": 101}])
    with pytest.raises(ValidationError):
        OnboardingPoliciesRequest(line_policies=[{"name": "Cloud", "safety_reserve": -1}])
    with pytest.raises(ValidationError):
        BudgetLineUpdate()


def test_budget_line_input_rejects_non_positive_allocations():
    with pytest.raises(ValidationError):
        BudgetLineIn(
            department_id=1, name="Cloud", allocated_amount=0,
            priority_weight=50, category="Technology",
        )
