import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createReportValidator } from "../lib/report-validation.js";
import { buildPriorityFindings } from "../public/dashboard.js";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const schema = await load("../schema/stock-report.schema.json");
const complete = await load("../fixtures/reports/complete.json");
const partial = await load("../fixtures/reports/partial.json");
const scenarios = await load("../fixtures/financial/scenarios.json");
const validate = createReportValidator(schema);

function makeScenario(spec) {
  const report = structuredClone(spec.base === "partial" ? partial : complete);
  if (spec.id === "etf") {
    report.security.security_type = "etf";
    report.financial_assessment = {
      state: "not_applicable", as_of: null, reporting_currency: null,
      summary: "Operating-company financial metrics do not apply to this ETF.", coverage_notes: [],
      metrics: Object.fromEntries(Object.entries(report.financial_assessment.metrics).map(([key, metric]) => [key, { ...metric, state: "not_applicable", value: null, unit: null, period_start: null, period_end: null, trend: "not_applicable", comparison_period_start: null, comparison_period_end: null, observations: [], summary: `${metric.label} is not applicable to this ETF security.`, claim_ids: [] }])),
      going_concern: { state: "not_applicable", as_of: null, summary: "Issuer going-concern analysis is not applicable to this ETF security.", claim_ids: [] },
      material_warnings: []
    };
    report.sections.financial_context = { state: "not_applicable", summary: "Operating-company financial context is not applicable to this ETF.", coverage_notes: [], items: [], claim_ids: [] };
    for (const scoreName of ["financial_health", "long_term_company_quality"]) report.scores[scoreName] = { ...report.scores[scoreName], state: "not_applicable", value: null, explanation: "Operating-company assessment is not applicable to this ETF.", claim_ids: [], confidence: "unknown", components: [] };
    return report;
  }
  if (!spec.claim_text) return report;
  const claimId = `claim-financial-${spec.id}`;
  const sourceId = `source-financial-${spec.id}`;
  report.claims.push({ id: claimId, text: spec.claim_text, materiality: "high", state: "confirmed", as_of: "2026-08-24T15:00:00Z", source_ids: [sourceId] });
  report.sources.push({ id: sourceId, title: `${spec.id} fixed financial fixture`, url: `https://www.sec.gov/Archives/example/${spec.id}`, published_date: "2026-08-05", source_type: "sec_filing", confidence: "high", retrieved_at: "2026-08-24T15:00:00Z", supported_claim_ids: [claimId] });
  for (const [metricName, override] of Object.entries(spec.metric_overrides || {})) {
    const metric = report.financial_assessment.metrics[metricName]; Object.assign(metric, override, { claim_ids: [claimId] });
    const current = metric.observations?.at(-1); if (current && Object.hasOwn(override, "value")) { current.value = override.value; current.claim_ids = [claimId]; }
  }
  if (spec.going_concern) report.financial_assessment.going_concern = { ...spec.going_concern, claim_ids: [claimId] };
  if (spec.warning) report.financial_assessment.material_warnings.push({ ...spec.warning, claim_ids: [claimId] });
  return report;
}

for (const spec of scenarios) {
  test(`${spec.id} financial fixture is safe and valid`, () => {
    const report = makeScenario(spec);
    const result = validate(report);
    assert.equal(result.valid, true, `${spec.why}: ${JSON.stringify(result.errors)}`);
  });
}

test("confirmed values and trends retain periods, units, dates, and sources", () => {
  assert.notDeepEqual(complete.scores.financial_health.claim_ids, complete.scores.catalyst_strength.claim_ids);
  for (const metric of Object.values(complete.financial_assessment.metrics)) {
    assert.notEqual(metric.value, null);
    assert.ok(metric.unit && metric.period_start && metric.period_end);
    assert.ok(metric.comparison_period_start && metric.comparison_period_end);
    assert.ok(metric.claim_ids.every((id) => complete.claims.find((claim) => claim.id === id)?.source_ids.length));
  }
});

test("going-concern and leverage warnings rank ahead of other confirmed high-materiality risks", () => {
  for (const id of ["going-concern", "highly-leveraged"]) {
    const report = makeScenario(scenarios.find((scenario) => scenario.id === id));
    const findings = buildPriorityFindings(report);
    assert.ok(findings.findIndex((finding) => finding.id.startsWith("financial-")) < findings.findIndex((finding) => finding.id === "claim-dilution"));
  }
});

test("missing financial evidence cannot produce a favorable score", () => {
  const report = structuredClone(partial);
  report.scores.financial_health = { ...complete.scores.financial_health };
  assert.ok(validate(report).errors.some((error) => error.message.includes("cannot produce a confirmed financial-health score")));
});

test("invalid periods and unresolved numeric values are rejected", () => {
  const reversed = structuredClone(complete);
  reversed.financial_assessment.metrics.revenue.period_start = "2026-07-01";
  assert.ok(validate(reversed).errors.some((error) => error.message.includes("period start cannot be after end")));
  const unknownValue = structuredClone(partial);
  unknownValue.financial_assessment.metrics.cash.value = 10;
  unknownValue.financial_assessment.metrics.cash.unit = "USD millions";
  assert.ok(validate(unknownValue).errors.some((error) => error.message.includes("cannot contain a value or unit")));
});
