import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReverseSplitAdjudication } from "../scripts/evaluate-reverse-split-adjudication.js";

test("offline reverse-split adjudication reports complete canonical recall and precision", async () => {
  const result = await buildReverseSplitAdjudication();
  assert.equal(result.offline, true);
  assert.equal(result.network_calls, false);
  assert.equal(result.independent_positive_cases, 5);
  assert.equal(result.denominator.expected_completed_events, 15);
  assert.equal(result.denominator.recall, 1);
  assert.equal(result.denominator.precision, 1);
  assert.equal(result.safe_settlement.rate, 1);
  assert.equal(result.safe_settlement.severe_misses, 0);
  assert.deepEqual(result.cases.find((item) => item.ticker === "MULN").false_positive_events, []);
});

test("offline reverse-split adjudication uses a non-overlapping five-case denominator", async () => {
  const source = await readFile(new URL("../scripts/evaluate-reverse-split-adjudication.js", import.meta.url), "utf8");
  assert.match(source, /independent_positive_cases/);
  assert.match(source, /canonical_precision/);
  assert.match(source, /frozen_artifacts_modified: false/);
  assert.match(source, /network_calls: false/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.match(source, /1-for-400/);
  assert.match(source, /1-for-250/);
});
