import assert from "node:assert/strict";
import test from "node:test";
import { createSecEvidenceClient } from "../lib/sec-evidence.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";
import { loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema(); const validate = createReportValidator(schema);
const tickerMap = { fields: ["cik", "name", "ticker", "exchange"], data: [[123456, "Example Corp.", "ACME", "Nasdaq"]] };
const submissions = { name: "Example Corp.", formerNames: [{ name: "Old Example Corp.", from: "2020-01-01", to: "2022-01-01" }], filings: { recent: {
  accessionNumber: ["0000123456-26-000003", "0000123456-26-000002", "0000123456-26-000001"],
  form: ["8-K", "S-3", "10-Q"], filingDate: ["2026-08-24", "2026-08-20", "2026-08-15"], reportDate: ["2026-08-24", "2026-08-20", "2026-06-30"], primaryDocument: ["event.htm", "s3.htm", "q.htm"], items: ["8.01", "", ""]
} } };
const facts = { facts: { "us-gaap": {
  CashAndCashEquivalentsAtCarryingValue: { label: "Cash", units: { USD: [{ val: 5000000, end: "2026-06-30", filed: "2026-08-15", file: "2026-08-15", accn: "0000123456-26-000001", form: "10-Q" }] } },
  RevenueFromContractWithCustomerExcludingAssessedTax: { label: "Revenue", units: { USD: [{ val: 8000000, start: "2026-04-01", end: "2026-06-30", filed: "2026-08-15", file: "2026-08-15", accn: "0000123456-26-000001", form: "10-Q" }] } }
} } };

function fetchFixture(requests) {
  return async (url, options) => {
    requests.push({ url, options });
    const body = url.includes("company_tickers") ? tickerMap : url.includes("submissions") ? submissions : facts;
    return { ok: true, status: 200, async json() { return structuredClone(body); } };
  };
}

test("SEC Fast pipeline emits identity first, normalizes evidence, and validates", async () => {
  const requests = []; const progress = [];
  const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  const result = await client.researchTicker("ACME", { onProgress(value) { progress.push(value); } });
  const validation = validate(calibrateReportScores(result.report));
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  for (const item of progress) { const progressive = validate(calibrateReportScores(item.report)); assert.equal(progressive.valid, true, JSON.stringify(progressive.errors)); }
  assert.equal(requests.length, 3, JSON.stringify(requests.map((item) => item.url)));
  assert.ok(requests.every((request) => request.options.headers["User-Agent"].includes("stock-research")));
  assert.equal(progress[0].report.security.ticker, "ACME");
  assert.equal(progress[0].report.sections.dilution.state, "limited_coverage");
  assert.ok(result.evidence_records.some((record) => record.category === "security_and_listing"));
  assert.ok(result.evidence_records.some((record) => record.category === "issuer_lineage"));
  assert.ok(result.evidence_records.some((record) => record.category === "dilution_offerings"));
  assert.ok(result.evidence_records.some((record) => record.category === "financial_context"));
  assert.equal(result.operations.web_search_calls, 0);
  assert.equal(result.report.financial_assessment.metrics.cash.value, 5000000);
});

test("concurrent SEC requests share in-flight cache fetches", async () => {
  const requests = []; const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  await Promise.all([client.researchTicker("ACME"), client.researchTicker("ACME")]);
  assert.equal(requests.length, 3);
});

test("SEC cache avoids repeated network requests within TTL", async () => {
  const requests = []; const client = createSecEvidenceClient({ fetchImpl: fetchFixture(requests), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  await client.researchTicker("ACME"); await client.researchTicker("ACME");
  assert.equal(requests.length, 3);
  assert.deepEqual(client.getPacket("ACME").cache, { tickers: "hit", submissions: "hit", companyfacts: "hit" });
  assert.equal(client.getPacket("ACME").sec_request_count, 0);
});

test("unresolved ticker stays Pending without favorable evidence", async () => {
  const client = createSecEvidenceClient({ fetchImpl: async () => ({ ok: true, async json() { return { fields: tickerMap.fields, data: [] }; } }), now: () => Date.parse("2026-08-25T12:00:00Z"), minRequestIntervalMs: 0 });
  const result = await client.researchTicker("UNKNOWN"); const calibrated = calibrateReportScores(result.report);
  assert.equal(calibrated.security.evidence_state, "unknown");
  assert.equal(calibrated.scores.dilution_historical_severity.value, null);
});
