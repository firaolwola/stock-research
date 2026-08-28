import { readFile } from "node:fs/promises";
import { complianceRuleIds, projectComplianceStatement, resolveReportingPropertyCandidates } from "./evidence-binding.js";

const mutations = Object.freeze([
  { id: "original", apply: (text) => text },
  { id: "whitespace", apply: (text) => `  ${text.replaceAll(" ", "  ")}  ` },
  { id: "harmless-wrapper", apply: (text) => `Reviewed filing section. ${text} End of reviewed filing section.` }
]);

const matches = (actual, expected) => actual === expected;

export async function runOfflineAdversarialEvaluation({ fixturePath = new URL("../fixtures/evaluation/issue-55-adversarial.json", import.meta.url) } = {}) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const results = [];
  for (const testCase of fixture.cases) {
    for (const mutation of mutations) {
      const input = mutation.apply(testCase.text ?? testCase.statement);
      let passed = true; let actual;
      if (testCase.family === "compliance_projection") {
        actual = Object.fromEntries(complianceRuleIds(input).map((rule) => [rule, projectComplianceStatement(input, rule)]));
        for (const [rule, expectation] of Object.entries(testCase.expected.rules)) passed &&= actual[rule]?.includes(expectation.include) && !actual[rule]?.includes(expectation.exclude);
      } else {
        const resolution = resolveReportingPropertyCandidates([{ row: { accession: `fixture-${testCase.id}`, form: testCase.form, filed: "2026-08-28" }, cik: "fixture", ticker: testCase.id, text: input }]);
        actual = { accounting: resolution.accounting.value, accounting_state: resolution.accounting.state, security: resolution.security.value, venues: resolution.additional_listing_venues };
        passed = matches(actual.accounting, testCase.expected.accounting) && matches(actual.security, testCase.expected.security);
        if (testCase.expected.accounting_state) passed &&= matches(actual.accounting_state, testCase.expected.accounting_state);
        if (testCase.expected.venues) passed &&= JSON.stringify(actual.venues) === JSON.stringify(testCase.expected.venues);
      }
      results.push({ case_id: testCase.id, partition: testCase.partition, family: testCase.family, mutation: mutation.id, invariants: testCase.invariants, passed: Boolean(passed), actual });
    }
  }
  const failed = results.filter((item) => !item.passed);
  const summary = { seed: fixture.seed, fixture_count: fixture.cases.length, invariant_count: new Set(fixture.cases.flatMap((item) => item.invariants)).size, transformation_count: results.length, passed: results.filter((item) => item.passed).length, failed: failed.length, holdout: { total: results.filter((item) => item.partition === "holdout").length, passed: results.filter((item) => item.partition === "holdout" && item.passed).length }, by_family: Object.fromEntries([...new Set(results.map((item) => item.family))].map((family) => { const selected = results.filter((item) => item.family === family); return [family, { total: selected.length, passed: selected.filter((item) => item.passed).length }]; })), cross_property_contamination: failed.filter((item) => ["accounting_binding", "security_binding", "compliance_projection"].includes(item.family)).length, false_promotions: failed.filter((item) => item.family !== "compliance_projection" && [item.actual?.accounting, item.actual?.security].some((value) => value && value !== "unknown")).length, false_suppressions: failed.filter((item) => item.family !== "compliance_projection" && item.actual?.accounting === "unknown" && item.actual?.security === "unknown").length, lifecycle_projection: { total: results.filter((item) => item.family === "compliance_projection").length, passed: results.filter((item) => item.family === "compliance_projection" && item.passed).length }, canonical_event_metrics: "covered_by_existing_issue_55_regressions" };
  return { summary, results };
}
