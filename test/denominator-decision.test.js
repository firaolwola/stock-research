import test from "node:test";
import assert from "node:assert/strict";
import { decideReliabilityDenominator } from "../scripts/decide-reliability-denominator.js";

test("denominator decision selects one quality-reviewed row per unique frozen claim", async () => {
  const result = await decideReliabilityDenominator();
  assert.equal(result.denominator.claims, 14);
  assert.equal(result.denominator.supported, 14);
  assert.equal(result.denominator.missed, 0);
  assert.equal(result.denominator.recall, 1);
  assert.equal(result.denominator.exact_unique_claim_ids, true);
  assert.equal(result.denominator.quality_complete, true);
  assert.equal(result.gates.quality_dimensions, true);
  assert.equal(result.gates.overall_recall_established, false);
  assert.equal(result.gates.numeric_fcf_coverage_proven, false);
  assert.equal(result.gates.numeric_fcf_closure_required, false);
  assert.equal(result.gates.fcf_safety_gate_passed, true);
  assert.equal(result.gates.issue_55_must_remain_open, true);
  assert.ok(result.rows.every((row) => row.evidence_reference_ids.length > 0));
});
