from __future__ import annotations
import enum
from datetime import datetime
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


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
    budget_lines: list[BudgetLineOut] = Field(default_factory=list)
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
    amount: Decimal
    actor: str = "finance_user"
    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("amount must be positive")
        return v

class RejectRequest(BaseModel):
    reason: str = ""
    actor: str = "finance_user"


# ---------------------------------------------------------------------------
# New: Policy update
# ---------------------------------------------------------------------------

class PolicyUpdateRequest(BaseModel):
    policy_maximum_transfer: Decimal | None = None
    safety_reserve: Decimal | None = None
    necessary_future_spend: Decimal | None = None

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
    allocated_amount: Decimal
    priority_weight: int
    category: str
    necessary_future_spend: Decimal = Decimal("0")
    safety_reserve: Decimal = Decimal("0")
    policy_maximum_transfer: Decimal = Decimal("0")

    @field_validator("name", "category")
    @classmethod
    def non_empty_text(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("name and category must not be empty")
        return value

    @field_validator("priority_weight")
    @classmethod
    def weight_range(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("priority_weight must be 0–100")
        return v

    @field_validator("allocated_amount")
    @classmethod
    def positive_amount(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("allocated_amount must be positive")
        return v

    @field_validator("necessary_future_spend", "safety_reserve", "policy_maximum_transfer")
    @classmethod
    def non_negative_policy(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v < 0:
            raise ValueError("policy amounts must be finite and non-negative")
        return v

class BudgetLineUpdate(BaseModel):
    name: str | None = None
    allocated_amount: Decimal | None = None
    priority_weight: int | None = None
    category: str | None = None
    necessary_future_spend: Decimal | None = None
    safety_reserve: Decimal | None = None
    policy_maximum_transfer: Decimal | None = None

    @model_validator(mode="after")
    def validate_update(self) -> "BudgetLineUpdate":
        if not self.model_dump(exclude_none=True):
            raise ValueError("At least one field must be provided")
        if self.name is not None and not self.name.strip():
            raise ValueError("name must not be empty")
        if self.category is not None and not self.category.strip():
            raise ValueError("category must not be empty")
        if self.allocated_amount is not None and (not self.allocated_amount.is_finite() or self.allocated_amount <= 0):
            raise ValueError("allocated_amount must be positive")
        if self.priority_weight is not None and not 0 <= self.priority_weight <= 100:
            raise ValueError("priority_weight must be 0–100")
        for value in (self.necessary_future_spend, self.safety_reserve, self.policy_maximum_transfer):
            if value is not None and (not value.is_finite() or value < 0):
                raise ValueError("policy amounts must be finite and non-negative")
        return self

# ---------------------------------------------------------------------------
# New: Onboarding
# ---------------------------------------------------------------------------

class OnboardingDept(BaseModel):
    name: str
    priority_weight: int

    @field_validator("name")
    @classmethod
    def department_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("department name must not be empty")
        return v.strip()

    @field_validator("priority_weight")
    @classmethod
    def department_weight(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("priority_weight must be 0–100")
        return v

class OnboardingLine(BaseModel):
    department_name: str
    name: str
    allocated_amount: Decimal
    priority_weight: int
    category: str
    necessary_future_spend: Decimal = Decimal("0")
    safety_reserve: Decimal = Decimal("0")
    policy_maximum_transfer: Decimal = Decimal("0")

    @field_validator("name", "department_name", "category")
    @classmethod
    def line_text(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("line fields must not be empty")
        return value

    @field_validator("priority_weight")
    @classmethod
    def line_weight(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("priority_weight must be 0–100")
        return v

    @field_validator("allocated_amount")
    @classmethod
    def line_amount(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("allocated_amount must be positive")
        return v

    @field_validator("necessary_future_spend", "safety_reserve", "policy_maximum_transfer")
    @classmethod
    def line_policy_amount(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v < 0:
            raise ValueError("policy amounts must be finite and non-negative")
        return v

class OnboardingDataRequest(BaseModel):
    org_name: str
    fiscal_year: str
    currency: str = "INR"
    departments: list[OnboardingDept] = Field(default_factory=list)
    budget_lines: list[OnboardingLine] = Field(default_factory=list)

    @field_validator("org_name", "fiscal_year")
    @classmethod
    def required_config(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("organization configuration fields must not be empty")
        return value

    @field_validator("currency")
    @classmethod
    def currency_code(cls, v: str) -> str:
        value = v.strip().upper()
        if len(value) != 3 or not value.isalpha():
            raise ValueError("currency must be a three-letter code")
        return value

class OnboardingPrioritiesRequest(BaseModel):
    line_priorities: list["PriorityUpdate"] = Field(default_factory=list)

class OnboardingPoliciesRequest(BaseModel):
    line_policies: list["PolicyLineUpdate"] = Field(default_factory=list)

class PriorityUpdate(BaseModel):
    name: str
    priority_weight: int

    @field_validator("name")
    @classmethod
    def priority_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @field_validator("priority_weight")
    @classmethod
    def priority_range(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("priority_weight must be 0–100")
        return v

class PolicyLineUpdate(BaseModel):
    name: str
    policy_maximum_transfer: Decimal | None = None
    safety_reserve: Decimal | None = None
    necessary_future_spend: Decimal | None = None

    @model_validator(mode="after")
    def has_policy(self) -> "PolicyLineUpdate":
        if all(v is None for v in (self.policy_maximum_transfer, self.safety_reserve, self.necessary_future_spend)):
            raise ValueError("At least one policy field must be provided")
        if any(v is not None and (not v.is_finite() or v < 0) for v in (
            self.policy_maximum_transfer, self.safety_reserve, self.necessary_future_spend
        )):
            raise ValueError("policy amounts must be finite and non-negative")
        return self

class PageOut(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int
    pages: int

class DashboardOut(BaseModel):
    total_budget: float
    total_remaining: float
    reallocatable: float
    pending_recommendations: int
    anomaly_count: int
    departments: list[DepartmentOut]
    budget_lines: list[BudgetLineOut] = Field(default_factory=list)
    pagination: PageOut | None = None
    scenario: str | None = None

class OrganizationConfigOut(BaseModel):
    org_name: str = ""
    fiscal_year: str = ""
    currency: str = "INR"
    updated_at: datetime | None = None

class OrganizationConfigUpdate(BaseModel):
    org_name: str | None = None
    fiscal_year: str | None = None
    currency: str | None = None

    @model_validator(mode="after")
    def validate_values(self) -> "OrganizationConfigUpdate":
        if not self.model_dump(exclude_none=True):
            raise ValueError("At least one organization setting must be provided")
        for value in (self.org_name, self.fiscal_year):
            if value is not None and not value.strip():
                raise ValueError("organization settings must not be empty")
        if self.currency is not None and (len(self.currency.strip()) != 3 or not self.currency.strip().isalpha()):
            raise ValueError("currency must be a three-letter code")
        return self

class ForecastPointOut(BaseModel):
    period: str
    amount: float
    projected: bool = True
    lower_bound: float | None = None
    upper_bound: float | None = None

class ForecastOut(BaseModel):
    budget_line_id: int
    horizon: int
    points: list[ForecastPointOut]
    method: str = "linear_trend"

class AuditEventOut(BaseModel):
    id: int
    recommendation_id: int | None = None
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

class BudgetLineDetailOut(BudgetLineOut):
    department_name: str = ""
    spend_entries: list[SpendEntryOut] = Field(default_factory=list)
    performance_scores: list[PerformanceScoreOut] = Field(default_factory=list)
    anomaly: AnomalyOut | None = None

class ReasoningStep(BaseModel):
    step: int
    label: str
    detail: str

class QwenReasoning(BaseModel):
    recommendation: str
    reasoning_steps: list[ReasoningStep] = Field(default_factory=list)
    confidence: float
    rejection_consequence: str = ""
    # Optional echo from the provider. When present it must match the
    # deterministic engine; the API never uses this value to move money.
    validated_transfer: Decimal | None = None
    explanation_source: str = "qwen"
    @model_validator(mode="after")
    def confidence_range(self) -> "QwenReasoning":
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be 0.0-1.0")
        return self


class MembershipOut(BaseModel):
    user_id: str
    email: str = ""
    role: str
    status: str = "active"
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class MembershipUpdate(BaseModel):
    role: str


class InvitationCreate(BaseModel):
    email: str
    role: str = "finance_user"
    expires_in_days: int = Field(default=7, ge=1, le=90)


class ApprovalTier(BaseModel):
    level: int = Field(ge=1, le=10)
    min_amount: Decimal = Field(ge=0)
    approver_roles: list[str] = Field(min_length=1)


class ApprovalPolicyIn(BaseModel):
    tiers: list[ApprovalTier] = Field(min_length=1)
    escalation_hours: int = Field(default=24, ge=1, le=720)
    delegated_approvers: list[str] = Field(default_factory=list)
    dual_sign: bool = False


class ApprovalPolicyOut(ApprovalPolicyIn):
    organization_id: str
    updated_at: datetime
    model_config = {"from_attributes": True}


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[str] = Field(default_factory=lambda: ["read"])
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)


class ApiKeyOut(BaseModel):
    id: int
    name: str
    scopes: list[str]
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    key: str | None = None
