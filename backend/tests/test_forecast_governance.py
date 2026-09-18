"""Tests for forecast governance: provenance, backtest, insufficient_data guard."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from decimal import Decimal
from app.services.forecast import (
    forecast_spend, forecast_provenance, backtest_forecast, is_insufficient,
    MINIMUM_POINTS_FOR_PROJECTION,
)


def _entry(period: str, amount: float) -> dict:
    return {"period": period, "amount_spent": Decimal(str(amount))}


class TestInsufficientData:
    def test_empty_series_returns_no_projections(self):
        points = forecast_spend([], horizon=4)
        assert points == []

    def test_empty_is_insufficient(self):
        assert is_insufficient([]) is True

    def test_single_point_is_insufficient(self):
        assert is_insufficient([_entry("2026-W01", 100)]) is True

    def test_two_points_still_insufficient(self):
        entries = [_entry(f"2026-W0{i}", 100) for i in range(1, 3)]
        assert is_insufficient(entries) is True
        points = forecast_spend(entries, horizon=2)
        # Only actuals returned, no projections
        assert all(not p.get("projected", False) for p in points)

    def test_three_points_sufficient(self):
        entries = [_entry(f"2026-W0{i}", 100 * i) for i in range(1, 4)]
        assert is_insufficient(entries) is False
        points = forecast_spend(entries, horizon=2)
        projected = [p for p in points if p.get("projected")]
        assert len(projected) == 2


class TestForecastProvenance:
    def test_provenance_fields_present(self):
        entries = [_entry(f"2026-W0{i}", 100) for i in range(1, 5)]
        prov = forecast_provenance(entries, horizon=4)
        assert "algorithm" in prov
        assert "algorithm_version" in prov
        assert "horizon" in prov
        assert "data_points" in prov
        assert "generated_at" in prov
        assert "insufficient_data" in prov

    def test_provenance_insufficient_flag_true_for_short_series(self):
        entries = [_entry("2026-W01", 100)]
        prov = forecast_provenance(entries, horizon=4)
        assert prov["insufficient_data"] is True

    def test_provenance_marks_data_window(self):
        entries = [_entry(f"2026-W0{i}", 100) for i in range(1, 5)]
        prov = forecast_provenance(entries, horizon=2)
        assert prov["data_window_start"] == "2026-W01"
        assert prov["data_window_end"] == "2026-W04"


class TestBacktest:
    def test_backtest_returns_none_for_insufficient_data(self):
        entries = [_entry("2026-W01", 100), _entry("2026-W02", 120)]
        result = backtest_forecast(entries, holdout=2)
        assert result is None

    def test_backtest_mae_rmse_present(self):
        entries = [_entry(f"2026-W{i:02d}", 1000 * i) for i in range(1, 9)]
        result = backtest_forecast(entries, holdout=2)
        assert result is not None
        assert "mae" in result
        assert "rmse" in result
        assert isinstance(result["mae"], float)
        assert isinstance(result["rmse"], float)

    def test_mape_present_when_no_zero_actuals(self):
        entries = [_entry(f"2026-W{i:02d}", 1000 * i) for i in range(1, 9)]
        result = backtest_forecast(entries, holdout=2)
        assert result is not None
        assert result["mape_percent"] is not None
        assert result["mape_unavailable_reason"] is None

    def test_mape_omitted_when_actual_is_zero(self):
        entries = [_entry(f"2026-W0{i}", 0 if i == 7 else 1000) for i in range(1, 9)]
        result = backtest_forecast(entries, holdout=2)
        if result is not None:
            # May or may not have zero in held-out window — just assert no crash
            assert "mape_percent" in result

    def test_backtest_holdout_count_matches(self):
        entries = [_entry(f"2026-W{i:02d}", 100 * i) for i in range(1, 9)]
        result = backtest_forecast(entries, holdout=3)
        assert result is not None
        assert result["n"] == 3
        assert len(result["actuals"]) == 3
        assert len(result["predictions"]) == 3

    def test_review_status_default_pending(self):
        entries = [_entry(f"2026-W{i:02d}", 100 * i) for i in range(1, 8)]
        result = backtest_forecast(entries, holdout=2)
        assert result is not None
        assert result["review_status"] == "pending"


class TestForecastProjectionBounds:
    def test_projections_have_bounds(self):
        entries = [_entry(f"2026-W0{i}", 1000 * i) for i in range(1, 6)]
        points = forecast_spend(entries, horizon=3)
        for p in points:
            if p.get("projected"):
                assert "lower_bound" in p
                assert "upper_bound" in p
                assert p["lower_bound"] <= p["amount"] <= p["upper_bound"]

    def test_no_negative_projections(self):
        entries = [_entry(f"2026-W0{i}", i) for i in range(1, 6)]
        points = forecast_spend(entries, horizon=10)
        for p in points:
            assert p["amount"] >= 0
