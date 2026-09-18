"""Small deterministic forecast service used by charts and API consumers."""
from __future__ import annotations

from decimal import Decimal


def forecast_spend(entries: list[dict], horizon: int = 4) -> list[dict]:
    """Project weekly spend with a least-squares linear trend.

    The implementation is deliberately dependency-free and returns no points
    for an empty series. Existing actual points are included for chart parity.
    """
    horizon = max(1, min(int(horizon), 52))
    actual = [{"period": str(e.get("period", "")), "amount": float(e.get("amount_spent", 0)), "projected": False}
              for e in entries]
    if not actual:
        return []
    values = [Decimal(str(p["amount"])) for p in actual]
    n = len(values)
    if n == 1:
        slope = Decimal("0")
        intercept = values[0]
    else:
        xbar = Decimal(n - 1) / 2
        ybar = sum(values, Decimal("0")) / n
        denom = sum((Decimal(i) - xbar) ** 2 for i in range(n))
        slope = sum((Decimal(i) - xbar) * (values[i] - ybar) for i in range(n)) / denom
        intercept = ybar - slope * xbar
    residuals = [abs(values[i] - (intercept + slope * i)) for i in range(n)]
    margin = (sum(residuals, Decimal("0")) / n) * Decimal("1.96")
    last = actual[-1]["period"]
    prefix, sep, number = last.rpartition("-W")
    start = int(number) if sep and number.isdigit() else n
    for offset in range(1, horizon + 1):
        value = max(Decimal("0"), intercept + slope * (n - 1 + offset))
        period = f"{prefix}-W{start + offset:02d}" if sep else f"forecast-{offset}"
        actual.append({"period": period, "amount": float(value), "projected": True,
                       "lower_bound": float(max(Decimal("0"), value - margin)),
                       "upper_bound": float(value + margin)})
    return actual
