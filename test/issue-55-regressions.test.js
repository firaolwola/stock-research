import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import { finalizeResearchReport } from "../lib/finalize-research-report.js";
import { createReportValidator } from "../lib/report-validation.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { boundedDocumentRows, createSecEvidenceClient } from "../lib/sec-evidence.js";
import { extractSecFilingEvidence } from "../lib/sec-filing-extraction.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";
import { withTestServer } from "../support/test-server.js";

const schema = await loadReportSchema();
const reportValidator = createReportValidator(schema);
const fact = (val, { start, end, filed = "2026-08-15", form = "10-Q", accn = "0000000001-26-000001", frame } = {}) => ({ val, ...(start ? { start } : {}), end, filed, form, accn, ...(frame ? { frame } : {}) });
const concept = (label, entries, unit = "USD") => ({ label, units: { [unit]: entries } });

function secFixture({ ticker = "TEST", cik = 1, companyFacts, filings = [], archivedFilings = {}, documents = {} }) {
  const padded = String(cik).padStart(10, "0");
  const tickerMap = { fields: ["cik", "name", "ticker", "exchange"], data: [[cik, `${ticker} Corp.`, ticker, "Nasdaq"]] };
  const recent = { accessionNumber: [], form: [], filingDate: [], reportDate: [], primaryDocument: [], items: [], primaryDocDescription: [] };
  for (const filing of filings) for (const key of Object.keys(recent)) recent[key].push(filing[key] ?? "");
  const submissions = { cik: padded, name: `${ticker} Corp.`, filings: { recent, files: Object.keys(archivedFilings).map((name) => ({ name, filingFrom: "2021-01-01", filingTo: "2024-12-31" })) } };
  return async (url) => {
    const pathname = new URL(url).pathname; const name = pathname.split("/").at(-1);
    const body = pathname.includes("company_tickers") ? tickerMap : pathname.includes("/submissions/") ? (archivedFilings[name] ?? submissions) : companyFacts;
    return { ok: true, status: 200, async json() { return structuredClone(body); }, async text() { return documents[name] ?? "No classified material event."; } };
  };
}

async function researchFixture(options) {
  const client = createSecEvidenceClient({ fetchImpl: secFixture(options), now: () => Date.parse("2026-08-27T12:00:00Z"), minRequestIntervalMs: 0 });
  return client.researchTicker(options.ticker ?? "TEST");
}

test("AAPL, AMC, NCPL, NXL, and SMCI-style same-end duration facts select the quarter without conflict", async (t) => {
  for (const ticker of ["AAPL", "AMC", "NCPL", "NXL", "SMCI"]) await t.test(ticker, async () => {
    const result = await researchFixture({ ticker, companyFacts: { cik: 1, entityName: `${ticker} Corp.`, facts: { "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: concept("Revenue", [
        fact(120, { start: "2026-04-01", end: "2026-06-30", frame: "CY2026Q2" }),
        fact(300, { start: "2026-01-01", end: "2026-06-30" }),
        fact(100, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior", frame: "CY2025Q2" }),
        fact(250, { start: "2025-01-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior" })
      ]),
      NetIncomeLoss: concept("Net income", [
        fact(12, { start: "2026-04-01", end: "2026-06-30", frame: "CY2026Q2" }),
        fact(25, { start: "2026-01-01", end: "2026-06-30" }),
        fact(8, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior", frame: "CY2025Q2" })
      ])
    } } } });
    assert.equal(result.report.financial_assessment.metrics.revenue.value, 120);
    assert.deepEqual(result.report.financial_assessment.metrics.revenue.observations.map((item) => item.value), [100, 120]);
    assert.equal(result.report.financial_assessment.metrics.profitability.value, 12);
    assert.equal(calibrateReportScores(result.report).scores.financial_revenue_trend.state, "confirmed");
  });
});

test("NXL-style alternate SEC revenue taxonomy remains authoritative and scoreable", async () => {
  const result = await researchFixture({ ticker: "NXL", companyFacts: { cik: 1, entityName: "NXL Corp.", facts: { "us-gaap": {
    SalesRevenueNet: concept("Sales revenue, net", [
      fact(12, { start: "2026-04-01", end: "2026-06-30", frame: "CY2026Q2" }),
      fact(10, { start: "2025-04-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior", frame: "CY2025Q2" })
    ])
  } } } });
  assert.equal(result.report.financial_assessment.metrics.revenue.value, 12);
  assert.equal(calibrateReportScores(result.report).scores.financial_revenue_trend.state, "confirmed");
});

