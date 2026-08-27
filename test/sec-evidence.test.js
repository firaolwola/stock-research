import assert from "node:assert/strict";
import test from "node:test";
import { createSecEvidenceClient, getSafeSecDiagnostics } from "../lib/sec-evidence.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";
import { createFastBudgetController } from "../lib/fast-budget-controller.js";
import { loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema(); const validate = createReportValidator(schema);
const tickerMap = { fields: ["cik", "name", "ticker", "exchange"], data: [[123456, "Example Corp.", "ACME", "Nasdaq"]] };
const submissions = { name: "Example Corp.", formerNames: [{ name: "Old Example Corp.", from: "2020-01-01T05:00:00.000Z", to: "2022-01-01T05:00:00.000Z" }], filings: { recent: {
  accessionNumber: ["0000123456-26-000003", "0000123456-26-000002", "0000123456-26-000001"],
  form: ["8-K", "S-3", "10-Q"], filingDate: ["2026-08-24", "2026-08-20", "2026-08-15"], reportDate: ["2026-08-24", "2026-08-20", "2026-06-30"], primaryDocument: ["event.htm", "s3.htm", "q.htm"], items: ["8.01", "", ""]
} } };
const facts = { facts: { "us-gaap": {
  CashAndCashEquivalentsAtCarryingValue: { label: "Cash", units: { USD: [{ val: 5000000, end: "2026-06-30", filed: "2026-08-15", file: "2026-08-15", accn: "0000123456-26-000001", form: "10-Q" }] } },
  RevenueFromContractWithCustomerExcludingAssessedTax: { label: "Revenue", units: { USD: [{ val: 8000000, start: "2026-04-01", end: "2026-06-30", filed: "2026-08-15", file: "2026-08-15", accn: "0000123456-26-000001", form: "10-Q" }] } }
}, dei: {
  EntityCommonStockSharesOutstanding: { label: "Common shares outstanding", units: { shares: [
    { val: 100000000, end: "2026-03-31", filed: "2026-05-15", accn: "0000123456-26-000000", form: "10-Q" },
    { val: 120000000, end: "2026-06-30", filed: "2026-08-15", accn: "0000123456-26-000001", form: "10-Q" }
  ] } }
} } };
const documentText = {
  "event.htm": "The Company entered into a material supply contract with an initial committed value of $20 million.",
  "s3.htm": "The registrant may offer and sell from time to time up to $250 million of common stock and other securities.",
  "q.htm": "These conditions raise substantial doubt about the Company's ability to continue as a going concern."
};

function fetchFixture(requests, factsBody = facts) {
  return async (url, options) => {
    requests.push({ url, options });
    const name = new URL(url).pathname.split("/").at(-1); const body = url.includes("company_tickers") ? tickerMap : url.includes("submissions") ? submissions : factsBody;
    return { ok: true, status: 200, async json() { return structuredClone(body); }, async text() { return documentText[name] ?? "No material statement."; } };
  };
}

test("SEC Fast pipeline emits identity first, normalizes evidence, and validates", async () => {
  const requests = []; const progress = [];
  const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  const result = await client.researchTicker("ACME", { onProgress(value) { progress.push(value); } });
  const validation = validate(calibrateReportScores(result.report));
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  for (const item of progress) { const progressive = validate(calibrateReportScores(item.report)); assert.equal(progressive.valid, true, JSON.stringify(progressive.errors)); }
  assert.equal(requests.length, 6, JSON.stringify(requests.map((item) => item.url)));
  assert.ok(requests.every((request) => request.options.headers["User-Agent"].includes("stock-research")));
  assert.equal(progress[0].report.security.ticker, "ACME");
  assert.equal(progress[0].report.sections.dilution.state, "limited_coverage");
  assert.ok(result.evidence_records.some((record) => record.category === "security_and_listing"));
  assert.ok(result.evidence_records.some((record) => record.category === "issuer_lineage"));
  assert.ok(result.evidence_records.some((record) => record.category === "dilution_offerings"));
  assert.ok(result.evidence_records.some((record) => record.category === "financial_context"));
  assert.deepEqual(result.report.issuer.prior_identities.map(({ effective_from, effective_to }) => ({ effective_from, effective_to })), [{ effective_from: "2020-01-01", effective_to: "2022-01-01" }]);
  assert.equal(progress[0].operations.retrieval.status, "in_progress");
  assert.equal(result.operations.web_search_calls, 0);
  assert.equal(result.report.financial_assessment.metrics.cash.value, 5000000);
  assert.deepEqual(result.report.financial_assessment.shares_outstanding.observations.map((item) => item.value), [100000000, 120000000]);
  assert.match(result.report.financial_assessment.shares_outstanding.summary, /increased 20\.0%/);
  assert.equal(result.report.catalyst_assessment.current.state, "confirmed");
  assert.equal(result.report.financial_assessment.going_concern.state, "confirmed");
});

test("concurrent SEC requests share in-flight cache fetches", async () => {
  const requests = []; const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  await Promise.all([client.researchTicker("ACME"), client.researchTicker("ACME")]);
  assert.equal(requests.length, 6);
});

test("SEC cache avoids repeated network requests within TTL", async () => {
  const requests = []; const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  await client.researchTicker("ACME"); await client.researchTicker("ACME");
  assert.equal(requests.length, 6);
  assert.equal(client.getPacket("ACME").cache.tickers, "hit"); assert.equal(client.getPacket("ACME").cache.submissions, "hit"); assert.equal(client.getPacket("ACME").cache.companyfacts, "hit");
  assert.ok(client.getPacket("ACME").cache.documents.every((document) => document.state === "hit"));
  assert.equal(client.getPacket("ACME").sec_request_count, 0);
});

test("stale Company Facts periods produce a prominent sourced warning", async () => {
  const staleFacts = structuredClone(facts);
  for (const concept of Object.values(staleFacts.facts["us-gaap"])) for (const entries of Object.values(concept.units)) for (const fact of entries) { fact.start = fact.start ? "2025-10-01" : undefined; fact.end = "2025-12-31"; fact.filed = "2026-02-15"; }
  const client = createSecEvidenceClient({ fetchImpl: fetchFixture([], staleFacts), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  const result = await client.researchTicker("ACME"); const calibrated = calibrateReportScores(result.report); const validation = validate(calibrated);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.ok(result.report.financial_assessment.material_warnings.some((warning) => warning.id === "financial-stale-period" && warning.severity === "high"));
  assert.match(result.report.financial_assessment.coverage_notes.join(" "), /days before this Fast report/);
});

test("unresolved ticker stays Pending without favorable evidence", async () => {
  const client = createSecEvidenceClient({ fetchImpl: async () => ({ ok: true, async json() { return { fields: tickerMap.fields, data: [] }; } }), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  const result = await client.researchTicker("UNKNOWN"); const calibrated = calibrateReportScores(result.report);
  assert.equal(calibrated.security.evidence_state, "unknown");
  assert.equal(calibrated.scores.dilution_historical_severity.value, null);
});

test("ticker-map HTTP failure logs safe lifecycle diagnostics and stays Pending", async () => {
  const messages = [];
  const client = createSecEvidenceClient({
    fetchImpl: async () => ({ ok: false, status: 403, async text() { throw new Error("response body must not be read"); } }),
    now: (() => { let value = 1_000; return () => value += 25; })(), minRequestIntervalMs: 0,
    logger: { error(message) { messages.push(message); } }
  });
  const result = await client.researchTicker("SWVL");
  const diagnostic = result.operations.retrieval.failures[0];
  assert.deepEqual(diagnostic, { phase: "sec_ticker_map_request", endpoint_category: "ticker_map", elapsed_ms: 25, status: 403, constructor: "SecRetrievalError", name: "SecRetrievalError", code: null, cause_constructor: null, cause_name: null, cause_code: null, response_received: true, cache_state: "miss", request_count: 1 });
  assert.equal(result.operations.retrieval.status, "unavailable");
  assert.equal(result.report.security.evidence_state, "unknown");
  assert.equal(messages.length, 1); assert.match(messages[0], /"status":403/); assert.doesNotMatch(messages[0], /response body|authorization|User-Agent/i);
});

test("network failure reports its safe nested cause without exposing messages", async () => {
  const cause = Object.assign(new AggregateError([], "private provider detail"), { code: "EACCES" });
  const failure = new TypeError("fetch failed", { cause }); const messages = [];
  const client = createSecEvidenceClient({ fetchImpl: async () => { throw failure; }, minRequestIntervalMs: 0, logger: { error(message) { messages.push(message); } } });
  const result = await client.researchTicker("SWVL"); const diagnostic = result.operations.retrieval.failures[0];
  assert.equal(diagnostic.constructor, "TypeError"); assert.equal(diagnostic.cause_constructor, "AggregateError"); assert.equal(diagnostic.cause_code, "EACCES");
  assert.equal(diagnostic.response_received, false); assert.doesNotMatch(messages[0], /fetch failed|private provider detail/);
  assert.deepEqual(getSafeSecDiagnostics(failure).status, null);
});

test("hanging SEC retrieval is aborted by the shared deadline and settles safely", async () => {
  const client = createSecEvidenceClient({
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })),
    minRequestIntervalMs: 0,
    logger: { error() {} }
  });
  const budget = createFastBudgetController({ elapsedLimitMs: 40, finalizationReserveMs: 10 });
  const started = performance.now();
  const result = await client.researchTicker("ACME", { budget });
  assert.ok(performance.now() - started < 250);
  assert.equal(result.report.security.evidence_state, "unknown");
  assert.equal(result.operations.retrieval.status, "unavailable");
  assert.equal(budget.finish({ partial: true }).termination_reason, "time_ceiling");
});

test("one hanging SEC document does not discard evidence completed by other sources", async () => {
  const requests = [];
  const fixture = fetchFixture(requests);
  const client = createSecEvidenceClient({
    fetchImpl: async (url, options) => {
      if (url.endsWith("/q.htm")) return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
      return fixture(url, options);
    },
    minRequestIntervalMs: 0,
    logger: { error() {} }
  });
  const budget = createFastBudgetController({ elapsedLimitMs: 80, finalizationReserveMs: 10 });
  const result = await client.researchTicker("ACME", { budget });
  const calibrated = calibrateReportScores(result.report);
  assert.equal(validate(calibrated).valid, true);
  assert.equal(result.report.security.evidence_state, "limited_coverage");
  assert.equal(result.report.catalyst_assessment.current.state, "confirmed");
  assert.ok(result.evidence_records.length > 0);
  assert.equal(budget.finish({ partial: true }).termination_reason, "time_ceiling");
  assert.equal(calibrated.scores.financial_health.value, null);
});

const edgeFact = (val, { start, end = "2026-06-30", filed = "2026-08-15", accn = "0000123456-26-000001" } = {}) => ({ val, ...(start ? { start } : {}), end, filed, accn, form: "10-Q" });
const edgeConcept = (label, entries, unit = "USD") => ({ label, units: { [unit]: entries } });
const factsWith = (concepts, metadata = {}) => ({ ...metadata, facts: { "us-gaap": concepts } });

async function reportForFacts(factsBody) {
  const client = createSecEvidenceClient({ fetchImpl: fetchFixture([], factsBody), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  return client.researchTicker("ACME");
}

test("operating cash flow alone never populates free cash flow or burn/runway", async () => {
  const result = await reportForFacts(factsWith({
    CashAndCashEquivalentsAtCarryingValue: edgeConcept("Cash", [edgeFact(5_000_000)]),
    NetCashProvidedByUsedInOperatingActivities: edgeConcept("Operating cash flow", [edgeFact(-2_000_000, { start: "2026-01-01" })])
  }));
  const { metrics, coverage_notes: notes } = result.report.financial_assessment;
  assert.equal(metrics.free_cash_flow.state, "unknown"); assert.equal(metrics.free_cash_flow.value, null);
  assert.match(metrics.free_cash_flow.summary, /not inferred/); assert.equal(metrics.cash_burn.state, "unknown");
  assert.match(notes.join(" "), /Runway is not calculated/);
  assert.equal(calibrateReportScores(result.report).scores.financial_health.value, null);
});

for (const [name, tag] of [["current debt only", "LongTermDebtCurrent"], ["non-current debt only", "LongTermDebtNoncurrent"]]) {
  test(`${name} remains a labeled component rather than total debt`, async () => {
    const result = await reportForFacts(factsWith({ [tag]: edgeConcept(name, [edgeFact(3_000_000)]) }));
    const debt = result.report.financial_assessment.metrics.debt;
    assert.equal(debt.state, "limited_coverage"); assert.equal(debt.value, null); assert.equal(debt.label, "Total debt");
    assert.match(debt.summary, /total debt cannot be established/);
  });
}

test("aligned current and non-current components produce an explicit calculated total", async () => {
  const result = await reportForFacts(factsWith({
    LongTermDebtCurrent: edgeConcept("Current debt", [edgeFact(2_000_000)]),
    LongTermDebtNoncurrent: edgeConcept("Non-current debt", [edgeFact(7_000_000)])
  }));
  const debt = result.report.financial_assessment.metrics.debt;
  assert.equal(debt.state, "confirmed"); assert.equal(debt.value, 9_000_000); assert.match(debt.label, /Total debt/);
  assert.match(debt.summary, /current debt 2000000 plus non-current debt 7000000/);
});

test("debt components with conflicting periods or currencies remain unresolved", async () => {
  const result = await reportForFacts({ facts: { "us-gaap": {
    LongTermDebtCurrent: edgeConcept("Current debt", [edgeFact(2_000_000)], "USD"),
    LongTermDebtNoncurrent: edgeConcept("Non-current debt", [edgeFact(7_000_000, { end: "2026-03-31" })], "EUR")
  } } });
  assert.equal(result.report.financial_assessment.metrics.debt.state, "limited_coverage");
  assert.equal(result.report.financial_assessment.metrics.debt.value, null);
});

test("stale cash and conflicting latest facts cannot provide reassuring current liquidity", async () => {
  const stale = await reportForFacts(factsWith({ CashAndCashEquivalentsAtCarryingValue: edgeConcept("Cash", [edgeFact(5_000_000, { end: "2025-12-31", filed: "2026-02-15" })]) }));
  assert.equal(stale.report.financial_assessment.metrics.cash.state, "limited_coverage"); assert.equal(stale.report.financial_assessment.metrics.cash.value, null);
  const conflicting = await reportForFacts(factsWith({ CashAndCashEquivalentsAtCarryingValue: edgeConcept("Cash", [edgeFact(5_000_000), edgeFact(2_000_000)]) }));
  assert.equal(conflicting.report.financial_assessment.metrics.cash.state, "unknown"); assert.equal(conflicting.report.financial_assessment.metrics.cash.value, null);
});

test("aligned OCF and capital expenditures produce FCF while currency mismatch does not", async () => {
  const aligned = await reportForFacts(factsWith({
    NetCashProvidedByUsedInOperatingActivities: edgeConcept("OCF", [edgeFact(3_000_000, { start: "2026-01-01" })]),
    PaymentsToAcquirePropertyPlantAndEquipment: edgeConcept("Capex", [edgeFact(1_250_000, { start: "2026-01-01" })])
  }));
  assert.equal(aligned.report.financial_assessment.metrics.free_cash_flow.value, 1_750_000);
  const mismatch = await reportForFacts({ facts: { "us-gaap": {
    NetCashProvidedByUsedInOperatingActivities: edgeConcept("OCF", [edgeFact(3_000_000, { start: "2026-01-01" })], "USD"),
    PaymentsToAcquirePropertyPlantAndEquipment: edgeConcept("Capex", [edgeFact(1_250_000, { start: "2026-01-01" })], "EUR")
  } } });
  assert.equal(mismatch.report.financial_assessment.metrics.free_cash_flow.state, "unknown");
});

test("SEC financial observations retain only aligned comparable periods in chronological order", async () => {
  const result = await reportForFacts(factsWith({
    CashAndCashEquivalentsAtCarryingValue: edgeConcept("Cash", [edgeFact(5_000_000), edgeFact(4_000_000, { end: "2026-03-31", filed: "2026-05-10", accn: "0000123456-26-000000" })]),
    RevenueFromContractWithCustomerExcludingAssessedTax: edgeConcept("Revenue", [edgeFact(8_000_000, { start: "2026-04-01" }), edgeFact(6_500_000, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "0000123456-25-000001" }), edgeFact(20_000_000, { start: "2026-01-01", filed: "2026-08-14", accn: "0000123456-26-000009" })]),
    NetIncomeLoss: edgeConcept("Net income", [edgeFact(1_000_000, { start: "2026-04-01" }), edgeFact(250_000, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "0000123456-25-000001" })]),
    NetCashProvidedByUsedInOperatingActivities: edgeConcept("OCF", [edgeFact(3_000_000, { start: "2026-04-01" }), edgeFact(2_000_000, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "0000123456-25-000001" })]),
    PaymentsToAcquirePropertyPlantAndEquipment: edgeConcept("Capex", [edgeFact(1_250_000, { start: "2026-04-01" }), edgeFact(1_000_000, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "0000123456-25-000001" })]),
    LongTermDebtCurrent: edgeConcept("Current debt", [edgeFact(2_000_000), edgeFact(1_500_000, { end: "2026-03-31", filed: "2026-05-10", accn: "0000123456-26-000000" })]),
    LongTermDebtNoncurrent: edgeConcept("Non-current debt", [edgeFact(7_000_000), edgeFact(7_500_000, { end: "2026-03-31", filed: "2026-05-10", accn: "0000123456-26-000000" })])
  }));
  const metrics = result.report.financial_assessment.metrics;
  assert.deepEqual(metrics.cash.observations.map((item) => item.value), [4_000_000, 5_000_000]);
  assert.deepEqual(metrics.revenue.observations.map((item) => item.value), [6_500_000, 8_000_000]);
  assert.deepEqual(metrics.free_cash_flow.observations.map((item) => item.value), [1_000_000, 1_750_000]);
  assert.deepEqual(metrics.debt.observations.map((item) => item.value), [9_000_000, 9_000_000]);
  assert.equal(metrics.revenue.observations.some((item) => item.period_start === "2026-01-01"), false, "YTD revenue is not comparable to a quarter");
  const validation = validate(calibrateReportScores(result.report)); assert.equal(validation.valid, true, JSON.stringify(validation.errors));
});

