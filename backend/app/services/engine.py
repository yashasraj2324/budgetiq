"""
Deterministic financial engine — the numbers never come from the LLM.
All formulas from MRD MR-06 / tech_func FR-010.
"""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


Money = Decimal | int | float | str


def _money(value: Money) -> Decimal:
    """Convert through ``str`` so binary float artifacts never enter a formula."""
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"Invalid monetary value: {value!r}") from exc
    if not result.is_finite():
        raise ValueError(f"Monetary values must be finite: {value!r}")
    return result


@dataclass
class GuardrailResult:
    transfer: Decimal
    source_surplus: Decimal
    target_funding_gap: Decimal
    capped_by: str  # which limit was the binding constraint


def calculate_transfer(
    remaining_budget: Money,
    necessary_future_spend: Money,
    safety_reserve: Money,
    target_funding_gap: Money,
    policy_maximum: Money,
) -> GuardrailResult:
    """
    MRD MR-06 formula:
        source_surplus = remaining - necessary_future_spend - safety_reserve
        transfer = min(source_surplus, target_funding_gap, policy_maximum)
    Returns 0 if any limit is non-positive.
    """
    remaining_budget = _money(remaining_budget)
    necessary_future_spend = _money(necessary_future_spend)
    safety_reserve = _money(safety_reserve)
    target_funding_gap = _money(target_funding_gap)
    policy_maximum = _money(policy_maximum)
    source_surplus = remaining_budget - necessary_future_spend - safety_reserve
    if source_surplus <= 0:
        return GuardrailResult(Decimal("0"), source_surplus, target_funding_gap, "source_surplus")

    limits = {
        "source_surplus": source_surplus,
        "target_funding_gap": target_funding_gap,
        "policy_maximum": policy_maximum,
    }
    capped_by = min(limits, key=lambda k: limits[k])
    transfer = max(Decimal("0"), limits[capped_by])
    return GuardrailResult(transfer, source_surplus, target_funding_gap, capped_by)


def validate_custom_amount(
    amount: Money,
    source_surplus: Money,
    target_funding_gap: Money,
    policy_maximum: Money,
) -> str | None:
    """Returns an error string if amount violates guardrails, else None."""
    amount = _money(amount)
    source_surplus = _money(source_surplus)
    target_funding_gap = _money(target_funding_gap)
    policy_maximum = _money(policy_maximum)
    if amount > source_surplus:
        return f"Exceeds source surplus (₹{source_surplus:,.0f})"
    if amount > target_funding_gap:
        return f"Exceeds target funding gap (₹{target_funding_gap:,.0f})"
    if amount > policy_maximum:
        return f"Exceeds policy maximum (₹{policy_maximum:,.0f})"
    return None
