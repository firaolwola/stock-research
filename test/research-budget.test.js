import assert from "node:assert/strict";
import test from "node:test";
import { buildResearchOperations, estimateResearchCost, parseResearchStage, RESEARCH_STAGES } from "../lib/research-budget.js";

test("research stages keep fast and deliberate deep budgets separate", () => {
  assert.deepEqual(parseResearchStage(undefined), { valid: true, stage: "fast" });
  assert.deepEqual(parseResearchStage("deep"), { valid: true, stage: "deep" });
  assert.equal(parseResearchStage("automatic").valid, false);
  assert.ok(RESEARCH_STAGES.deep.timeout_ms > RESEARCH_STAGES.fast.timeout_ms);
  assert.ok(RESEARCH_STAGES.deep.max_output_tokens > RESEARCH_STAGES.fast.max_output_tokens);
  assert.equal(RESEARCH_STAGES.fast.timeout_ms, RESEARCH_STAGES.fast.target_latency_ms.max);
  assert.equal(RESEARCH_STAGES.fast.first_useful_target_ms.max, 10_000);
  assert.ok(RESEARCH_STAGES.fast.max_tool_calls < RESEARCH_STAGES.deep.max_tool_calls);
});

test("cost estimation accounts for tokens, caching, and every web search", () => {
  const usage = { input_tokens: 10_000, output_tokens: 4_000, total_tokens: 14_000, input_tokens_details: { cached_tokens: 2_000 } };
  assert.equal(estimateResearchCost(usage, 2), 0.07025);
  const measured = buildResearchOperations({ stage: "fast", latencyMs: 5_000, usage, webSearchCalls: 2 });
  assert.equal(measured.within_latency_target, true);
  assert.equal(measured.within_cost_target, true);
  assert.equal(measured.pricing_version, "2026-08-25");
});

test("missing provider usage remains unknown instead of reporting zero cost", () => {
  const measured = buildResearchOperations({ stage: "fast", latencyMs: 2_000, usage: null, webSearchCalls: 0 });
  assert.equal(measured.estimated_cost_usd, null);
  assert.equal(measured.within_cost_target, null);
  assert.equal(measured.within_latency_target, true);
});

test("Fast records first-useful and complete latency targets separately", () => {
  const measured = buildResearchOperations({ stage: "fast", latencyMs: 18_000, firstUsefulLatencyMs: 12_000, usage: null, webSearchCalls: 4 });
  assert.equal(measured.latency_ms, 18_000);
  assert.equal(measured.within_latency_target, true);
  assert.equal(measured.within_first_useful_target, false);
});