test("bounded filing selection reserves older split, accounting, listing, and control slots", () => {
  const row = (accession, form, filed, items = "", description = "") => ({ accession, form, filed, items, description, document: `${accession}.htm` });
  const selected = boundedDocumentRows([
    row("recent", "8-K", "2026-08-20", "8.01"), row("periodic", "10-Q", "2026-08-10"), row("annual", "10-K", "2026-02-10"),
    row("amc-split", "8-K", "2023-08-24", "5.03", "Reverse split"), row("ncpl-accounting", "8-K", "2025-12-01", "4.02", "Non-Reliance"),
    row("smci-listing", "8-K", "2025-02-20", "3.01", "Nasdaq compliance"), row("smci-controls", "10-Q", "2026-05-11", "", "Material weakness")
  ], "2026-08-27T12:00:00Z");
  for (const accession of ["amc-split", "ncpl-accounting", "smci-listing", "smci-controls"]) assert.ok(selected.some((item) => item.accession === accession), accession);
  assert.ok(selected.length <= 12);
});

test("AMC completed reverse split is historical while NXL authorization is not", () => {
  const completed = extractSecFilingEvidence({ html: "The Company effected a reverse stock split at a ratio of 1-for-10, effective August 24, 2023.", form: "8-K", filed: "2023-08-24", accession: "amc", documentUrl: "https://www.sec.gov/amc.htm", documentName: "amc.htm" }).find((item) => item.kind === "reverse_split");
  const authorized = extractSecFilingEvidence({ html: "Stockholders approved and authorized the board to effectuate a 1-for-30 reverse stock split in the future.", form: "DEF 14A", filed: "2026-07-01", accession: "nxl", documentUrl: "https://www.sec.gov/nxl.htm", documentName: "nxl.htm" }).find((item) => item.kind === "reverse_split");
  assert.equal(completed.action_state, "completed"); assert.equal(completed.split_factor, .1);
  assert.equal(authorized.action_state, "authorized");
});

test("AAPL effective-control opinion is a negative control while SMCI explicit weakness remains a warning", () => {
  const extract = (html) => extractSecFilingEvidence({ html, form: "10-K", filed: "2025-10-31", accession: "control", documentUrl: "https://www.sec.gov/control.htm", documentName: "control.htm" });
  assert.equal(extract("Internal control over financial reporting was maintained in all material respects. The audit assessed the risk that a material weakness exists and concluded the company maintained effective internal control over financial reporting.").some((item) => item.kind === "accounting_warning"), false);
  assert.equal(extract("Management concluded that internal control over financial reporting was not effective because we identified material weaknesses that remained unremediated.").some((item) => item.kind === "accounting_warning"), true);
});

test("NXL split timing is scheduled before its effective date and completed afterward", () => {
  const html = "The Company filed an amendment to effectuate a 1-for-30 reverse stock split. The Reverse Stock Split will become effective on August 28, 2026 and trading is expected to begin on a split-adjusted basis on August 31, 2026.";
  const extract = (evaluatedAt) => extractSecFilingEvidence({ html, form: "8-K", filed: "2026-08-27", evaluatedAt, accession: "nxl", documentUrl: "https://www.sec.gov/nxl.htm", documentName: "nxl.htm" }).find((item) => item.kind === "reverse_split");
  assert.equal(extract("2026-08-27T12:00:00Z").action_state, "scheduled");
  assert.equal(extract("2026-08-29T12:00:00Z").action_state, "completed");
  const proposed = extractSecFilingEvidence({ html: "The board proposed a 1-for-20 reverse stock split, subject to stockholder approval.", form: "PRE 14A", filed: "2026-08-01", evaluatedAt: "2026-08-27T12:00:00Z", accession: "proposal", documentUrl: "https://www.sec.gov/proposal.htm", documentName: "proposal.htm" }).find((item) => item.kind === "reverse_split");
  assert.equal(proposed.action_state, "proposed");
});

test("SMCI listing covenant is informational while an actual Nasdaq notice is active", () => {
  const extract = (html) => extractSecFilingEvidence({ html, form: "10-K", filed: "2026-08-01", accession: "listing", documentUrl: "https://www.sec.gov/listing.htm", documentName: "listing.htm" });
  assert.equal(extract("The credit facility requires continuous Nasdaq listing; noncompliance with this financing covenant may accelerate repayment.").some((item) => item.kind === "exchange_compliance"), false);
  const active = extract("Nasdaq notified the Company that it was not in compliance with the minimum bid price requirement and provided a 180-day compliance period.").find((item) => item.kind === "exchange_compliance");
  assert.equal(active.resolution_state, "active");
});

