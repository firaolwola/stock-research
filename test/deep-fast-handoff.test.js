import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceFirstResearchClient } from "../evidence-first-research-client.js";
import { buildDeepPriorityPlan, mergeDeepWithFast } from "../lib/deep-fast-handoff.js";
import { createReportValidator } from "../lib/report-validation.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const validateReport = createReportValidator(await loadReportSchema());

async function fixtureResult({ partial = false, identityMismatch = false, providerFailure = false } = {}) {
  const report = await loadReportFixture("complete");
  report.metadata.stage = "fast";
  if (partial) {
    report.metadata.completion_status = "partial";
    report.sections.catalysts_and_news.state = "limited_coverage";
    report.metadata.coverage_limitations.push({ code: "bounded_source_unavailable", explanation: "A bounded source did not complete; SEC evidence remains usable.", affected_sections: ["catalysts_news"] });
  }
  const packet = {
    ticker: "ACME",
    identity: { ticker: "ACME", issuer_legal_name: report.issuer.legal_name, cik: identityMismatch ? "9999999999" : report.issuer.cik },
    records: [{ id: "evidence-sec-identity", category: "security_and_listing", text: "SEC identity", source_id: report.sources[0].id }],
    sources: structuredClone(report.sources)
  };
  return { report, evidence_packet: packet, evidence_records: packet.records, operations: { stage: "fast", retrieval: { sec_request_count: 3, cache: { submissions: "miss" } }, bounded_sources: { status: providerFailure ? "partial" : "completed", news: providerFailure ? "unavailable" : "completed", market: providerFailure ? "unavailable" : "completed", request_count: 2 } } };
}

async function harness({ nowRef = { value: 0 }, partial = false, identityMismatch = false, providerFailure = false, deepSecurityType = null } = {}) {
  const deterministic = await fixtureResult({ partial, identityMismatch, providerFailure });
  let secCalls = 0;
  const deepCalls = [];
  const secClient = { async researchTicker() { secCalls += 1; return structuredClone(deterministic); } };
  const deepClient = { async researchTicker(ticker, options) {
    deepCalls.push({ ticker, options });
    const report = await loadReportFixture("complete"); report.metadata.stage = "deep";
    if (deepSecurityType) report.security.security_type = deepSecurityType;
    return { report, operations: { stage: "deep", web_search_calls: 1 } };
  } };
  const client = createEvidenceFirstResearchClient({ secClient, deepClient, reportValidator: validateReport, now: () => nowRef.value, wallNow: () => 1_788_000_000_000 + nowRef.value });
  return { client, deepCalls, get secCalls() { return secCalls; } };
}

test("direct Deep builds and validates a Fast foundation before research", async () => {
  const subject = await harness();
  const result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(subject.secCalls, 1);
  assert.equal(subject.deepCalls.length, 1);
  assert.equal(result.operations.fast_foundation.mode, "built");
  assert.equal(result.operations.fast_foundation.status, "extended");
  assert.ok(result.operations.fast_foundation.reused_fast_evidence_count > 0);
  assert.equal(subject.deepCalls[0].options.seedEvidence.fast_report.metadata.stage, "fast");
});

test("Fast then Deep reuses a fresh packet and reports avoided retrieval", async () => {
  const subject = await harness();
  await subject.client.researchTicker("ACME", { stage: "fast" });
  const result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(subject.secCalls, 1);
  assert.equal(result.operations.fast_foundation.mode, "reused");
  assert.equal(result.operations.fast_foundation.freshness_status, "fresh");
  assert.equal(result.operations.fast_foundation.duplicate_retrieval_avoided, 5);
});

test("partially stale and stale packets refresh according to source freshness", async () => {
  const clock = { value: 0 }; const subject = await harness({ nowRef: clock });
  await subject.client.researchTicker("ACME", { stage: "fast" });
  clock.value = 120_001;
  let result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(result.operations.fast_foundation.mode, "refreshed_fast_moving");
  assert.deepEqual(result.operations.fast_foundation.stale_components, ["exchange", "news", "market"]);
  clock.value = 500_002;
  result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(result.operations.fast_foundation.mode, "rebuilt");
  assert.equal(subject.secCalls, 3);
});

