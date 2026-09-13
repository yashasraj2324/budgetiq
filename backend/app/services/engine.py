"""
Deterministic financial engine — the numbers never come from the LLM.
All formulas from MRD MR-06 / tech_func FR-010.
"""
from dataclasses import dataclass


@dataclass
class GuardrailResult:
    transfer: float
    source_surplus: float
    target_funding_gap: float
    capped_by: str  # which limit was the binding constraint


def calculate_transfer(
    remaining_budget: float,
    necessary_future_spend: float,
    safety_reserve: float,
    target_funding_gap: float,
    policy_maximum: float,
) -> GuardrailResult:
    """
    MRD MR-06 formula:
        source_surplus = remaining - necessary_future_spend - safety_reserve
        transfer = min(source_surplus, target_funding_gap, policy_maximum)
    Returns 0 if any limit is non-positive.
    """
    source_surplus = remaining_budget - necessary_future_spend - safety_reserve
    if source_surplus <= 0:
        return GuardrailResult(0.0, source_surplus, target_funding_gap, "source_surplus")

    limits = {
        "source_surplus": source_surplus,
        "target_funding_gap": target_funding_gap,
        "policy_maximum": policy_maximum,
    }
    capped_by = min(limits, key=lambda k: limits[k])
    transfer = max(0.0, limits[capped_by])
    return GuardrailResult(transfer, source_surplus, target_funding_gap, capped_by)


def validate_custom_amount(
    amount: float,
    source_surplus: float,
    target_funding_gap: float,
    policy_maximum: float,
) -> str | None:
    """Returns an error string if amount violates guardrails, else None."""
    if amount > source_surplus:
        return f"Exceeds source surplus (₹{source_surplus:,.0f})"
    if amount > target_funding_gap:
        return f"Exceeds target funding gap (₹{target_funding_gap:,.0f})"
    if amount > policy_maximum:
        return f"Exceeds policy maximum (₹{policy_maximum:,.0f})"
    return None