test("AMC historical submissions chunk supplies the completed authoritative split", async () => {
  const archive = { accessionNumber: ["0000000001-23-000001"], form: ["8-K"], filingDate: ["2023-08-24"], reportDate: ["2023-08-24"], primaryDocument: ["split.htm"], items: ["5.03"], primaryDocDescription: ["Reverse split"] };
  const result = await researchFixture({ ticker: "AMC", archivedFilings: { "CIK0000000001-submissions-001.json": archive }, documents: { "split.htm": "The Company effected a reverse stock split at a ratio of 1-for-10, effective August 24, 2023." } });
  const split = result.report.sections.reverse_splits.items[0];
  assert.equal(split.title, "Completed 1-for-10 reverse split"); assert.equal(split.corporate_action_state, "completed");
});

test("AMC and NXL OCF without aligned SEC capex remain honestly Limited FCF", async () => {
  for (const ticker of ["AMC", "NXL"]) {
    const result = await researchFixture({ ticker, companyFacts: { cik: 1, entityName: `${ticker} Corp.`, facts: { "us-gaap": { NetCashProvidedByUsedInOperatingActivities: concept("OCF", [fact(-8, { start: "2026-01-01", end: "2026-06-30" }), fact(-4, { start: "2025-01-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior" })]) } } } });
    assert.equal(result.report.financial_assessment.metrics.free_cash_flow.state, "unknown");
    assert.match(result.report.financial_assessment.metrics.free_cash_flow.summary, /aligned capital expenditures are not/);
    assert.equal(calibrateReportScores(result.report).scores.financial_free_cash_flow_trend.value, null);
  }
});

test("AMC issuance growth survives reverse-split adjustment", async () => {
  const result = await researchFixture({ ticker: "AMC", filings: [
    { accessionNumber: "0000000001-26-000001", form: "10-Q", filingDate: "2026-08-01", reportDate: "2026-06-30", primaryDocument: "quarter.htm", items: "" },
    { accessionNumber: "0000000001-23-000001", form: "8-K", filingDate: "2023-08-24", reportDate: "2023-08-24", primaryDocument: "split.htm", items: "5.03", primaryDocDescription: "Reverse split" }
  ], documents: { "split.htm": "The Company effected a reverse stock split at a ratio of 1-for-10, effective August 24, 2023." }, companyFacts: { cik: 1, entityName: "AMC Corp.", facts: { dei: { EntityCommonStockSharesOutstanding: concept("Shares", [fact(500_000_000, { end: "2022-12-31", filed: "2023-02-01", form: "10-K", accn: "old" }), fact(900_000_000, { end: "2026-07-20" })], "shares") } } } });
  const shares = result.report.financial_assessment.shares_outstanding;
  assert.deepEqual(shares.observations.map((item) => item.value), [50_000_000, 900_000_000]);
  assert.match(shares.summary, /Split-adjusted reported shares outstanding increased 1700\.0%/);
  assert.equal(result.report.sections.reverse_splits.items[0].corporate_action_state, "completed");
});

test("SMCI forward split is normalized instead of labeled dilution", async () => {
  const result = await researchFixture({ ticker: "SMCI", filings: [{ accessionNumber: "0000000001-24-000001", form: "8-K", filingDate: "2024-09-30", reportDate: "2024-09-30", primaryDocument: "forward.htm", items: "5.03", primaryDocDescription: "Stock split" }], documents: { "forward.htm": "The Company effected a ten-for-one forward stock split, effective October 1, 2024." }, companyFacts: { cik: 1, entityName: "SMCI Corp.", facts: { dei: { EntityCommonStockSharesOutstanding: concept("Shares", [fact(52_000_000, { end: "2023-07-31", filed: "2023-08-30", form: "10-K", accn: "old" }), fact(594_000_000, { end: "2025-07-31", filed: "2025-08-30", form: "10-K" })], "shares") } } } });
  const shares = result.report.financial_assessment.shares_outstanding;
  assert.deepEqual(shares.observations.map((item) => item.value), [520_000_000, 594_000_000]);
  assert.match(shares.summary, /increased 14\.2%/); assert.doesNotMatch(shares.summary, /1035/);
});

