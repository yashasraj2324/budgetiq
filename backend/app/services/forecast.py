"""Deterministic forecast service with governance, backtesting, and provenance.

The linear-trend engine is dependency-free and reproducible. Backtesting
calculates MAE, RMSE, and MAPE (guarded against zero actuals). Provenance
fields travel with every forecast so model governance is auditable.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

ALGORITHM_VERSION = "linear_trend_v1"
MINIMUM_POINTS_FOR_PROJECTION = 3


def forecast_spend(entries: list[dict], horizon: int = 4) -> list[dict]:
    """Project weekly spend with a least-squares linear trend.

    Returns no projected points for an empty or insufficient series.
    Actual points are always included for chart parity.
    """
    horizon = max(1, min(int(horizon), 52))
    actual = [
        {
            "period": str(e.get("period", "")),
            "amount": float(e.get("amount_spent", 0)),
            "projected": False,
        }
        for e in entries
    ]
    if len(actual) < MINIMUM_POINTS_FOR_PROJECTION:
        # Return actuals only — no fabricated projections
        return actual

    values = [Decimal(str(p["amount"])) for p in actual]
    n = len(values)
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
        actual.append(
            {
                "period": period,
                "amount": float(value),
                "projected": True,
                "lower_bound": float(max(Decimal("0"), value - margin)),
                "upper_bound": float(value + margin),
            }
        )
    return actual


def is_insufficient(entries: list[dict]) -> bool:
    """True when there are too few data points to produce a valid projection."""
    return len(entries) < MINIMUM_POINTS_FOR_PROJECTION


def forecast_provenance(entries: list[dict], horizon: int, generated_at: datetime | None = None) -> dict[str, Any]:
    """Return governance provenance record for a forecast."""
    if generated_at is None:
        generated_at = datetime.now(timezone.utc)
    return {
        "algorithm": ALGORITHM_VERSION,
        "algorithm_version": ALGORITHM_VERSION,
        "horizon": horizon,
        "data_points": len(entries),
        "data_window_start": str(entries[0].get("period", "")) if entries else None,
        "data_window_end": str(entries[-1].get("period", "")) if entries else None,
        "generated_at": generated_at.isoformat(),
        "minimum_points_required": MINIMUM_POINTS_FOR_PROJECTION,
        "insufficient_data": is_insufficient(entries),
    }


def backtest_forecast(entries: list[dict], holdout: int = 2) -> dict[str, Any] | None:
    """Backtest by withholding the last N actual points and projecting them.

    Returns MAE, RMSE, MAPE (only when no actuals are zero). Returns None
    when there is insufficient data for a meaningful backtest.
    """
    if len(entries) < MINIMUM_POINTS_FOR_PROJECTION + holdout:
        return None

    train = entries[:-holdout]
    held_out = entries[-holdout:]

    projected = forecast_spend(train, horizon=holdout)
    proj_points = [p for p in projected if p.get("projected")]

    if len(proj_points) < holdout:
        return None

    actuals = [float(e.get("amount_spent", 0)) for e in held_out]
    predictions = [p["amount"] for p in proj_points[:holdout]]

    n = len(actuals)
    errors = [abs(a - p) for a, p in zip(actuals, predictions)]
    squared_errors = [(a - p) ** 2 for a, p in zip(actuals, predictions)]

    mae = sum(errors) / n
    rmse = (sum(squared_errors) / n) ** 0.5

    # MAPE only when no actual is zero (avoids division by zero and infinite metrics)
    mape: float | None = None
    if all(a != 0 for a in actuals):
        mape = 100.0 * sum(abs((a - p) / a) for a, p in zip(actuals, predictions)) / n

    return {
        "algorithm": ALGORITHM_VERSION,
        "holdout_periods": holdout,
        "n": n,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape_percent": round(mape, 4) if mape is not None else None,
        "mape_unavailable_reason": "actuals_contain_zero" if mape is None else None,
        "actuals": actuals,
        "predictions": [round(p, 2) for p in predictions],
        "review_status": "pending",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
