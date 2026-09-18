"""
Deterministic reasoning for budget reallocation recommendations.
Produces the explanation locally from engine evidence; no external
AI provider or API key is required.
"""
from ..models import ReasoningOutput


def build_reasoning(
    source_name: str,
    source_priority: int,
    velocity_multiplier: float,
    target_name: str,
    target_priority: int,
    transfer: float,
    capped_by: str,
) -> ReasoningOutput:
    return ReasoningOutput(
        recommendation=(
            f"Transfer \u20b9{transfer:,.0f} from {source_name} to {target_name}; "
            "this deterministic explanation is generated locally."
        ),
        reasoning_steps=[
            {"step": 1, "label": "Anomaly Detection", "detail": f"Observed spend velocity is {velocity_multiplier}x the baseline."},
            {"step": 2, "label": "Priority Review", "detail": f"Source priority is {source_priority}/100; target priority is {target_priority}/100."},
            {"step": 3, "label": "Guardrail Calculation", "detail": f"Transfer is capped by {capped_by}."},
            {"step": 4, "label": "Funding Decision", "detail": f"Deterministic engine calculated \u20b9{transfer:,.0f}."},
            {"step": 5, "label": "Human Approval", "detail": "No budget is moved without an explicit approval action."},
            {"step": 6, "label": "Explanation Source", "detail": "Generated deterministically; no external AI provider is required."},
        ],
        confidence=0.5,
        validated_transfer=transfer,
        explanation_source="deterministic",
        rejection_consequence="The proposed reallocation remains pending until a finance approver reviews the evidence.",
    )
