"""
Groq reasoning service using pydantic-ai.
Sends structured financial evidence -> gets structured QwenReasoning back.
Logfire instruments every call automatically via pydantic-ai integration.
"""
import os
import logging
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from ..models import QwenReasoning

logger = logging.getLogger(__name__)

# Single agent instance - no factory, no DI container
_api_key = os.getenv("GROQ_API_KEY", "").strip()
_agent: Agent[None, QwenReasoning] | None = None
if _api_key and _api_key.lower() not in {"your-groq-key-here", "dummy_key_for_testing"}:
    _model = OpenAIChatModel(
        os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile"),
        provider=OpenAIProvider(
            base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
            api_key=_api_key,
        ),
    )
    _agent = Agent(
        _model,
        output_type=QwenReasoning,
        system_prompt=(
            "You are a financial analyst assistant. "
            "Given structured evidence about a budget reallocation, produce a clear, "
            "step-by-step reasoning trace for a finance manager. "
            "Be concise. Do not invent numbers - only use the evidence provided. "
            "Your confidence score reflects how well the evidence supports the recommendation."
        ),
    )

EVIDENCE_PROMPT = """\
Budget reallocation evidence:

SOURCE BUDGET LINE: {source_name}
  Priority score: {source_priority}/100
  Performance score: {source_performance}/100
  Remaining budget: ?{remaining_budget:,.0f}
  Spend velocity anomaly: {velocity_multiplier}x acceleration detected

TARGET BUDGET LINE: {target_name}
  Priority score: {target_priority}/100
  Performance score: {target_performance}/100
  Funding gap: ?{target_funding_gap:,.0f}

CALCULATED TRANSFER (deterministic engine): ?{transfer:,.0f}
Capped by: {capped_by}

Generate a recommendation with 6 reasoning steps, a confidence score, and a
one-sentence estimated consequence if this recommendation is rejected. If you
echo the calculated transfer, put the exact provided value in
validated_transfer. Never recalculate or change that value.
"""


async def get_reasoning(
    source_name: str,
    source_priority: int,
    source_performance: float,
    remaining_budget: float,
    velocity_multiplier: float,
    target_name: str,
    target_priority: int,
    target_performance: float,
    target_funding_gap: float,
    transfer: float,
    capped_by: str,
) -> QwenReasoning:
    prompt = EVIDENCE_PROMPT.format(
        source_name=source_name,
        source_priority=source_priority,
        source_performance=source_performance,
        remaining_budget=remaining_budget,
        velocity_multiplier=velocity_multiplier,
        target_name=target_name,
        target_priority=target_priority,
        target_performance=target_performance,
        target_funding_gap=target_funding_gap,
        transfer=transfer,
        capped_by=capped_by,
    )
    if _agent is None:
        return _fallback_reasoning(
            source_name, target_name, velocity_multiplier, target_priority,
            transfer, capped_by,
        )

    try:
        result = await _agent.run(prompt)
        output = result.output
        output.explanation_source = "groq"
        return output
    except Exception:
        logger.warning("Groq reasoning unavailable; using deterministic fallback", exc_info=True)
        return _fallback_reasoning(
            source_name, target_name, velocity_multiplier, target_priority,
            transfer, capped_by,
        )


def _fallback_reasoning(
    source_name: str,
    target_name: str,
    velocity_multiplier: float,
    target_priority: int,
    transfer: float,
    capped_by: str,
) -> QwenReasoning:
    return QwenReasoning(
        recommendation=(
            f"Transfer ?{transfer:,.0f} from {source_name} to {target_name}; "
            "AI provider unavailable, so this deterministic explanation is shown."
        ),
        reasoning_steps=[
            {"step": 1, "label": "Anomaly Detection", "detail": f"Observed spend velocity is {velocity_multiplier}x the baseline."},
            {"step": 2, "label": "Priority Review", "detail": f"Target priority is {target_priority}/100."},
            {"step": 3, "label": "Guardrail Calculation", "detail": f"Transfer is capped by {capped_by}."},
            {"step": 4, "label": "Funding Decision", "detail": f"Deterministic engine calculated ?{transfer:,.0f}."},
            {"step": 5, "label": "Human Approval", "detail": "No budget is moved without an explicit approval action."},
            {"step": 6, "label": "AI Availability", "detail": "Configure GROQ_API_KEY to replace this fallback with Groq reasoning."},
        ],
        confidence=0.5,
        validated_transfer=transfer,
        explanation_source="deterministic_fallback",
        rejection_consequence="The proposed reallocation remains pending until a finance approver reviews the evidence.",
    )
