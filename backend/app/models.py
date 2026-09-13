from __future__ import annotations
import enum
from datetime import datetime
from typing import Any
from pydantic import BaseModel, field_validator, model_validator


KNOWN_ACTORS = {"VP Finance", "CFO", "Finance Manager", "Budget Analyst", "Controller", "finance_user", "system"}

class RecommendationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    modified = "modified"

class SpendEntryOut(BaseModel):
    id: int
    budget_line_id: int
    period: str
    amount_spent: float
    model_config = {"from_attributes": True}

class BudgetLineOut(BaseModel):
    id: int
    department_id: int
    name: str
    allocated_amount: float
    remaining_budget: float
    priority_weight: int
    category: str
    necessary_future_spend: float = 0.0
    safety_reserve: float = 0.0
    policy_maximum_transfer: float = 0.0
    model_config = {"from_attributes": True}

class DepartmentOut(BaseModel):
    id: int
    name: str
    priority_weight: int
    budget_lines: list[BudgetLineOut] = []
    model_config = {"from_attributes": True}

class AnomalyOut(BaseModel):
    budget_line_id: int
    budget_line_name: str
    department_name: str
    velocity_multiplier: float
    recent_rate: float
    baseline_rate: float
    period_remaining: int

class RecommendationOut(BaseModel):
    id: int
    source_line_id: int
    target_line_id: int
    amount: float
    rationale_json: dict[str, Any]
    status: RecommendationStatus
    confidence: float
    created_at: datetime
    approved_at: datetime | None = None
    model_config = {"from_attributes": True}

class GenerateRequest(BaseModel):
    source_line_id: int
    target_line_id: int

class ApproveRequest(BaseModel):
    actor: str = "finance_user"

class ModifyRequest(BaseModel):
    amount: float
    actor: str = "finance_user"
    @field_validator("amount")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class RejectRequest(BaseModel):
    reason: str = ""
    actor: str = "finance_user"


# ---------------------------------------------------------------------------
# New: Policy update
# ---------------------------------------------------------------------------

class PolicyUpdateRequest(BaseModel):
    policy_maximum_transfer: float | None = None
    safety_reserve: float | None = None
    necessary_future_spend: float | None = None

    @model_validator(mode="after")
    def at_least_one(self) -> "PolicyUpdateRequest":
        if all(v is None for v in [self.policy_maximum_transfer, self.safety_reserve, self.necessary_future_spend]):
            raise ValueError("At least one policy field must be provided")
        return self


# ---------------------------------------------------------------------------
# New: Budget line ingestion (POST /budget-lines)
# ---------------------------------------------------------------------------

class BudgetLineIn(BaseModel):
    department_id: int
    name: str
    allocated_amount: float
    priority_weight: int
    category: str
    necessary_future_spend: float = 0.0
    safety_reserve: float = 0.0
    policy_maximum_transfer: float = 0.0

    @field_validator("priority_weight")
    @classmethod
    def weight_range(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("priority_weight must be 0–100")
        return v

    @field_validator("allocated_amount")
    @classmethod
    def positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("allocated_amount must be positive")
        return v


# ---------------------------------------------------------------------------
# New: Onboarding
# ---------------------------------------------------------------------------

class OnboardingDept(BaseModel):
    name: str
    priority_weight: int

class OnboardingLine(BaseModel):
    department_name: str
    name: str
    allocated_amount: float
    priority_weight: int
    category: str
    necessary_future_spend: float = 0.0
    safety_reserve: float = 0.0
    policy_maximum_transfer: float = 0.0

class OnboardingDataRequest(BaseModel):
    org_name: str
    fiscal_year: str
    currency: str = "INR"
    departments: list[OnboardingDept] = []
    budget_lines: list[OnboardingLine] = []

class OnboardingPrioritiesRequest(BaseModel):
    line_priorities: list[dict[str, Any]] = []  # [{name, priority_weight}]

class OnboardingPoliciesRequest(BaseModel):
    line_policies: list[dict[str, Any]] = []  # [{name, policy_maximum_transfer, safety_reserve, necessary_future_spend}]

class DashboardOut(BaseModel):
    total_budget: float
    total_remaining: float
    reallocatable: float
    pending_recommendations: int
    anomaly_count: int
    departments: list[DepartmentOut]

class AuditEventOut(BaseModel):
    id: int
    recommendation_id: int
    action: str
    actor: str
    event_metadata: dict[str, Any]
    timestamp: datetime
    model_config = {"from_attributes": True}

class PerformanceScoreOut(BaseModel):
    id: int
    budget_line_id: int
    period: str
    score: float
    metric_type: str

class ReasoningStep(BaseModel):
    step: int
    label: str
    detail: str

class QwenReasoning(BaseModel):
    recommendation: str
    reasoning_steps: list[ReasoningStep]
    confidence: float
    rejection_consequence: str
    @model_validator(mode="after")
    def confidence_range(self) -> "QwenReasoning":
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be 0.0-1.0")
        return self
