"""
Spend velocity anomaly detection — MRD MR-03 / tech_func FR-005.
Splits spend history into baseline vs recent window; flags acceleration.
"""
from dataclasses import dataclass


@dataclass
class AnomalyResult:
    detected: bool
    velocity_multiplier: float
    recent_rate: float      # avg spend per period in recent window
    baseline_rate: float    # avg spend per period in baseline window
    period_remaining: int   # how many periods are left in the budget period


def detect_velocity_anomaly(
    spend_by_period: list[float],  # ordered oldest → newest
    recent_window: int = 2,
    threshold: float = 2.0,
    periods_in_cycle: int = 12,
) -> AnomalyResult:
    """
    Compare recent_window periods vs everything before.
    Flag if recent_rate / baseline_rate >= threshold.
    # ponytail: simple ratio, upgrade to z-score if false-positive rate rises
    """
    if len(spend_by_period) < recent_window + 1:
        return AnomalyResult(False, 1.0, 0.0, 0.0, 0)

    recent = spend_by_period[-recent_window:]
    baseline = spend_by_period[:-recent_window]

    recent_rate = sum(recent) / len(recent)
    baseline_rate = sum(baseline) / len(baseline) if baseline else recent_rate

    if baseline_rate == 0:
        return AnomalyResult(False, 1.0, recent_rate, 0.0, 0)

    multiplier = recent_rate / baseline_rate
    periods_elapsed = len(spend_by_period)
    period_remaining = max(0, periods_in_cycle - periods_elapsed)

    return AnomalyResult(
        detected=multiplier >= threshold,
        velocity_multiplier=round(multiplier, 2),
        recent_rate=recent_rate,
        baseline_rate=baseline_rate,
        period_remaining=period_remaining,
    )
