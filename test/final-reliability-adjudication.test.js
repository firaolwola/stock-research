import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFinalAdjudication } from "../scripts/evaluate-final-reliability.js";

test("Issue 78 adjudication preserves frozen cohorts without pooling them", async () => {
  const result = await buildFinalAdjudication();
  assert.equal(result.live_execution, false);
  assert.equal(result.cohorts.length, 4);
  assert.equal(result.descriptive_comparison.pooling_allowed, false);
  assert.equal(result.gate.passed, false);
  assert.equal(result.gate.issue_55_must_remain_open, true);
  assert.deepEqual(result.gate.failing_categories, ["free_cash_flow_trend", "reverse_splits"]);
});

test("Issue 78 separates unavailable authoritative evidence from system misses", async () => {
  const result = await buildFinalAdjudication();
  const nio = result.unavailable_authoritative_evidence.find((item) => item.case.startsWith("NIO"));
  assert.equal(nio.classification, "unavailable_authoritative_evidence");
  assert.equal(nio.counted_as_system_miss, false);
  assert.ok(result.miss_classifications.every((item) => item.cause));
});

test("Issue 78 diagnostic artifact is generated from hash-audited inputs", async () => {
  const result = await buildFinalAdjudication();
  assert.ok(result.frozen_artifacts.length >= 10);
  assert.ok(result.frozen_artifacts.every((item) => /^[a-f0-9]{64}$/.test(item.sha256_lf_normalized)));
  const diagnostic = JSON.parse(await readFile(new URL("../evaluation/diagnostics/fast-reliability-final-2026-08-31.json", import.meta.url), "utf8"));
  assert.equal(diagnostic.adjudication_id, result.adjudication_id);
  assert.equal(diagnostic.gate.issue_55_must_remain_open, true);
});