test("a partial identity-safe Fast packet remains a usable Deep foundation", async () => {
  const subject = await harness({ partial: true });
  const result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(subject.deepCalls.length, 1);
  assert.equal(result.operations.fast_foundation.status, "extended");
  assert.ok(subject.deepCalls[0].options.priorityPlan.components.includes("catalysts_and_news"));
});

test("a bounded Fast provider failure preserves SEC evidence and still seeds Deep", async () => {
  const subject = await harness({ partial: true, providerFailure: true });
  const result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(subject.deepCalls.length, 1);
  assert.equal(subject.deepCalls[0].options.seedEvidence.fast_operations.bounded_sources.news, "unavailable");
  assert.equal(result.operations.fast_foundation.status, "extended");
});

test("identity disagreement blocks Deep and preserves the safe Fast fallback", async () => {
  const subject = await harness({ identityMismatch: true });
  const result = await subject.client.researchTicker("ACME", { stage: "deep" });
  assert.equal(subject.deepCalls.length, 0);
  assert.equal(result.operations.fast_foundation.status, "blocked_identity");
  assert.equal(result.report.metadata.completion_status, "partial");
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "deep_identity_blocked"));
});

test("Deep rejects a different confirmed security type even when issuer and ticker match", async () => {
  const subject = await harness({ deepSecurityType: "preferred_stock" });
  await assert.rejects(subject.client.researchTicker("ACME", { stage: "deep" }), (error) => error.code === "INVALID_RESEARCH_RESPONSE" && error.diagnostics.phase === "deep_identity_validation");
});

test("an unexpected Fast foundation failure becomes a controlled Deep error", async () => {
  const client = createEvidenceFirstResearchClient({
    secClient: { async researchTicker() { throw new TypeError("fixture failure"); } },
    deepClient: { async researchTicker() { assert.fail("Deep must not start"); } },
    reportValidator: validateReport,
    now: () => 10
  });
  await assert.rejects(client.researchTicker("ACME", { stage: "deep" }), (error) => error.code === "UPSTREAM_UNEXPECTED" && error.diagnostics.phase === "fast_foundation" && error.diagnostics.response_received === false);
});

test("Deep preserves conflicting Fast evidence and records explicit revision lineage", async () => {
  const fast = calibrateReportScores(await loadReportFixture("complete"));
  const deep = structuredClone(fast); deep.metadata.stage = "deep";
  deep.claims[0].text = `${deep.claims[0].text} Updated by later Deep evidence.`;
  const merged = mergeDeepWithFast(fast, deep);
  assert.ok(merged.report.claims.some((claim) => claim.id === fast.claims[0].id));
  assert.ok(merged.report.claims.some((claim) => claim.id.startsWith("claim-deep-")));
  assert.ok(merged.lineage.revisions.some((item) => item.kind === "claim_revision"));
  assert.ok(merged.report.metadata.coverage_limitations.some((item) => item.code === "deep_revision_lineage"));
});

test("a Deep conclusion change records the affected metric instead of silently replacing it", async () => {
  const fast = calibrateReportScores(await loadReportFixture("complete"));
  const deep = structuredClone(fast); deep.metadata.stage = "deep";
  deep.financial_assessment.metrics.cash.value = 42;
  const merged = mergeDeepWithFast(fast, deep);
  assert.ok(merged.lineage.revisions.some((item) => item.kind === "metric_revision" && item.component === "financial:cash"));
  assert.equal(merged.report.metadata.completion_status, "partial");
});

test("Deep priorities include unresolved Methodology 2.1 financial components", async () => {
  const report = calibrateReportScores(await loadReportFixture("partial"));
  const plan = buildDeepPriorityPlan(report);
  for (const key of ["financial_revenue_trend", "financial_net_income_trend", "financial_debt_trend", "financial_free_cash_flow_trend", "financial_cash_trend", "financial_operating_cash_flow_trend"]) assert.ok(plan.score_keys.includes(key), key);
});
