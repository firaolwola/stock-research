import assert from "node:assert/strict";
import test from "node:test";
import { projectComplianceStatement, resolveReportingPropertyCandidates } from "../lib/evidence-binding.js";
import { runOfflineAdversarialEvaluation } from "../lib/offline-adversarial-evaluation.js";

test("offline adversarial corpus passes every development mutation and untouched holdout", async () => {
  const evaluation = await runOfflineAdversarialEvaluation();
  assert.equal(evaluation.summary.fixture_count, 12);
  assert.ok(evaluation.summary.invariant_count >= 12);
  assert.equal(evaluation.summary.failed, 0);
  assert.equal(evaluation.summary.holdout.passed, evaluation.summary.holdout.total);
  assert.equal(evaluation.summary.cross_property_contamination, 0);
  assert.equal(evaluation.summary.false_promotions, 0);
  assert.equal(evaluation.summary.false_suppressions, 0);
});

test("incidental property keywords cannot promote reporting properties", () => {
  const result = resolveReportingPropertyCandidates([{ row: { accession: "holdout", form: "40-F", filed: "2026-01-01" }, text: "The financial statements are prepared in accordance with IFRS Accounting Standards as issued by the IASB. An unrelated example mentions U.S. GAAP and American Depositary Shares." }]);
  assert.equal(result.accounting.value, "IFRS");
  assert.equal(result.security.value, "unknown");
  assert.ok(result.candidates.every((item) => item.source_span && item.accession && item.form));
});

test("mixed-rule projection excludes the other rule from each explanation", () => {
  const statement = "Rule 5550(b)(1), the stockholders' equity requirement, remains active. Rule 5550(a)(2), the minimum bid requirement, is closed.";
  assert.doesNotMatch(projectComplianceStatement(statement, "nasdaq_5550_b_1_stockholders_equity"), /5550\(a\)\(2\)/);
  assert.doesNotMatch(projectComplianceStatement(statement, "nasdaq_5550_a_2_minimum_bid"), /5550\(b\)\(1\)/);
});