test("split-unresolved shares settle Limited with no scoreable observations and remain valid", async () => {
  const result = await researchFixture({ ticker: "SMCI", companyFacts: { cik: 1, entityName: "SMCI Corp.", facts: { dei: {
    EntityCommonStockSharesOutstanding: concept("Shares", [fact(52_000_000, { end: "2023-07-31", filed: "2023-08-30", form: "10-K", accn: "old" }), fact(594_000_000, { end: "2025-07-31", filed: "2025-08-30", form: "10-K" })], "shares")
  } } } });
  const shares = result.report.financial_assessment.shares_outstanding;
  assert.equal(shares.state, "limited_coverage"); assert.deepEqual(shares.observations, []); assert.deepEqual(shares.annual_observations, []);
  assert.match(shares.summary, /unexplained discontinuity/);
  assert.equal(reportValidator(calibrateReportScores(result.report)).valid, true);
});

test("NCPL non-reliance invalidates affected financial trend scoring", async () => {
  const result = await researchFixture({ ticker: "NCPL", filings: [{ accessionNumber: "0000000001-26-000002", form: "8-K", filingDate: "2026-08-18", reportDate: "2026-08-18", primaryDocument: "nonreliance.htm", items: "4.02", primaryDocDescription: "Non-Reliance" }], documents: { "nonreliance.htm": "Item 4.02 Non-Reliance on Previously Issued Financial Statements. The Audit Committee concluded that previously issued financial statements should no longer be relied upon and require restatement." }, companyFacts: { cik: 1, entityName: "NCPL Corp.", facts: { "us-gaap": { NetCashProvidedByUsedInOperatingActivities: concept("OCF", [fact(-8, { start: "2026-01-01", end: "2026-06-30" }), fact(-4, { start: "2025-01-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior" })]) } } } });
  const report = calibrateReportScores(result.report);
  assert.equal(result.report.financial_assessment.metrics.operating_cash_flow.state, "limited_coverage");
  assert.equal(report.scores.financial_operating_cash_flow_trend.value, null);
  assert.ok(result.report.financial_assessment.material_warnings.some((item) => item.severity === "critical"));
});

test("SMCI material weakness is retained and recent OCF/FCF deterioration outranks older annual history", async () => {
  const annual = (value, year) => fact(value, { start: `${year}-07-01`, end: `${year + 1}-06-30`, filed: `${year + 1}-08-28`, form: "10-K", accn: `annual-${year}` });
  const result = await researchFixture({ ticker: "SMCI", filings: [{ accessionNumber: "0000000001-26-000001", form: "10-Q", filingDate: "2026-05-11", reportDate: "2026-03-31", primaryDocument: "quarter.htm", items: "" }], documents: { "quarter.htm": "Management concluded that internal control over financial reporting was not effective because material weaknesses remained unremediated." }, companyFacts: { cik: 1, entityName: "SMCI Corp.", facts: { "us-gaap": {
    NetCashProvidedByUsedInOperatingActivities: concept("OCF", [fact(-7_556, { start: "2025-07-01", end: "2026-03-31", filed: "2026-05-11" }), fact(796, { start: "2024-07-01", end: "2025-03-31", filed: "2025-05-11", accn: "prior" }), annual(-441, 2021), annual(664, 2022), annual(-2486, 2023), annual(1660, 2024)]),
    PaymentsToAcquirePropertyPlantAndEquipment: concept("Capex", [fact(134, { start: "2025-07-01", end: "2026-03-31", filed: "2026-05-11" }), fact(105, { start: "2024-07-01", end: "2025-03-31", filed: "2025-05-11", accn: "prior" }), annual(45, 2021), annual(37, 2022), annual(124, 2023), annual(127, 2024)])
  } } } });
  const report = calibrateReportScores(result.report);
  assert.ok(result.report.financial_assessment.material_warnings.some((item) => /Material weakness|ineffective controls/i.test(item.title)));
  assert.ok(report.scores.financial_operating_cash_flow_trend.value <= 2);
  assert.ok(report.scores.financial_free_cash_flow_trend.value <= 2);
  assert.match(report.scores.financial_operating_cash_flow_trend.explanation, /interim periods/);
});

test("Express and the standalone runner share the same score-then-validate finalization", async () => {
  const raw = await loadReportFixture("partial");
  const expected = finalizeResearchReport(raw, { reportValidator, requestedTicker: raw.security.ticker });
  assert.equal(expected.valid, true);
  const app = createApp({ researchClient: { async researchTicker() { return { report: raw, operations: {} }; } }, reportValidator });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=${raw.security.ticker}`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).report, expected.report);
  });
});
