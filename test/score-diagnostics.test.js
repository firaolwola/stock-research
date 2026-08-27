import assert from "node:assert/strict";
import test from "node:test";
import { buildScoreRangeDiagnostics } from "../scripts/diagnose-fast-score-ranges.js";

test("score-range diagnostics explain failed confirmed and Limited cases without changing methodology", () => {
  const report = { claims: [], sources: [], financial_assessment: { metrics: { revenue: { state: "confirmed", value: 10, unit: "USD", claim_ids: [], observations: [{ period_start: "2025-01-01", period_end: "2025-12-31", value: 10, unit: "USD", claim_ids: [] }], annual_observations: [] } } }, scores: {
    financial_revenue_trend: { state: "limited_coverage", value: null, confidence: "unknown", explanation: "At least two comparable SEC-derived observations are required.", claim_ids: [], components: [] }
  } };
  const result = buildScoreRangeDiagnostics({ cases: [{ ticker: "TEST", score_ranges: { revenue: [7, 10] } }] }, new Map([["TEST", { report }]]));
  assert.equal(result.methodology_version, "2.1.0"); assert.equal(result.failed_cases.length, 1);
  assert.equal(result.failed_cases[0].classification, "legitimately Limited");
  assert.deepEqual(result.failed_cases[0].expected_owner_range, [7, 10]);
  assert.equal(result.failed_cases[0].normalized_inputs.observations.length, 1);
});
