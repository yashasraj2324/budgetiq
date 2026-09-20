// GROQ reasoning (real AI mode). Returns null only when the provider is
// unconfigured, unreachable, or returned invalid output — the caller surfaces
// the failure instead of falling back to fabricated reasoning.
export async function groqReasoning(
  prompt: string,
  transfer: number,
): Promise<{ recommendation: string; reasoning_steps: unknown[]; confidence: number; rejection_consequence: string; validated_transfer: number } | null> {
  const apiKey = Deno.env.get("GROQ_API_KEY") ?? "";
  if (!apiKey || apiKey.toLowerCase() === "your-groq-key-here") return null;
  const model = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a financial analyst assistant. Given structured evidence about a budget reallocation, produce a clear, step-by-step reasoning trace for a finance manager. Be concise. Do not invent numbers - only use the evidence provided. Respond ONLY with a JSON object matching this schema: {recommendation: string, reasoning_steps: [{step: number, label: string, detail: string}], confidence: number, rejection_consequence: string, validated_transfer: number}. Never recalculate or change the provided transfer value.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error("groq request failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || typeof parsed.recommendation !== "string" || !Array.isArray(parsed.reasoning_steps) || parsed.reasoning_steps.length < 1) {
      return null;
    }
    return {
      recommendation: parsed.recommendation,
      reasoning_steps: parsed.reasoning_steps,
      confidence: Number(parsed.confidence) || 0.5,
      rejection_consequence: typeof parsed.rejection_consequence === "string" ? parsed.rejection_consequence : "",
      validated_transfer: Number(parsed.validated_transfer),
    };
  } catch (err) {
    console.error("groq reasoning failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