test("SEC identity confirms the issuer but leaves unsupported security semantics unresolved", async () => {
  const result = await reportForFacts(facts);
  assert.equal(result.report.issuer.identity_state, "confirmed");
  assert.equal(result.report.security.evidence_state, "limited_coverage");
  assert.equal(result.report.security.security_type, "unknown"); assert.equal(result.report.security.listing_status, "unknown");
  assert.equal(result.report.issuer.prior_identities[0].name, "Old Example Corp.");
});

test("wrong Company Facts issuer is a hard identity failure", async () => {
  await assert.rejects(reportForFacts({ cik: 999999, entityName: "Other Issuer", facts: {} }), { name: "SecIdentityMismatchError", code: "SEC_IDENTITY_MISMATCH" });
});

test("incomplete selected-filing extraction remains limited and cannot reassure scores", async () => {
  const fixture = fetchFixture([], factsWith({}));
  const client = createSecEvidenceClient({
    fetchImpl: async (url, options) => url.includes("/Archives/")
      ? { ok: true, status: 200, async text() { return "Selected filing text did not yield a safely classified material-risk statement."; } }
      : fixture(url, options),
    now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0
  });
  const result = await client.researchTicker("ACME"); const calibrated = calibrateReportScores(result.report);
  assert.equal(result.report.sections.reverse_splits.state, "limited_coverage");
  assert.equal(result.report.sections.dilution.state, "limited_coverage");
  assert.equal(result.report.sections.compliance_and_warnings.state, "limited_coverage");
  assert.equal(result.report.financial_assessment.going_concern.state, "unknown");
  assert.equal(calibrated.scores.reverse_split_risk.value, null);
  assert.equal(calibrated.scores.financial_health.value, null);
});
