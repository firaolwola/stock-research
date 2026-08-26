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
  const common = { domain, identity: { ticker: report.security.ticker, issuer_legal_name: report.issuer.legal_name, cik: report.issuer.cik }, claims: report.claims, sources: report.sources };
  if (domain === "capital") Object.assign(common, { security: report.security, issuer: report.issuer });
  if (domain === "capital") return { ...common, reverse_splits: report.sections.reverse_splits, dilution: report.sections.dilution };
  if (domain === "financial") return { ...common, dividends: report.sections.dividends, financial_assessment: report.financial_assessment };
  const { historical_analogues, ...catalystAssessment } = report.catalyst_assessment;
  return { ...common, compliance_and_warnings: report.sections.compliance_and_warnings, catalyst_assessment: catalystAssessment };
}

test("Fast domain schemas are compact, distinct, and provider compatible", () => {
  for (const domain of Object.keys(FAST_DOMAINS)) {
    const projected = createFastDomainSchema(schema, domain);
    assert.equal(projected.properties.domain.const, domain);
    assert.ok(projected.properties.claims.maxItems <= 8);
    assert.equal(projected.properties.sources.maxItems, 4);
    assert.equal("security" in projected.properties, domain === "capital");
    assert.equal("score" in projected.$defs, false);
    if (domain !== "financial") assert.equal("financialAssessment" in projected.$defs, false);
    assert.deepEqual(findUnsupportedOpenAIKeywords(projected), []);
  }
});

test("three agreeing domain identities assemble a valid partial Fast report", () => {
  const report = assembleFastReport("ACME", Object.fromEntries(Object.keys(FAST_DOMAINS).map((domain) => [domain, { fragment: fragment(domain) }])), { generatedAt: "2026-08-25T12:00:00Z" });
  const calibrated = calibrateReportScores(report);
  const validation = validate(calibrated);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
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
  financial.identity.cik = "0009999999";
  financial.identity.issuer_legal_name = "Different Issuer Corp.";
  const report = assembleFastReport("ACME", { capital: { fragment: fragment("capital") }, financial: { fragment: financial } }, { generatedAt: "2026-08-25T12:00:00Z" });
  const calibrated = calibrateReportScores(report);
  assert.equal(validate(calibrated).valid, true);
  assert.equal(report.security.evidence_state, "unknown");
  assert.equal(report.claims.length, 0);
  assert.equal(report.sections.dilution.state, "unknown");
  assert.equal(calibrated.scores.dilution_historical_severity.value, null);
  assert.ok(report.metadata.coverage_limitations.some((item) => item.code.includes("identity-mismatch")));
});

test("representative compact fragments retain at least 35 percent rough output headroom", () => {
  for (const domain of Object.keys(FAST_DOMAINS)) {
    const value = fragment(domain);
    const claimIds = new Set();
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node.claim_ids)) node.claim_ids.forEach((id) => claimIds.add(id));
      for (const [key, child] of Object.entries(node)) if (!["claims", "sources"].includes(key)) visit(child);
    };
    visit(value);
    value.claims = value.claims.filter((claim) => claimIds.has(claim.id));
    const sourceIds = new Set(value.claims.flatMap((claim) => claim.source_ids));
    value.sources = value.sources.filter((source) => sourceIds.has(source.id));
    const roughTokens = Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4);
    assert.ok(roughTokens <= FAST_DOMAINS[domain].max_output_tokens * 0.65, `${domain}: ${roughTokens} rough tokens`);
  }
});
