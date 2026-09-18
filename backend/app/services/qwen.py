"""
Groq reasoning service using pydantic-ai.
Sends structured financial evidence -> gets structured QwenReasoning back.
Logfire instruments every call automatically via pydantic-ai integration.
"""
import os
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from ..models import QwenReasoning

# Single agent instance - no factory, no DI container
_api_key = os.getenv("GROQ_API_KEY", "").strip()
_agent: Agent[None, QwenReasoning] | None = None
if _api_key and _api_key.lower() not in {"your-groq-key-here", "dummy_key_for_testing"}:
    _model = OpenAIChatModel(
        os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
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
  Remaining budget: ₹{remaining_budget:,.0f}
  Spend velocity anomaly: {velocity_multiplier}x acceleration detected

TARGET BUDGET LINE: {target_name}
  Priority score: {target_priority}/100
  Performance score: {target_performance}/100
  Funding gap: ₹{target_funding_gap:,.0f}

CALCULATED TRANSFER (deterministic engine): ₹{transfer:,.0f}
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
        raise RuntimeError(
            "AI reasoning unavailable: GROQ_API_KEY is not configured. "
            "No recommendation was created. Configure the provider and try again."
        )

    try:
        result = await _agent.run(prompt)
        output = result.output
        output.explanation_source = "groq"
        return output
    except Exception as exc:
        # Surface the provider failure instead of silently substituting a
        # deterministic explanation.
        raise RuntimeError(
            f"AI reasoning unavailable: Groq request failed ({exc}). "
            "No recommendation was created. Try again once the provider is healthy."
        ) from exc
