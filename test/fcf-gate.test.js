import test from "node:test";
import assert from "node:assert/strict";
import { buildFcfGate } from "../scripts/evaluate-fcf-gate.js";

test("Issue 81 keeps frozen FCF and independent controls in separate denominators", async () => {
  const result = await buildFcfGate();
  assert.equal(result.live_execution, false);
  assert.equal(result.denominators.frozen_same_five.recall, 0.6);
  assert.equal(result.denominators.frozen_same_five.immutable, true);
  assert.equal(result.denominators.independent_clean_controls.recall, 1);
  assert.equal(result.denominators.independent_clean_controls.pooled_with_frozen_same_five, false);
  assert.equal(result.denominators.fcf_semantics.numeric_coverage.recall, .4);
  assert.equal(result.denominators.fcf_semantics.numeric_coverage.gate_status, "coverage_not_proven");
  assert.equal(result.denominators.fcf_semantics.safe_unresolved_settlement.rate, 1);
  assert.equal(result.denominators.fcf_semantics.safe_unresolved_settlement.gate_status, "passed");
  assert.equal(result.denominators.fcf_semantics.coverage_limited_acceptance.accepted, false);
  assert.equal(result.denominators.fcf_semantics.coverage_limited_acceptance.parser_binding_gap_count, 1);
  assert.equal(result.denominators.fcf_semantics.coverage_limited_acceptance.numeric_coverage_remains_unproven, true);
  assert.equal(result.gate.passed, false);
  assert.equal(result.gate.issue_55_must_remain_open, true);
});

test("Issue 81 requires approval for any future live remeasurement", async () => {
  const result = await buildFcfGate();
  assert.equal(result.next_live_plan.requires_owner_approval, true);
  assert.equal(result.next_live_plan.max_runs, 5);
  assert.equal(result.next_live_plan.retries, 0);
  assert.equal(result.source_policy.ocf_only_is_not_fcf, true);
  assert.ok(result.miss_classifications.every((item) => ["retrieval", "normalization", "interpretation", "scoring", "explanation", "unavailable_evidence"].includes(item.cause)));
});
