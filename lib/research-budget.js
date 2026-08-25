export const RESEARCH_STAGES = Object.freeze({
  fast: Object.freeze({
    stage: "fast",
    target_latency_ms: Object.freeze({ min: 3_000, max: 10_000 }),
    grace_ms: 20_000,
    timeout_ms: 30_000,
    max_output_tokens: 5_000,
    max_tool_calls: 4,
    search_context_size: "low",
    target_cost_usd: 0.10
  }),
  deep: Object.freeze({
    stage: "deep",
    target_latency_ms: null,
    grace_ms: null,
    timeout_ms: 60_000,
    max_output_tokens: 10_000,
    max_tool_calls: 10,
    search_context_size: "medium",
    target_cost_usd: null
  })
});

// Pricing snapshot for the configured model. Keep this versioned and review it
// against the official pricing page before interpreting a paid measurement.
export const PRICING_SNAPSHOT = Object.freeze({
  version: "2026-08-25",
  model: "gpt-5.1",
  input_per_million_usd: 1.25,
  cached_input_per_million_usd: 0.125,
  output_per_million_usd: 10,
  web_search_per_call_usd: 0.01,
  source_url: "https://developers.openai.com/api/docs/pricing"
});

export function parseResearchStage(value) {
  const stage = value === undefined ? "fast" : String(value).trim().toLowerCase();
  return RESEARCH_STAGES[stage] ? { valid: true, stage } : { valid: false, stage: null };
}

export function estimateResearchCost(usage, webSearchCalls, pricing = PRICING_SNAPSHOT) {
  if (!usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens) || !Number.isInteger(webSearchCalls)) return null;
  const cached = Math.min(usage.input_tokens, Math.max(0, usage.input_tokens_details?.cached_tokens || 0));
  const uncached = usage.input_tokens - cached;
  return Number((
    uncached * pricing.input_per_million_usd / 1_000_000 +
    cached * pricing.cached_input_per_million_usd / 1_000_000 +
    usage.output_tokens * pricing.output_per_million_usd / 1_000_000 +
    webSearchCalls * pricing.web_search_per_call_usd
  ).toFixed(6));
}

export function buildResearchOperations({ stage, latencyMs, usage = null, webSearchCalls = 0, pricing = PRICING_SNAPSHOT }) {
  const budget = RESEARCH_STAGES[stage];
  const estimatedCost = estimateResearchCost(usage, webSearchCalls, pricing);
  return {
    stage,
    latency_ms: Math.max(0, Math.round(latencyMs)),
    input_tokens: usage?.input_tokens ?? null,
    output_tokens: usage?.output_tokens ?? null,
    total_tokens: usage?.total_tokens ?? null,
    web_search_calls: webSearchCalls,
    estimated_cost_usd: estimatedCost,
    pricing_version: estimatedCost === null ? null : pricing.version,
    within_latency_target: stage === "fast" ? latencyMs <= budget.target_latency_ms.max : null,
    within_cost_target: stage === "fast" && estimatedCost !== null ? estimatedCost <= budget.target_cost_usd : null
  };
}
