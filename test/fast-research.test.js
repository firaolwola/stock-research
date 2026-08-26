import assert from "node:assert/strict";
import test from "node:test";
import { assembleFastReport, createFastDomainSchema, FAST_DOMAINS } from "../lib/fast-research.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";
import { findUnsupportedOpenAIKeywords } from "../lib/openai-output-schema.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema();
const complete = await loadReportFixture("complete");
const validate = createReportValidator(schema);

function fragment(domain, report = complete) {
  const common = { domain, security: report.security, issuer: { ...report.issuer, prior_identities: domain === "capital" ? report.issuer.prior_identities : [] }, claims: report.claims, sources: report.sources };
  if (domain === "capital") return { ...common, reverse_splits: report.sections.reverse_splits, dilution: report.sections.dilution };
  if (domain === "financial") return { ...common, dividends: report.sections.dividends, financial_context: report.sections.financial_context, financial_assessment: report.financial_assessment };
  return { ...common, compliance_and_warnings: report.sections.compliance_and_warnings, catalysts_and_news: report.sections.catalysts_and_news, catalyst_assessment: { ...report.catalyst_assessment, historical_analogues: { state: "limited_coverage", summary: "Deferred to Deep.", coverage_notes: ["Deep only."], items: [], claim_ids: [] } } };
}

test("Fast domain schemas are compact, distinct, and provider compatible", () => {
  for (const domain of Object.keys(FAST_DOMAINS)) {
    const projected = createFastDomainSchema(schema, domain);
    assert.equal(projected.properties.domain.const, domain);
    assert.equal(projected.properties.claims.maxItems, 12);
    assert.equal(projected.properties.sources.maxItems, 6);
    assert.equal("score" in projected.$defs, false);
    if (domain !== "financial") assert.equal("financialAssessment" in projected.$defs, false);
    assert.deepEqual(findUnsupportedOpenAIKeywords(projected), []);
  }
});

test("three agreeing domain identities assemble a valid partial Fast report", () => {
  const report = assembleFastReport("ACME", Object.fromEntries(Object.keys(FAST_DOMAINS).map((domain) => [domain, { fragment: fragment(domain) }])), { generatedAt: "2026-08-25T12:00:00Z" });
  const calibrated = calibrateReportScores(report);
  assert.equal(validate(calibrated).valid, true);
  assert.equal(report.metadata.completion_status, "partial");
  assert.deepEqual(report.sections.dilution, complete.sections.dilution);
  assert.equal(report.catalyst_assessment.historical_analogues.state, "limited_coverage");
});

test("a missing domain remains Pending and cannot become favorable evidence", () => {
  const report = assembleFastReport("ACME", { capital: { fragment: fragment("capital") }, catalyst: { fragment: fragment("catalyst") } }, { generatedAt: "2026-08-25T12:00:00Z" });
  const calibrated = calibrateReportScores(report);
  assert.equal(validate(calibrated).valid, true);
  assert.equal(report.metadata.completion_status, "pending");
  assert.equal(report.financial_assessment.state, "unknown");
  assert.equal(calibrated.scores.financial_health.value, null);
  assert.notEqual(calibrated.scores.financial_health.state, "confirmed");
});

test("disagreeing issuer identity blocks all cross-domain evidence", () => {
  const financial = structuredClone(fragment("financial"));
  financial.issuer.cik = "0009999999";
  financial.issuer.legal_name = "Different Issuer Corp.";
  const report = assembleFastReport("ACME", { capital: { fragment: fragment("capital") }, financial: { fragment: financial } }, { generatedAt: "2026-08-25T12:00:00Z" });
  const calibrated = calibrateReportScores(report);
  assert.equal(validate(calibrated).valid, true);
  assert.equal(report.security.evidence_state, "unknown");
  assert.equal(report.claims.length, 0);
  assert.equal(report.sections.dilution.state, "unknown");
  assert.equal(calibrated.scores.dilution_historical_severity.value, null);
  assert.ok(report.metadata.coverage_limitations.some((item) => item.code.includes("identity-mismatch")));
});
