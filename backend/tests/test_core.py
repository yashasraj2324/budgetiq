"""
Pydantic-Evals suite for BudgetIQ's critical paths:
  1. Reallocation engine guardrails
  2. Anomaly detection thresholds
  3. Qwen output validation (offline — uses mocked reasoning)

Run:  python -m pytest backend/tests/ -v
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── 1. Reallocation Engine ────────────────────────────────────────────────────
from app.services.engine import calculate_transfer, validate_custom_amount

class TestReallocationEngine:
    def test_normal_transfer(self):
        r = calculate_transfer(650_000, 70_000, 50_000, 540_000, 600_000)
        # source_surplus = 650k - 70k - 50k = 530k; min(530k, 540k, 600k) = 530k
        assert r.transfer == 530_000
        assert r.capped_by == "source_surplus"

    def test_capped_by_target_gap(self):
        r = calculate_transfer(1_000_000, 0, 0, 100_000, 600_000)
        assert r.transfer == 100_000
        assert r.capped_by == "target_funding_gap"

    def test_capped_by_policy(self):
        r = calculate_transfer(1_000_000, 0, 0, 600_000, 200_000)
        assert r.transfer == 200_000
        assert r.capped_by == "policy_maximum"

    def test_zero_when_no_surplus(self):
        r = calculate_transfer(100_000, 80_000, 30_000, 500_000, 600_000)
        assert r.transfer == 0.0

    def test_validate_custom_ok(self):
        assert validate_custom_amount(100_000, 530_000, 540_000, 600_000) is None

    def test_validate_custom_exceeds_surplus(self):
        err = validate_custom_amount(700_000, 530_000, 540_000, 600_000)
        assert err is not None and "surplus" in err.lower()

    def test_validate_custom_exceeds_policy(self):
        err = validate_custom_amount(700_000, 900_000, 900_000, 600_000)
        assert err is not None and "policy" in err.lower()


# ── 2. Anomaly Detection ──────────────────────────────────────────────────────
from app.services.anomaly import detect_velocity_anomaly

class TestAnomalyDetection:
    def test_spike_detected(self):
        # 10 weeks normal (~45k), 2 weeks spike (~144k) = 3.2x
        normal = [45_000] * 10
        spike = [144_000, 147_000]
        result = detect_velocity_anomaly(normal + spike)
        assert result.detected
        assert result.velocity_multiplier >= 3.0

    def test_no_anomaly_flat_spend(self):
        result = detect_velocity_anomaly([50_000] * 12)
        assert not result.detected
        assert result.velocity_multiplier == pytest.approx(1.0)

    def test_insufficient_data(self):
        result = detect_velocity_anomaly([50_000])  # only 1 entry
        assert not result.detected

    def test_period_remaining_calculation(self):
        data = [50_000] * 10
        result = detect_velocity_anomaly(data, periods_in_cycle=12)
        assert result.period_remaining == 2

    def test_zero_baseline_safe(self):
        # edge: first N entries are 0
        result = detect_velocity_anomaly([0, 0, 50_000, 55_000])
        assert not result.detected  # baseline=0, guard handles it


# ── 3. QwenReasoning Pydantic model validation ────────────────────────────────
from app.models import QwenReasoning, ReasoningStep

class TestQwenReasoningModel:
    def test_valid_reasoning(self):
        r = QwenReasoning(
            recommendation="Move ₹4.8L from Regional Events to Onboarding",
            reasoning_steps=[
                ReasoningStep(step=1, label="Anomaly", detail="3.2x spend velocity"),
                ReasoningStep(step=2, label="Source priority", detail="35/100"),
            ],
            confidence=0.94,
        )
        assert r.confidence == 0.94

    def test_confidence_out_of_range(self):
        with pytest.raises(Exception):
            QwenReasoning(
                recommendation="test",
                reasoning_steps=[],
                confidence=1.5,  # invalid
            )

    def test_confidence_negative(self):
        with pytest.raises(Exception):
            QwenReasoning(
                recommendation="test",
                reasoning_steps=[],
                confidence=-0.1,
            )


# ── 4. Pydantic-Evals: Reallocation engine as eval dataset ───────────────────
from pydantic_evals import Case, Dataset
from pydantic import BaseModel
from dataclasses import dataclass


class EngineInput(BaseModel):
    remaining: float
    necessary: float
    reserve: float
    target_gap: float
    policy_max: float


class EngineOutput(BaseModel):
    transfer: float
    capped_by: str


@dataclass
class TransferTask:
    """Wraps engine as pydantic-evals task."""
    async def __call__(self, inputs: EngineInput) -> EngineOutput:
        r = calculate_transfer(
            inputs.remaining, inputs.necessary, inputs.reserve,
            inputs.target_gap, inputs.policy_max,
        )
        return EngineOutput(transfer=r.transfer, capped_by=r.capped_by)


EVAL_CASES: list[Case[EngineInput, EngineOutput]] = [
    Case(
        name="demo_scenario",
        inputs=EngineInput(remaining=650_000, necessary=70_000, reserve=50_000,
                           target_gap=540_000, policy_max=600_000),
        expected_output=EngineOutput(transfer=530_000, capped_by="source_surplus"),
    ),
    Case(
        name="gap_is_binding",
        inputs=EngineInput(remaining=1_000_000, necessary=0, reserve=0,
                           target_gap=100_000, policy_max=600_000),
        expected_output=EngineOutput(transfer=100_000, capped_by="target_funding_gap"),
    ),
    Case(
        name="policy_is_binding",
        inputs=EngineInput(remaining=1_000_000, necessary=0, reserve=0,
                           target_gap=600_000, policy_max=200_000),
        expected_output=EngineOutput(transfer=200_000, capped_by="policy_maximum"),
    ),
    Case(
        name="no_surplus",
        inputs=EngineInput(remaining=100_000, necessary=80_000, reserve=30_000,
                           target_gap=500_000, policy_max=600_000),
        expected_output=EngineOutput(transfer=0.0, capped_by="source_surplus"),
    ),
]


async def transfer_task(inputs: EngineInput) -> EngineOutput:
    """Plain async function — pydantic-evals callable task."""
    r = calculate_transfer(
        inputs.remaining, inputs.necessary, inputs.reserve,
        inputs.target_gap, inputs.policy_max,
    )
    return EngineOutput(transfer=r.transfer, capped_by=r.capped_by)


@pytest.mark.asyncio
async def test_engine_evals():
    """Run the reallocation engine through pydantic-evals dataset."""
    dataset = Dataset(name="reallocation_engine", cases=EVAL_CASES)
    report = await dataset.evaluate(transfer_task)
    # failures list is empty when all cases pass
    assert report.failures == [], f"Eval failures: {report.failures}"
