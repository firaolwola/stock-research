import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createApp } from "../app.js";
import { finalizeResearchReport } from "../lib/finalize-research-report.js";
import { createReportValidator } from "../lib/report-validation.js";
import { calibrateReportScores, diagnoseCapitalScoreSufficiency } from "../lib/scoring.js";
import { boundedDocumentRows, classifyProfitConceptSemantics, createSecEvidenceClient, selectRelevantNtFiling } from "../lib/sec-evidence.js";
import { extractSecFilingEvidence, extractSecFilingEvidenceWithDiagnostics, normalizeCatalystClassification, resolveOverlappingSplitDateRoleConflicts } from "../lib/sec-filing-extraction.js";
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

function historicalFixture({ cik, name, formerNames = [], documents = {}, companyFacts = { facts: {} } }) {
  const padded = String(cik).padStart(10, "0");
  const submissions = { cik: padded, name, formerNames, filings: { recent: { accessionNumber: [], form: [], filingDate: [], reportDate: [], primaryDocument: [], items: [], primaryDocDescription: [] }, files: [] } };
  return async (url) => {
    const pathname = new URL(url).pathname; const file = pathname.split("/").at(-1);
    const body = pathname.includes("company_tickers") ? { fields: ["cik", "name", "ticker", "exchange"], data: [] } : pathname.includes("/submissions/") ? submissions : { cik: padded, entityName: name, ...companyFacts };
    return { ok: true, status: 200, async json() { return structuredClone(body); }, async text() { return documents[file] ?? "No classified material event."; } };
  };
}

async function researchHistorical(ticker, options) {
  const client = createSecEvidenceClient({ fetchImpl: historicalFixture(options), now: () => Date.parse("2026-08-27T12:00:00Z"), minRequestIntervalMs: 0 });
  return client.researchTicker(ticker);
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

test("NT selection keeps only a current unresolved delay in the issuer filing regime", () => {
  const row = (accession, form, filed, reportDate) => ({ accession, form, filed, reportDate, items: "", description: "", document: `${accession}.htm` });
  const current = selectRelevantNtFiling([
    row("annual-2024", "20-F", "2025-02-07", "2024-09-30"),
    row("nt-2025", "NT 20-F", "2026-01-23", "2025-09-30"),
    row("old-domestic", "NT 10-K", "2024-01-20", "2023-12-31")
  ], "2026-08-28T12:00:00Z");
  assert.equal(current.row.accession, "nt-2025");
  assert.equal(current.diagnostics.find((item) => item.accession === "nt-2025").active_delay, true);
  assert.equal(current.diagnostics.find((item) => item.accession === "old-domestic").exclusion_reason, "not_current_filer_regime");

  const cured = selectRelevantNtFiling([
    row("nt", "NT 10-K", "2026-03-02", "2025-12-31"),
    row("filed", "10-K", "2026-03-14", "2025-12-31")
  ], "2026-08-28T12:00:00Z");
  assert.equal(cured.row, null);
  assert.equal(cured.diagnostics[0].exclusion_reason, "superseded_by_expected_periodic_filing");
});

test("old NT filings do not explain the current REKR or GMBL freshness gap", () => {
  const old = (accession, form, filed, reportDate) => ({ accession, form, filed, reportDate, items: "", description: "", document: `${accession}.htm` });
  for (const rows of [
    [old("rekr-nt", "NT 10-K", "2019-03-29", "2018-12-31"), old("rekr-current", "10-K", "2026-03-31", "2025-12-31")],
    [old("gmbl-nt", "NT 10-K", "2023-09-29", "2023-06-30"), old("gmbl-filed", "10-K", "2023-10-13", "2023-06-30")]
  ]) {
    const result = selectRelevantNtFiling(rows, "2026-08-28T12:00:00Z");
    assert.equal(result.row, null);
    assert.equal(result.diagnostics[0].active_delay, false);
  }
});

test("NT reason extraction preserves issuer cause or states that it is unavailable", () => {
  const stated = extractSecFilingEvidenceWithDiagnostics({ html: "The Registrant's Annual Report on Form 20-F could not be filed within the prescribed time period because it requires additional time to complete its financial statements and the related audit procedures.", form: "NT 20-F", filed: "2026-01-23", reportDate: "2025-09-30", accession: "zapp-nt", documentUrl: "https://www.sec.gov/zapp-nt", documentName: "zapp-nt.htm" });
  const warning = stated.findings.find((item) => item.kind === "late_annual_filing");
  assert.match(warning.statement, /additional time to complete its financial statements/i);
  assert.equal(warning.delay_reason_extracted, true);
  assert.equal(stated.nt_filing_diagnostics[0].reason_source, "issuer_nt_filing_text");

  const unavailable = extractSecFilingEvidenceWithDiagnostics({ html: "The Registrant filed this Form NT 10-Q.", form: "NT 10-Q", filed: "2026-08-10", reportDate: "2026-06-30", accession: "missing-reason", documentUrl: "https://www.sec.gov/missing", documentName: "missing.htm" });
  assert.match(unavailable.findings.find((item) => item.kind === "late_annual_filing").statement, /issuer-stated reason was unavailable/i);
  assert.equal(unavailable.nt_filing_diagnostics[0].reason_extracted, false);
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

test("NIO foreign-filer effective-control language is not a material weakness", () => {
  const html = "Our management has concluded that our internal control over financial reporting was effective as of December 31, 2025. In the future, management may conclude that internal control over financial reporting is not effective. If we fail to maintain effective controls, a material weakness could cause misstatements.";
  const findings = extractSecFilingEvidence({ html, form: "20-F", filed: "2026-04-10", accession: "nio-control", documentUrl: "https://www.sec.gov/nio.htm", documentName: "nio.htm" });
  assert.equal(findings.some((item) => item.kind === "accounting_warning"), false);
});

test("BIOR bounded historical identity reaches OTC lineage and both completed splits", async () => {
  const result = await researchHistorical("BIOR", { cik: 1580063, name: "Biora Therapeutics, Inc.", formerNames: [{ name: "Progenity, Inc.", from: "2015-06-17", to: "2022-04-19" }], documents: {
    "d463897dars.pdf": "All share data reflect a 1-for-25 reverse stock split completed and effective January 3, 2023.",
    "bior-20241009.htm": "The Company effected a reverse stock split at a ratio of 1-for-10, effective October 18, 2024.",
    "d899591d8k.htm": "The Company entered into a securities purchase agreement and issued and sold common stock. The Company issued warrants exercisable for shares of common stock.",
    "bior-20241210.htm": "Nasdaq notified the Company that it determined to delist the securities. Trading was suspended and the shares began trading on OTC Pink under BIOR."
  } });
  assert.equal(result.report.issuer.cik, "0001580063");
  assert.equal(result.report.security.listing_venue, "OTC Pink");
  assert.equal(result.report.security.listing_status, "delisted");
  assert.equal(result.evidence_packet.identity_resolution.status, "otc");
  assert.deepEqual(result.report.sections.reverse_splits.items.map((item) => item.corporate_action_state), ["completed", "completed"]);
  assert.ok(result.report.sections.dilution.items.some((item) => item.kind === "warrant"));
  const finalized = calibrateReportScores(result.report);
  assert.equal(reportValidator(finalized).valid, true, JSON.stringify(reportValidator(finalized).errors));
  const claims = new Map(finalized.claims.map((item) => [item.id, item])); const sources = new Map(finalized.sources.map((item) => [item.id, item]));
  for (const identity of finalized.issuer.prior_identities) for (const claimId of identity.claim_ids) for (const sourceId of claims.get(claimId).source_ids) assert.ok(sources.get(sourceId)?.supported_claim_ids.includes(claimId));
});

test("ZAPPF exact historical identity routes through ZAPP and the foreign SEC filing path", async () => {
  const result = await researchHistorical("ZAPPF", { cik: 1955104, name: "Zapp Electric Vehicles Group Limited", documents: {
    "zapp-ex99_1.htm": "Shareholders approved a consolidation of every twenty ordinary shares into one ordinary share. The Company will effect the 1-for-20 reverse stock split after approval.",
    "zapp-20240930.htm": "The Company is a Cayman Islands foreign private issuer reporting under IFRS. The reverse share split was effective April 22, 2024. The Company incurred a net loss and negative operating cash flow, and substantial doubt exists about its ability to continue as a going concern without additional capital.",
    "final_nasdaq_delisting_6.htm": "Nasdaq suspended and delisted the Company's ordinary shares formerly traded under ZAPP. The ordinary shares began quotation on OTC under ZAPPF.",
    "zapp20260122_nt20f.htm": "The Registrant is unable to timely file its Annual Report on Form 20-F for the fiscal year ended September 30, 2025 because it requires additional time to complete its financial statements and related audit procedures."
  } });
  assert.equal(result.report.security.ticker, "ZAPPF");
  assert.equal(result.report.security.security_type, "foreign_ordinary_share");
  assert.equal(result.report.security.listing_status, "delisted");
  assert.equal(result.report.issuer.cik, "0001955104");
  assert.deepEqual({ jurisdiction: result.evidence_packet.identity_resolution.filer_jurisdiction, regime: result.evidence_packet.identity_resolution.filer_regime, accounting: result.evidence_packet.identity_resolution.accounting_standard }, { jurisdiction: "Cayman Islands", regime: "foreign_20-F_6-K", accounting: "IFRS" });
  assert.ok(result.report.issuer.prior_identities.some((item) => item.ticker === "ZAPP" && item.linkage_state === "confirmed"));
  assert.ok(result.report.sections.reverse_splits.items.some((item) => item.title === "Completed 1-for-20 reverse split" && item.event_date === "2024-04-22"));
  assert.equal(result.report.financial_assessment.going_concern.state, "confirmed");
  const lateAnnual = result.report.financial_assessment.material_warnings.find((item) => item.title === "Delayed annual filing");
  assert.equal(lateAnnual?.state, "confirmed");
  assert.match(lateAnnual?.summary ?? "", /additional time to complete its financial statements/i);
  assert.ok(result.evidence_packet.nt_filing_diagnostics.some((item) => item.accession === "0001437749-26-002535" && item.active_delay === true && item.selected === true));
  assert.ok(result.evidence_packet.corporate_action_diagnostics.some((item) => item.authorization_accession === "0000950170-24-044773" && item.canonical_event_id));
  assert.ok(result.report.sources.some((item) => /20-F filed/i.test(item.title)));
  assert.equal(reportValidator(calibrateReportScores(result.report)).valid, true);
});

test("STN stored-live shape promotes 40-F foreign filer IFRS and direct common-share semantics independently", async () => {
  const filings = [
    { accessionNumber: "0001131383-26-000017", form: "6-K", filingDate: "2026-08-12", reportDate: "2026-06-30", primaryDocument: "a6kq22026.htm", items: "" },
    { accessionNumber: "0001131383-26-000007", form: "40-F", filingDate: "2026-02-25", reportDate: "2025-12-31", primaryDocument: "stn-20251231.htm", items: "" }
  ];
  const result = await researchFixture({ ticker: "STN", cik: 1131383, filings, companyFacts: { cik: 1131383, entityName: "STN Corp.", facts: {} }, documents: {
    "stn-20251231.htm": "Stantec Inc. is a Canadian foreign private issuer. The common shares are listed on the Toronto Stock Exchange and the New York Stock Exchange under STN. These consolidated financial statements are prepared in Canadian dollars in accordance with IFRS Accounting Standards as issued by the International Accounting Standards Board. A reconciliation note contains incidental U.S. GAAP terminology that does not state the reporting basis.",
    "a6kq22026.htm": "Stantec Inc. furnishes this report as a foreign private issuer on Form 6-K and files its annual report on Form 40-F."
  } });
  assert.equal(result.report.issuer.foreign_private_issuer, true);
  assert.equal(result.report.issuer.filing_regime, "foreign_40-F_6-K");
  assert.equal(result.report.issuer.accounting_basis, "IFRS");
  assert.equal(result.report.issuer.accounting_authority, "IASB");
  assert.equal(result.report.issuer.presentation_currency, "CAD");
  assert.equal(result.report.security.security_structure, "direct_share");
  assert.equal(result.report.security.depositary_ratio, null);
  assert.deepEqual(result.report.security.additional_listing_venues, ["TSX"]);
  assert.notEqual(result.report.security.security_type, "adr");
  assert.equal(result.evidence_packet.reporting_identity_diagnostics[0].accounting_framework_source, "0001131383-26-000007");
  assert.equal(reportValidator(calibrateReportScores(result.report)).valid, true);
});

test("STN 40-F linked audited exhibit is included for reporting-property binding", async () => {
  const result = await researchFixture({ ticker: "STN", cik: 1131383, filings: [
    { accessionNumber: "0001131383-26-000007", form: "40-F", filingDate: "2026-02-25", reportDate: "2025-12-31", primaryDocument: "stn-index.htm", items: "" }
  ], companyFacts: { cik: 1131383, entityName: "STN Corp.", facts: {} }, documents: {
    "stn-index.htm": '<html><body><a href="exh_991.htm">Exhibit 99.1</a><a href="ex-992xmda2025.htm">Audited financial statements</a></body></html>',
    "exh_991.htm": "Stantec Inc. annual report exhibit.",
    "ex-992xmda2025.htm": "The audited consolidated financial statements are presented in Canadian dollars in accordance with IFRS Accounting Standards as issued by the International Accounting Standards Board. The common shares are listed on the Toronto Stock Exchange and the New York Stock Exchange under STN. An unrelated discussion mentions U.S. GAAP and American Depositary Shares."
  } });
  assert.equal(result.report.issuer.accounting_basis, "IFRS");
  assert.equal(result.report.issuer.accounting_authority, "IASB");
  assert.equal(result.report.security.security_structure, "direct_share");
  assert.deepEqual(result.report.security.additional_listing_venues, ["TSX"]);
  assert.equal(result.evidence_packet.reporting_identity_diagnostics[0].accounting_framework_source, "0001131383-26-000007");
  assert.ok(result.evidence_packet.cache.documents.some((item) => item.document === "ex-992xmda2025.htm"));
  assert.equal(reportValidator(calibrateReportScores(result.report)).valid, true);
});

test("foreign filer status does not imply ADS and explicit U.S. GAAP remains U.S. GAAP", async () => {
  const filings = [{ accessionNumber: "xpev-20f", form: "20-F", filingDate: "2026-04-01", reportDate: "2025-12-31", primaryDocument: "xpev.htm", items: "" }];
  const result = await researchFixture({ ticker: "XPEV", cik: 1810997, filings, companyFacts: { cik: 1810997, entityName: "XPEV Corp.", facts: {} }, documents: { "xpev.htm": "The Company is a Cayman Islands foreign private issuer. The American Depositary Shares are listed on the New York Stock Exchange. The consolidated financial statements are prepared in accordance with U.S. GAAP." } });
  assert.equal(result.report.issuer.foreign_private_issuer, true);
  assert.equal(result.report.issuer.filing_regime, "foreign_20-F_6-K");
  assert.equal(result.report.issuer.accounting_basis, "US_GAAP");
  assert.equal(result.report.security.security_structure, "ads");
});

test("ONFO listing lifecycle closes minimum bid without closing stockholders equity", async () => {
  const filings = [
    { accessionNumber: "new-close", form: "8-K", filingDate: "2026-08-27", reportDate: "2026-08-27", primaryDocument: "close.htm", items: "3.01" },
    { accessionNumber: "quarter", form: "10-Q", filingDate: "2026-08-19", reportDate: "2026-06-30", primaryDocument: "quarter.htm", items: "" },
    { accessionNumber: "split", form: "8-K", filingDate: "2026-08-10", reportDate: "2026-08-10", primaryDocument: "split.htm", items: "5.03" }
  ];
  const result = await researchFixture({ ticker: "ONFO", cik: 1825452, filings, companyFacts: { cik: 1825452, entityName: "ONFO Corp.", facts: {} }, documents: {
    "close.htm": "Nasdaq notified the Company that it regained compliance with Nasdaq Listing Rule 5550(a)(2), the minimum bid price requirement, and this matter is now closed.",
    "quarter.htm": "Nasdaq notified the Company on May 26, 2026 that it was not in compliance with Nasdaq Listing Rule 5550(b)(1), the minimum stockholders' equity requirement. The compliance plan remains under review. On July 2, 2026 Nasdaq notified the Company that it was not in compliance with Nasdaq Listing Rule 5550(a)(2), the minimum bid price requirement, with a deadline of December 29, 2026. A risk disclosure separately mentions American Depositary Shares of unrelated issuers.",
    "split.htm": "The Company effected a 1-for-50 reverse stock split effective August 10, 2026 as part of its effort to regain compliance."
  } });
  const items = result.report.sections.compliance_and_warnings.items;
  assert.ok(items.some((item) => item.resolution_state === "resolved" && /5550\(a\)\(2\)|minimum bid/i.test(item.summary)));
  assert.ok(items.some((item) => item.resolution_state === "active" && /5550\(b\)\(1\)|stockholders.? equity/i.test(item.summary)));
  assert.ok(items.some((item) => item.resolution_state === "historical" && /5550\(a\)\(2\)|minimum bid/i.test(item.summary)));
  assert.ok(items.filter((item) => item.resolution_state === "active").every((item) => !/5550\(a\)\(2\)|minimum bid/i.test(item.summary)));
  assert.ok(items.filter((item) => item.resolution_state === "resolved").every((item) => !/5550\(b\)\(1\)|stockholders.? equity/i.test(item.summary)));
  assert.match(result.report.sections.compliance_and_warnings.summary, /1 active.*1 separately resolved/i);
  assert.ok(result.evidence_packet.listing_compliance_diagnostics.some((item) => item.rule === "nasdaq_5550_a_2_minimum_bid" && item.current_state === "resolved"));
  assert.ok(result.evidence_packet.listing_compliance_diagnostics.some((item) => item.rule === "nasdaq_5550_b_1_stockholders_equity" && item.current_state === "active"));
  assert.equal(result.report.sections.reverse_splits.items[0].corporate_action_state, "completed");
  assert.notEqual(result.report.security.security_structure, "ads");
});

test("GMBL authoritative OTC common-stock evidence settles type and preserves both completed ratios", async () => {
  const filings = [
    { accessionNumber: "0001493152-23-034866", form: "NT 10-K", filingDate: "2023-09-29", reportDate: "2023-06-30", primaryDocument: "late.htm", items: "" },
    { accessionNumber: "0001493152-23-037224", form: "10-K", filingDate: "2023-10-13", reportDate: "2023-06-30", primaryDocument: "annual.htm", items: "" },
    { accessionNumber: "0001493152-24-021070", form: "10-Q", filingDate: "2024-05-23", reportDate: "2024-03-31", primaryDocument: "quarter.htm", items: "" },
    { accessionNumber: "0001493152-24-007169", form: "8-K", filingDate: "2024-02-22", reportDate: "2024-02-21", primaryDocument: "delisting.htm", items: "3.01" }
  ];
  const result = await researchFixture({ ticker: "GMBL", cik: 1451448, filings, documents: {
    "late.htm": "The Registrant required additional time to complete its annual report.",
    "annual.htm": "We implemented a one-for-one hundred (1-for-100) reverse stock split of our common stock effective February 22, 2023.",
    "quarter.htm": "Effective December 22, 2023, the Company completed a one-for-four-hundred (1-for-400) reverse stock split of its common stock.",
    "delisting.htm": "Nasdaq notified the Company that its securities were subject to delisting. Trading was suspended and the securities began trading over-the-counter on OTC Pink under GMBL."
  } });
  assert.equal(result.report.security.security_type, "common_stock");
  assert.equal(result.report.security.listing_status, "delisted");
  assert.deepEqual({ status: result.evidence_packet.identity_resolution.security_type_resolution.status, basis: result.evidence_packet.identity_resolution.security_type_resolution.basis, accession: result.evidence_packet.identity_resolution.security_type_resolution.source_accession }, { status: "resolved", basis: "identity_gated_selected_filing", accession: "0001493152-24-021070" });
  assert.deepEqual(result.report.sections.reverse_splits.items.map((item) => [item.event_date, item.title]), [
    ["2023-02-22", "Completed 1-for-100 reverse split"],
    ["2023-12-22", "Completed 1-for-400 reverse split"]
  ]);
  assert.equal(result.report.financial_assessment.material_warnings.some((item) => /Delayed annual filing/i.test(item.title)), false);
  assert.equal(result.evidence_packet.nt_filing_diagnostics.find((item) => item.accession === "0001493152-23-034866")?.exclusion_reason, "superseded_by_expected_periodic_filing");
  assert.equal(reportValidator(calibrateReportScores(result.report)).valid, true);
});

test("OTC terminal evidence does not infer common stock from ticker or venue alone", async () => {
  const result = await researchFixture({ ticker: "OTCX", filings: [{ accessionNumber: "otcx", form: "8-K", filingDate: "2026-01-02", reportDate: "2026-01-02", primaryDocument: "otcx.htm", items: "3.01" }], documents: {
    "otcx.htm": "Nasdaq suspended and delisted the securities, which began trading over-the-counter on OTC Pink."
  } });
  assert.equal(result.report.security.security_type, "unknown");
  assert.equal(result.report.security.evidence_state, "limited_coverage");
});

test("prospectus restatement boilerplate is not non-reliance without an accounting determination", () => {
  const boilerplate = extractSecFilingEvidence({ html: "Risk factors include any required accounting restatement to correct an error in previously issued financial statements. Description of Securities follows.", form: "424B3", filed: "2025-03-01", accession: "zapp-prospectus", documentUrl: "https://www.sec.gov/zapp-prospectus", documentName: "zapp-prospectus.htm" });
  assert.equal(boilerplate.some((item) => item.kind === "non_reliance"), false);
  const actual = extractSecFilingEvidence({ html: "Item 4.02. The audit committee determined that the Company's previously issued financial statements should no longer be relied upon due to an accounting error.", form: "8-K", filed: "2025-03-01", accession: "actual-402", documentUrl: "https://www.sec.gov/actual-402", documentName: "actual-402.htm" });
  assert.equal(actual.find((item) => item.kind === "non_reliance")?.trigger_basis, "item_4_02");
});

test("REKR stored disclosure shape preserves working-capital deficit and near-term note maturity", async () => {
  const disclosure = "As of June 30, 2026, we had a $6.598 million working capital deficit. The $15.0 million Series A Prime Revenue Sharing Notes are due December 15, 2026.";
  const findings = extractSecFilingEvidence({ html: disclosure, form: "10-Q", filed: "2026-08-13", accession: "rekr", documentUrl: "https://www.sec.gov/rekr.htm", documentName: "rekr.htm" });
  const workingCapital = findings.find((item) => item.kind === "working_capital_deficit");
  const maturity = findings.find((item) => item.kind === "debt_maturity");
  assert.equal(workingCapital.value, 6_598_000);
  assert.match(workingCapital.statement, /working capital deficit/i);
  assert.equal(maturity.value, 15_000_000);
  assert.match(maturity.statement, /December 15, 2026/);
  const distant = extractSecFilingEvidence({ html: "The $15.0 million notes mature December 15, 2030.", form: "10-Q", filed: "2026-08-13", accession: "rekr-far", documentUrl: "https://www.sec.gov/rekr-far.htm", documentName: "rekr-far.htm", evaluatedAt: "2026-08-27T12:00:00Z" });
  assert.equal(distant.some((item) => item.kind === "debt_maturity"), false);
});

test("REKR current periodic evidence suppresses an unrelated historical NT warning", async () => {
  const result = await researchFixture({ ticker: "REKR", cik: 1697851, filings: [
    { accessionNumber: "old-nt", form: "NT 10-K", filingDate: "2019-03-29", reportDate: "2018-12-31", primaryDocument: "old-nt.htm", items: "" },
    { accessionNumber: "current-quarter", form: "10-Q", filingDate: "2026-08-13", reportDate: "2026-06-30", primaryDocument: "current.htm", items: "" },
    { accessionNumber: "current-annual", form: "10-K", filingDate: "2026-03-31", reportDate: "2025-12-31", primaryDocument: "annual.htm", items: "" }
  ], documents: {
    "old-nt.htm": "The old annual report could not be filed on time because additional compilation work was required.",
    "current.htm": "Substantial doubt exists about the Company's ability to continue as a going concern. The Company had a working capital deficit of $6.598 million. The $15.0 million notes mature December 15, 2026.",
    "annual.htm": "The annual report was filed."
  } });
  assert.equal(result.report.financial_assessment.material_warnings.some((item) => /Delayed annual filing/i.test(item.title)), false);
  assert.ok(result.report.financial_assessment.material_warnings.some((item) => item.title === "Working-capital deficit"));
  assert.ok(result.report.financial_assessment.material_warnings.some((item) => item.title === "Near-term debt or note maturity"));
  assert.equal(result.evidence_packet.nt_filing_diagnostics.find((item) => item.accession === "old-nt")?.active_delay, false);
});

test("written split ratios require complete multi-digit denominator tokens", () => {
  const findings = extractSecFilingEvidence({ html: "Effective December 22, 2023, the Company completed a one-for-four-hundred (1-for-400) reverse stock split.", form: "10-Q", filed: "2024-05-23", accession: "gmbl", documentUrl: "https://www.sec.gov/gmbl.htm", documentName: "gmbl.htm" });
  const splits = findings.filter((item) => item.kind === "reverse_split");
  assert.ok(splits.some((item) => item.ratio === "1-for-400"));
  assert.equal(splits.some((item) => item.ratio === "1-for-4"), false);
});

test("MULN historical ticker resolves CIK lineage to BINI and preserves repeated split history", async () => {
  const spacer = " Background information about the issuer and its capital structure. ".repeat(12);
  const result = await researchHistorical("MULN", { cik: 1499961, name: "Bollinger Innovations, Inc.", formerNames: [{ name: "Mullen Automotive Inc.", from: "2021-11-12", to: "2025-07-23" }], documents: {
    "muln20240630c_10q.htm": `The Company completed a 1-for-25 reverse stock split effective May 4, 2023.${spacer}The Company completed a 1-for-9 reverse stock split effective August 11, 2023.${spacer}The Company completed a 1-for-100 reverse stock split effective December 21, 2023.`,
    "mullenautomotive_8k.htm": "The Company implemented a reverse stock split at a ratio of 1-for-100 effective September 17, 2024. Nasdaq notified the Company it was subject to delisting.",
    "mullenautomotive_ex99-1.htm": "The Company will effect a 1-for-100 reverse stock split effective June 2, 2025.",
    "bollingerinnovations_8k.htm": "Mullen Automotive Inc. changed its name to Bollinger Innovations, Inc. and ticker MULN changed to BINI effective July 28, 2025. Trading in the Company's securities will be suspended on October 13, 2025 and will commence trading on the OTCID market under ticker BINI."
  } });
  assert.equal(result.report.security.ticker, "MULN");
  assert.equal(result.evidence_packet.identity_resolution.current_ticker, "BINI");
  assert.equal(result.evidence_packet.identity_resolution.status, "renamed");
  assert.ok(result.report.issuer.prior_identities.some((item) => item.ticker === "MULN"));
  for (const ratio of ["1-for-25", "1-for-9", "1-for-100"]) assert.ok(result.report.sections.reverse_splits.items.some((item) => item.title.includes(ratio)), ratio);
  for (const date of ["2023-05-04", "2023-08-11", "2023-12-21"]) assert.ok(result.report.sections.reverse_splits.items.some((item) => item.event_date === date), date);
  assert.equal(result.report.security.listing_venue, "OTCID"); assert.equal(result.report.security.listing_status, "delisted");
  assert.equal(result.evidence_packet.identity_resolution.current_ticker_effective_from, "2025-07-28"); assert.equal(result.evidence_packet.identity_resolution.listing_effective_from, "2025-10-13");
  const prior = result.report.issuer.prior_identities.find((item) => item.ticker === "MULN"); assert.equal(prior.effective_from, "2021-11-12"); assert.equal(prior.effective_to, "2025-07-27");
  const finalized = calibrateReportScores(result.report); assert.equal(reportValidator(finalized).valid, true, JSON.stringify(reportValidator(finalized).errors));
});

test("Sparse-3 MULN replay strips bounded inline-XBRL markup before selecting all 2023 split events", async () => {
  const inlineMarkup = `<ix:nonNumeric contextRef="large-context" name="muln:Disclosure"> </ix:nonNumeric>`.repeat(28_000);
  const splitHistory = "The Company completed a 1-for-25 reverse stock split effective May 4, 2023. The Company completed a 1-for-9 reverse stock split effective August 11, 2023. The Company completed a 1-for-100 reverse stock split effective December 21, 2023.";
  assert.ok(inlineMarkup.length > 2_000_000);
  const result = await researchHistorical("MULN", { cik: 1499961, name: "Bollinger Innovations, Inc.", documents: { "muln20240630c_10q.htm": `${inlineMarkup}${splitHistory}` } });
  const completed = result.report.sections.reverse_splits.items.filter((item) => item.corporate_action_state === "completed");
  assert.deepEqual(completed.map((item) => [item.title.match(/1-for-\d+/)[0], item.effective_date]), [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"]]);
});

test("split lifecycle uses effective dates and deduplicates corroborating filings", async () => {
  const result = await researchHistorical("BIOR", { cik: 1580063, name: "Biora Therapeutics, Inc.", documents: {
    "d463897dars.pdf": "The Company proposed a 1-for-25 reverse stock split which would become effective January 3, 2023.",
    "bior-20241009.htm": "The Company completed a 1-for-10 reverse stock split effective October 18, 2024.",
    "d899591d8k.htm": "All share data reflect the completed 1-for-10 reverse stock split effected on October 18, 2024.",
    "bior-20241210.htm": "The completed 1-for-10 reverse stock split became effective October 18, 2024."
  } });
  const ten = result.report.sections.reverse_splits.items.filter((item) => item.title.includes("1-for-10"));
  assert.equal(ten.length, 1); assert.equal(ten[0].event_date, "2024-10-18"); assert.equal(ten[0].effective_date, "2024-10-18"); assert.notEqual(ten[0].source_filing_date, ten[0].effective_date); assert.ok(ten[0].claim_ids.length >= 2);
  const proposed = extractSecFilingEvidence({ html: "The board proposed a 1-for-20 reverse stock split scheduled to become effective 2026-09-01.", form: "8-K", filed: "2026-08-01", evaluatedAt: "2026-08-10T00:00:00Z", accession: "proposal", documentUrl: "https://www.sec.gov/proposal", documentName: "proposal.htm" }).find((item) => item.kind === "reverse_split");
  const completed = extractSecFilingEvidence({ html: "The Company completed a 1-for-20 reverse stock split effective 2026-09-01.", form: "8-K", filed: "2026-09-02", evaluatedAt: "2026-09-02T00:00:00Z", accession: "completion", documentUrl: "https://www.sec.gov/completion", documentName: "completion.htm" }).find((item) => item.kind === "reverse_split");
  assert.equal(proposed.action_state, "scheduled"); assert.equal(completed.action_state, "completed"); assert.equal(proposed.effective_date, completed.effective_date);
});

test("Sparse-4 BIOR raw lifecycle mentions reconcile to two canonical completed events", async () => {
  const result = await researchHistorical("BIOR", { cik: 1580063, name: "Biora Therapeutics, Inc.", documents: {
    "d463897dars.pdf": "Stockholders authorized a 1-for-25 reverse stock split. The Company completed the 1-for-25 reverse stock split effective January 3, 2023.",
    "bior-20241009.htm": "The board approved a 1-for-10 reverse stock split. The 1-for-10 reverse stock split was effected on October 18, 2024.",
    "d899591d8k.htm": "All share data reflect the completed 1-for-10 reverse stock split effected on October 18, 2024.",
    "bior-20241210.htm": "The completed 1-for-25 reverse stock split became effective January 3, 2023 and the completed 1-for-10 reverse stock split became effective October 18, 2024."
  } });
  const items = result.report.sections.reverse_splits.items;
  assert.deepEqual(items.map((item) => [item.title.match(/1-for-\d+/)[0], item.event_date]), [["1-for-25", "2023-01-03"], ["1-for-10", "2024-10-18"]]);
  assert.ok(items.every((item) => item.corporate_action_state === "completed" && item.claim_ids.length >= 2));
  assert.match(result.report.sections.reverse_splits.summary, /2 distinct reverse-split actions/);
});

test("Sparse-4 MULN local binding preserves three 2023 actions and does not complete an authorization range", async () => {
  const html = "The Company completed a 1-for-25 reverse stock split effective May 4, 2023. The Company completed a 1-for-9 reverse stock split effective August 11, 2023. The Company completed a 1-for-100 reverse stock split effective December 21, 2023. Stockholders authorized the board to choose a reverse stock split ratio between 1-for-2 and 1-for-60 in the future.";
  const findings = extractSecFilingEvidence({ html, form: "10-Q", filed: "2024-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "muln", documentUrl: "https://www.sec.gov/muln.htm", documentName: "muln.htm" }).filter((item) => item.kind === "reverse_split");
  const completed = findings.filter((item) => item.action_state === "completed");
  assert.deepEqual(completed.map((item) => [item.ratio, item.event_date]), [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"]]);
  assert.equal(findings.some((item) => item.ratio === "1-for-60" && item.action_state === "completed"), false);
  const diagnostics = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-Q", filed: "2024-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "muln", documentUrl: "https://www.sec.gov/muln.htm", documentName: "muln.htm" }).corporate_action_diagnostics;
  assert.ok(diagnostics.some((item) => item.disposition === "withheld" && item.reason === "authorization_range_is_not_a_completed_action"));
});

test("MULN retrospective split history infers completed lifecycle without requiring the literal word completed", () => {
  const html = "Reverse stock split history: a 1-for-25 reverse stock split effective May 4, 2023; a 1-for-9 reverse stock split effective August 11, 2023; and a 1-for-100 reverse stock split effective December 21, 2023.";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-K", filed: "2025-01-24", evaluatedAt: "2026-08-27T12:00:00Z", accession: "muln-history", documentUrl: "https://www.sec.gov/muln-history", documentName: "muln-history.htm" });
  const splits = result.findings.filter((item) => item.kind === "reverse_split");
  assert.deepEqual(splits.map((item) => [item.ratio, item.effective_date, item.action_state]), [
    ["1-for-25", "2023-05-04", "completed"],
    ["1-for-9", "2023-08-11", "completed"],
    ["1-for-100", "2023-12-21", "completed"]
  ]);
  const accepted = result.corporate_action_diagnostics.filter((item) => item.disposition === "accepted" && item.extracted_effective_date);
  assert.ok(accepted.every((item) => item.segment_id && item.candidate_date_source_segment === item.segment_id && item.candidate_lifecycle_source_segment === item.segment_id));
});

test("MULN adjacent named action cannot borrow the following split date", () => {
  const html = "Effective June 2, 2025, the Company implemented a reverse stock split at a ratio of 1-for-100 shares (the June Reverse Stock Split), and effective August 4, 2025, the Company implemented a reverse stock split at a ratio of 1-for-250 shares (the August Reverse Stock Split).";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-Q", filed: "2025-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "muln-adjacent", documentUrl: "https://www.sec.gov/muln-adjacent", documentName: "muln-adjacent.htm" });
  const splits = result.findings.filter((item) => item.kind === "reverse_split");
  assert.ok(splits.some((item) => item.ratio === "1-for-100" && item.effective_date === "2025-06-02"));
  assert.ok(splits.some((item) => item.ratio === "1-for-250" && item.effective_date === "2025-08-04" && item.action_state === "completed"));
  assert.equal(splits.some((item) => item.ratio === "1-for-100" && item.effective_date === "2025-08-04"), false);
});

test("Verification-4 written 1-for-250 text never truncates to 1-for-2", () => {
  const html = "On August 1, 2025, the Company filed a Certificate of Amendment to effect a one-for-two hundred fifty (1-for-250) reverse stock split, which became effective on August 4, 2025.";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-Q", filed: "2025-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "0001437749-25-027016", documentUrl: "https://www.sec.gov/muln", documentName: "muln.htm" });
  assert.equal(result.findings.some((item) => item.ratio === "1-for-2" || item.ratio === "1-for-25"), false);
  assert.ok(result.corporate_action_diagnostics.every((item) => item.complete_ratio_token_text === null || /250/.test(item.complete_ratio_token_text)));
});

test("a certificate filing date alone cannot establish a completed split", () => {
  const html = "On August 1, 2025, the Company filed a Certificate of Amendment to its certificate of incorporation to effect a one-for-two hundred fifty (1-for-250) reverse stock split.";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-Q", filed: "2025-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "certificate-only", documentUrl: "https://www.sec.gov/certificate-only", documentName: "certificate-only.htm" });
  const filingReference = result.findings.find((item) => item.kind === "reverse_split");
  assert.equal(filingReference.action_state, "unknown");
  assert.equal(filingReference.event_date, null);
  assert.equal(filingReference.filing_reference_date, "2025-08-01");
  assert.equal(filingReference.date_role, "filing_date");
  assert.equal(filingReference.canonical_support_only, true);
  assert.equal(result.corporate_action_diagnostics[0].canonical_acceptance_invariant_passed, false);
  assert.equal(result.corporate_action_diagnostics[0].reason, "filing_date_cannot_establish_completed_event");
});

test("explicit same-day certificate filing and effectiveness remains a completed action", () => {
  const html = "On August 4, 2025, the Company filed a Certificate of Amendment to effect a 1-for-250 reverse stock split, which became effective on August 4, 2025.";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "8-K", filed: "2025-08-04", evaluatedAt: "2026-08-27T12:00:00Z", accession: "same-day", documentUrl: "https://www.sec.gov/same-day", documentName: "same-day.htm" });
  const split = result.findings.find((item) => item.kind === "reverse_split" && item.action_state === "completed");
  assert.equal(split.event_date, "2025-08-04");
  assert.equal(split.date_role, "effective_date");
  assert.equal(result.corporate_action_diagnostics.find((item) => item.disposition === "accepted").canonical_acceptance_invariant_passed, true);
});

test("corporate-action diagnostics distinguish announcement, authorization, scheduled, trading, effective, and completion dates", () => {
  const cases = [
    ["The Company announced on January 2, 2025 a proposed 1-for-10 reverse stock split.", "announcement_date", "2024-12-01T00:00:00Z"],
    ["Stockholders approved on January 3, 2025 a 1-for-10 reverse stock split.", "authorization_date", "2025-01-04T00:00:00Z"],
    ["The 1-for-10 reverse stock split will become effective on January 6, 2025.", "scheduled_effective_date", "2025-01-04T00:00:00Z"],
    ["The Company effected a 1-for-10 reverse stock split effective January 6, 2025.", "effective_date", "2025-01-07T00:00:00Z"],
    ["The Company completed a 1-for-10 reverse stock split on January 6, 2025.", "completion_date", "2025-01-07T00:00:00Z"],
    ["The Company completed a 1-for-10 reverse stock split; split-adjusted trading began on January 6, 2025.", "trading_effective_date", "2025-01-07T00:00:00Z"]
  ];
  for (const [html, role, evaluatedAt] of cases) {
    const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "8-K", filed: "2025-01-07", evaluatedAt, accession: role, documentUrl: `https://www.sec.gov/${role}`, documentName: `${role}.htm` });
    assert.equal(result.corporate_action_diagnostics[0].date_role, role, JSON.stringify(result.corporate_action_diagnostics[0]));
  }
});

test("explicit filing provenance suppresses overlapping retrospective completion inference", () => {
  const findings = [
    { occurrence_id: "fallback", kind: "reverse_split", event_date: "2025-08-01" },
    { occurrence_id: "filing", kind: "reverse_split", event_date: null, canonical_support_only: true }
  ];
  const shared = { source_accession: "same-accession", extracted_ratio: "1-for-250", extracted_date: "2025-08-01", source_date_position: 100, source_text_range_start: 0, source_text_range_end: 300, canonical_acceptance_invariant_passed: true, disposition: "accepted", canonical_event_id: null, canonical_chosen_event_date: "2025-08-01", merge_target: null };
  const diagnostics = [
    { ...shared, occurrence_id: "fallback", date_role: "completion_date", date_role_evidence: "authoritative_retrospective_history", date_role_evidence_strength: 100 },
    { ...shared, occurrence_id: "filing", date_role: "filing_date", date_role_evidence: "certificate_or_amendment_filing_language_without_same_day_effectiveness", date_role_evidence_strength: 500, canonical_acceptance_invariant_passed: false, disposition: "withheld", canonical_chosen_event_date: null }
  ];
  resolveOverlappingSplitDateRoleConflicts(findings, diagnostics);
  assert.deepEqual(findings.map((item) => item.occurrence_id), ["filing"]);
  assert.equal(diagnostics[0].retrospective_fallback_suppressed, true);
  assert.equal(diagnostics[0].winning_date_role, "filing_date");
  assert.equal(diagnostics[0].losing_interpretation, "completion_date");
  assert.equal(diagnostics[0].canonical_acceptance_invariant_passed, false);
  assert.equal(diagnostics[0].reason, "stronger_overlapping_date_role_evidence");
  assert.deepEqual(diagnostics[0].competing_overlapping_occurrence_ids, ["filing"]);
});

test("explicit effective evidence beats filing provenance for canonical event identity", () => {
  const findings = [{ occurrence_id: "filing" }, { occurrence_id: "effective" }];
  const shared = { source_accession: "same-accession", extracted_ratio: "1-for-250", extracted_date: "2025-08-04", source_date_position: 100, source_text_range_start: 0, source_text_range_end: 300, canonical_acceptance_invariant_passed: true, disposition: "accepted", canonical_event_id: null, canonical_chosen_event_date: "2025-08-04", merge_target: null, retrospective_fallback_suppressed: false };
  const diagnostics = [
    { ...shared, occurrence_id: "filing", date_role: "filing_date", date_role_evidence: "certificate_or_amendment_filing_language_without_same_day_effectiveness", date_role_evidence_strength: 500 },
    { ...shared, occurrence_id: "effective", date_role: "effective_date", date_role_evidence: "explicit_effective_language", date_role_evidence_strength: 600 }
  ];
  resolveOverlappingSplitDateRoleConflicts(findings, diagnostics);
  assert.deepEqual(findings.map((item) => item.occurrence_id), ["effective"]);
  assert.equal(diagnostics[0].winning_date_role, "effective_date");
  assert.equal(diagnostics[0].disposition, "withheld");
  assert.equal(diagnostics[1].winning_date_role, "effective_date");
});

test("equal-strength overlapping role conflict is withheld before canonicalization", () => {
  const findings = [{ occurrence_id: "left" }, { occurrence_id: "right" }];
  const shared = { source_accession: "same-accession", extracted_ratio: "1-for-10", extracted_date: "2025-01-02", source_date_position: 40, source_text_range_start: 0, source_text_range_end: 100, date_role_evidence_strength: 600, canonical_acceptance_invariant_passed: true, disposition: "accepted", canonical_event_id: null, canonical_chosen_event_date: "2025-01-02", merge_target: null, retrospective_fallback_suppressed: false };
  const diagnostics = [
    { ...shared, occurrence_id: "left", date_role: "effective_date", date_role_evidence: "explicit_effective_language" },
    { ...shared, occurrence_id: "right", date_role: "completion_date", date_role_evidence: "explicit_completion_language" }
  ];
  resolveOverlappingSplitDateRoleConflicts(findings, diagnostics);
  assert.deepEqual(findings, []);
  assert.ok(diagnostics.every((item) => item.canonical_acceptance_invariant_passed === false));
  assert.ok(diagnostics.every((item) => item.overlap_conflict_resolution_reason === "equal_strength_overlapping_date_role_conflict_withheld"));
});

test("Verification-5 certificate date reconciles to the later effective action", async () => {
  const filingReference = "On August 1, 2025, the Company filed a Certificate of Amendment to its Second Amended and Restated Certificate of Incorporation with the Secretary of State of the State of Delaware to effect a one-for-two hundred fifty (1-for-250) reverse stock split.";
  const effectiveReference = "Effective August 4, 2025, the Company implemented a reverse stock split at a ratio of 1-for-250 shares.";
  const result = await researchFixture({ ticker: "MULN", filings: [
    { accessionNumber: "000143774925027016", form: "10-Q", filingDate: "2025-08-14", reportDate: "2025-06-30", primaryDocument: "muln-verification-5.htm", primaryDocDescription: "Quarterly report" }
  ], documents: { "muln-verification-5.htm": `${filingReference} ${effectiveReference}` } });
  const events = result.report.sections.reverse_splits.items;
  assert.deepEqual(events.map((item) => [item.title.match(/1-for-\d+/)?.[0], item.event_date, item.corporate_action_state]), [["1-for-250", "2025-08-04", "completed"]]);
  assert.equal(events[0].claim_ids.length, 2, JSON.stringify(result.evidence_packet.corporate_action_diagnostics));
  const diagnostic = result.evidence_packet.corporate_action_diagnostics.find((item) => item.extracted_date === "2025-08-01");
  assert.equal(diagnostic.date_role, "filing_date");
  assert.equal(diagnostic.canonical_chosen_event_date, "2025-08-04");
  assert.equal(diagnostic.filing_vs_effective_reconciliation, "merged_to_effective_event");
  assert.equal(diagnostic.merge_reason, "same_ratio_filing_reference_reconciled_to_effective_event");
  assert.equal(diagnostic.disposition, "merged");
  assert.equal(diagnostic.merge_target, events[0].id);
  assert.equal(JSON.stringify(result.report).includes("corporate_action_diagnostics"), false);
});

test("same-ratio effective actions outside the filing reconciliation window remain distinct", async () => {
  const result = await researchFixture({ ticker: "MULN", filings: [{ accessionNumber: "separate-actions", form: "10-K", filingDate: "2026-01-15", reportDate: "2025-12-31", primaryDocument: "separate-actions.htm", primaryDocDescription: "Annual report" }], documents: {
    "separate-actions.htm": "The Company completed a 1-for-250 reverse stock split effective August 4, 2025. The Company completed a separate 1-for-250 reverse stock split effective September 22, 2025."
  } });
  assert.deepEqual(result.report.sections.reverse_splits.items.map((item) => item.event_date), ["2025-08-04", "2025-09-22"]);
});

test("completed action with an intervening competing ratio is withheld", () => {
  const html = "The Company effected a 1-for-100 reverse stock split and a 1-for-250 transaction effective August 4, 2025.";
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "10-Q", filed: "2025-08-14", evaluatedAt: "2026-08-27T12:00:00Z", accession: "ambiguous", documentUrl: "https://www.sec.gov/ambiguous", documentName: "ambiguous.htm" });
  assert.equal(result.findings.some((item) => item.kind === "reverse_split"), false);
  const diagnostic = result.corporate_action_diagnostics[0];
  assert.equal(diagnostic.competing_ratio_detected, true);
  assert.equal(diagnostic.canonical_acceptance_invariant_passed, false);
  assert.equal(diagnostic.reason, "competing_ratio_between_ratio_and_date_or_lifecycle");
  for (const field of ["source_span_truncated", "ratio_token_touched_truncation_boundary", "complete_ratio_token_text", "competing_ratio_positions", "date_position", "ratio_position", "canonical_validation_reason"]) assert.ok(Object.hasOwn(diagnostic, field), field);
});

test("Verification-4 stored evidence replays nine supported MULN actions without borrowed dates", () => {
  const html = [
    "A 1-for-25 reverse stock split was completed on May 4, 2023; a 1-for-9 reverse stock split was completed on August 11, 2023; and a 1-for-100 reverse stock split was completed on December 21, 2023.",
    "The Company implemented a 1-for-100 reverse stock split on September 17, 2024, and announced restored Nasdaq compliance on October 16, 2024.",
    "The Company completed a 1-for-60 reverse stock split on February 18, 2025 and a 1-for-100 reverse stock split on April 11, 2025.",
    "On June 2, 2025, the Company effected a 1-for-100 reverse stock split, and on August 4, 2025, the Company effected a 1-for-250 reverse stock split.",
    "The Company completed a 1-for-250 reverse stock split effective September 22, 2025."
  ].join(" ");
  const result = extractSecFilingEvidenceWithDiagnostics({ html, form: "S-1/A", filed: "2025-09-19", evaluatedAt: "2026-08-27T12:00:00Z", accession: "verification-4-replay", documentUrl: "https://www.sec.gov/verification-4", documentName: "verification-4.htm" });
  const events = result.findings.filter((item) => item.kind === "reverse_split").map((item) => [item.ratio, item.event_date]);
  const expected = [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"], ["1-for-100", "2024-09-17"], ["1-for-60", "2025-02-18"], ["1-for-100", "2025-04-11"], ["1-for-100", "2025-06-02"], ["1-for-250", "2025-08-04"], ["1-for-250", "2025-09-22"]];
  for (const event of expected) assert.ok(events.some((candidate) => candidate[0] === event[0] && candidate[1] === event[1]), JSON.stringify(events));
  for (const forbidden of [["1-for-100", "2024-01-24"], ["1-for-100", "2024-10-16"], ["1-for-2", "2025-08-01"], ["1-for-100", "2025-08-04"]]) assert.equal(events.some((candidate) => candidate[0] === forbidden[0] && candidate[1] === forbidden[1]), false, JSON.stringify(events));
});

test("Verification-5 stored-live shape preserves nine actions and merges the August 1 filing reference", async () => {
  const history = [
    "A 1-for-25 reverse stock split was completed on May 4, 2023; a 1-for-9 reverse stock split was completed on August 11, 2023; and a 1-for-100 reverse stock split was completed on December 21, 2023.",
    "The Company implemented a 1-for-100 reverse stock split on September 17, 2024.",
    "The Company completed a 1-for-60 reverse stock split on February 18, 2025 and a 1-for-100 reverse stock split on April 11, 2025.",
    "On June 2, 2025, the Company effected a 1-for-100 reverse stock split, and on August 4, 2025, the Company effected a 1-for-250 reverse stock split.",
    "The Company completed a 1-for-250 reverse stock split effective September 22, 2025."
  ].join(" ");
  const certificate = "On August 1, 2025, the Company filed a Certificate of Amendment to its Second Amended and Restated Certificate of Incorporation with the Secretary of State of the State of Delaware to effect a one-for-two hundred fifty (1-for-250) reverse stock split.";
  const result = await researchFixture({ ticker: "MULN", filings: [
    { accessionNumber: "000143774925027016", form: "10-Q", filingDate: "2025-08-14", reportDate: "2025-06-30", primaryDocument: "verification-5-certificate.htm", primaryDocDescription: "Quarterly report" },
    { accessionNumber: "000182912625007546", form: "S-1/A", filingDate: "2025-09-19", reportDate: "", primaryDocument: "verification-5-history.htm", primaryDocDescription: "Registration statement" }
  ], documents: { "verification-5-certificate.htm": certificate, "verification-5-history.htm": history } });
  const actual = result.report.sections.reverse_splits.items.map((item) => [item.title.match(/1-for-\d+/)?.[0], item.event_date]);
  assert.deepEqual(actual, [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"], ["1-for-100", "2024-09-17"], ["1-for-60", "2025-02-18"], ["1-for-100", "2025-04-11"], ["1-for-100", "2025-06-02"], ["1-for-250", "2025-08-04"], ["1-for-250", "2025-09-22"]]);
  assert.equal(actual.some(([ratio, date]) => ratio === "1-for-250" && date === "2025-08-01"), false);
  const filingDiagnostic = result.evidence_packet.corporate_action_diagnostics.find((item) => item.extracted_date === "2025-08-01");
  assert.equal(filingDiagnostic.canonical_chosen_event_date, "2025-08-04");
  assert.equal(filingDiagnostic.filing_vs_effective_reconciliation, "merged_to_effective_event");
  const finalized = finalizeResearchReport(result.report, { reportValidator, requestedTicker: "MULN" });
  assert.equal(finalized.valid, true, JSON.stringify(finalized.validation.errors));
});

test("Verification-6 overlapping live spans suppress August 1 and preserve the nine-event history", async () => {
  const stored = JSON.parse(await readFile(new URL("../evaluation/live/2026-08-28-muln-verification-6/raw/MULN.json", import.meta.url), "utf8"));
  const falseOccurrence = stored.report.sections.reverse_splits.items.find((item) => item.event_date === "2025-08-01");
  const explicitFiling = stored.report.claims.find((item) => item.text.startsWith("On August 1, 2025, the Company filed a Certificate of Amendment"));
  assert.ok(falseOccurrence && explicitFiling, "stored Verification-6 shape must retain both conflicting interpretations");
  const history = [
    "A 1-for-25 reverse stock split was completed on May 4, 2023; a 1-for-9 reverse stock split was completed on August 11, 2023; and a 1-for-100 reverse stock split was completed on December 21, 2023.",
    "The Company implemented a 1-for-100 reverse stock split on September 17, 2024.",
    "The Company completed a 1-for-60 reverse stock split on February 18, 2025 and a 1-for-100 reverse stock split on April 11, 2025.",
    "On June 2, 2025, the Company effected a 1-for-100 reverse stock split, and on August 4, 2025, the Company effected a 1-for-250 reverse stock split.",
    "The Company completed a 1-for-250 reverse stock split effective September 22, 2025."
  ].join(" ");
  const actionSuffix = explicitFiling.text.slice(explicitFiling.text.lastIndexOf(" reverse stock split"));
  const overlappingLiveShape = `${history} ${falseOccurrence.summary}${actionSuffix}.`;
  const result = await researchFixture({ ticker: "MULN", filings: [
    { accessionNumber: "000143774925027016", form: "10-Q", filingDate: "2025-08-14", reportDate: "2025-06-30", primaryDocument: "verification-6-live-shape.htm", primaryDocDescription: "Quarterly report" }
  ], documents: { "verification-6-live-shape.htm": overlappingLiveShape } });
  const actual = result.report.sections.reverse_splits.items.map((item) => [item.title.match(/1-for-\d+/)?.[0], item.event_date]);
  assert.deepEqual(actual, [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"], ["1-for-100", "2024-09-17"], ["1-for-60", "2025-02-18"], ["1-for-100", "2025-04-11"], ["1-for-100", "2025-06-02"], ["1-for-250", "2025-08-04"], ["1-for-250", "2025-09-22"]]);
  assert.equal(actual.some(([ratio, date]) => ratio === "1-for-250" && date === "2025-08-01"), false);
  const diagnostics = result.evidence_packet.corporate_action_diagnostics;
  const suppressed = diagnostics.find((item) => item.extracted_date === "2025-08-01" && item.date_role_evidence === "authoritative_retrospective_history");
  const filing = diagnostics.find((item) => item.extracted_date === "2025-08-01" && item.date_role === "filing_date");
  assert.equal(suppressed?.retrospective_fallback_suppressed, true, JSON.stringify(diagnostics.filter((item) => item.extracted_date === "2025-08-01")));
  assert.equal(suppressed?.canonical_acceptance_invariant_passed, false);
  assert.equal(suppressed?.winning_date_role, "filing_date");
  assert.equal(filing?.canonical_chosen_event_date, "2025-08-04");
  assert.equal(filing?.filing_vs_effective_reconciliation, "merged_to_effective_event");
  assert.ok(suppressed?.source_reference_id);
  assert.equal(suppressed?.source_reference_id, filing?.source_reference_id);
  assert.ok(suppressed?.competing_overlapping_occurrence_ids.includes(filing.occurrence_id));
  assert.equal(JSON.stringify(result.report).includes("corporate_action_diagnostics"), false);
});

test("stored-live MULN shape yields canonical history without the false August 2025 1-for-100", async () => {
  const html = "Reverse stock split history: a 1-for-25 reverse stock split effective May 4, 2023; a 1-for-9 reverse stock split effective August 11, 2023; a 1-for-100 reverse stock split effective December 21, 2023. Effective June 2, 2025, the Company implemented a reverse stock split at a ratio of 1-for-100 shares (the June Reverse Stock Split), and effective August 4, 2025, the Company implemented a reverse stock split at a ratio of 1-for-250 shares (the August Reverse Stock Split).";
  const result = await researchFixture({ ticker: "MULN", filings: [{ accessionNumber: "000143774925027016", form: "10-Q", filingDate: "2025-08-14", reportDate: "2025-06-30", primaryDocument: "muln-stored-live.htm", items: "", primaryDocDescription: "Quarterly report" }], documents: { "muln-stored-live.htm": html } });
  const events = result.report.sections.reverse_splits.items.map((item) => [item.title.match(/1-for-\d+/)?.[0], item.event_date, item.corporate_action_state]);
  for (const expected of [["1-for-25", "2023-05-04", "completed"], ["1-for-9", "2023-08-11", "completed"], ["1-for-100", "2023-12-21", "completed"], ["1-for-250", "2025-08-04", "completed"]]) assert.ok(events.some((item) => item.every((value, index) => value === expected[index])), JSON.stringify(events));
  assert.equal(events.some(([ratio, date]) => ratio === "1-for-100" && date === "2025-08-04"), false);
  assert.equal(JSON.stringify(result.report).includes("corporate_action_diagnostics"), false);
});

test("corporate-action clauses isolate sentence list and table-row ratios", () => {
  const cases = [
    "The Company completed a 1-for-10 reverse stock split effective January 2, 2025. The Company completed a 1-for-20 reverse stock split effective February 3, 2025.",
    "<ul><li>The Company completed a 1-for-10 reverse stock split effective January 2, 2025.</li><li>The Company completed a 1-for-20 reverse stock split effective February 3, 2025.</li></ul>",
    "<table><tr><td>The Company completed a 1-for-10 reverse stock split effective January 2, 2025.</td></tr><tr><td>The Company completed a 1-for-20 reverse stock split effective February 3, 2025.</td></tr></table>"
  ];
  for (const html of cases) {
    const findings = extractSecFilingEvidence({ html, form: "10-Q", filed: "2025-03-01", evaluatedAt: "2026-08-27T12:00:00Z", accession: "segments", documentUrl: "https://www.sec.gov/segments", documentName: "segments.htm" }).filter((item) => item.kind === "reverse_split");
    assert.deepEqual(findings.map((item) => [item.ratio, item.effective_date]), [["1-for-10", "2025-01-02"], ["1-for-20", "2025-02-03"]]);
  }
});

test("Sparse-5 MULN live inline-XBRL shape yields only dated supported canonical actions", async () => {
  const frozen = JSON.parse(await readFile(new URL("../evaluation/live/2026-08-27-sparse-5/raw/MULN.json", import.meta.url), "utf8"));
  assert.equal(frozen.report.sections.reverse_splits.items.length, 18);
  assert.ok(frozen.report.sections.reverse_splits.items.some((item) => item.title === "Completed 1-for-1 reverse split"));
  assert.ok(frozen.report.sections.reverse_splits.items.some((item) => /May 4, 20$/.test(item.summary)));
  const html = `<table><tr><td>Upon approval by stockholders, the Company completed a 1-for-25 reverse stock split on May 4, 2023.</td><td>The Company completed a 1-for-9 reverse stock split on August 11, 2023.</td><td>After receiving stockholder approval, on December 21, 2023, the Company effectuated a 1-for-100 reverse stock split.</td></tr><tr><td>Stockholders authorized a reverse stock split at a ratio between 1-for-2 and 1-for-250.</td></tr></table>`;
  const result = await researchFixture({ ticker: "MULN", filings: [{ accessionNumber: "000143774925027016", form: "10-Q", filingDate: "2025-08-14", reportDate: "2025-06-30", primaryDocument: "muln-live.htm", items: "", primaryDocDescription: "Quarterly report" }], documents: { "muln-live.htm": html } });
  assert.deepEqual(result.report.sections.reverse_splits.items.map((item) => [item.title.match(/1-for-\d+/)?.[0], item.event_date]), [["1-for-25", "2023-05-04"], ["1-for-9", "2023-08-11"], ["1-for-100", "2023-12-21"]]);
  assert.equal(result.report.sections.reverse_splits.items.some((item) => /1-for-(?:1|2|250)\b/.test(item.title)), false);
  const diagnostics = result.evidence_packet.corporate_action_diagnostics;
  assert.ok(diagnostics.every((item) => ["accepted", "merged", "withheld", "rejected"].includes(item.disposition)));
  assert.ok(diagnostics.filter((item) => item.disposition === "accepted").every((item) => item.canonical_event_id));
  assert.ok(diagnostics.some((item) => item.reason === "authorization_range_is_not_a_completed_action" && item.canonical_event_id === null));
  assert.equal(JSON.stringify(result.report).includes("corporate_action_diagnostics"), false);
});

test("Sparse-2 capital evidence remains Limited for explicit evidence-gate reasons", async () => {
  const result = await researchHistorical("BIOR", { cik: 1580063, name: "Biora Therapeutics, Inc.", documents: {
    "d463897dars.pdf": "The Company completed a 1-for-25 reverse stock split effective January 3, 2023.",
    "bior-20241009.htm": "The Company completed a 1-for-10 reverse stock split effective October 18, 2024.",
    "d899591d8k.htm": "The Company entered into a securities purchase agreement and issued and sold common stock. Warrants are exercisable for shares of common stock."
  } });
  const scored = calibrateReportScores(result.report);
  assert.match(scored.scores.dilution_historical_severity.explanation, /bounded authoritative three-year history/i);
  assert.match(scored.scores.dilution_future_likelihood.explanation, /liquidity|resolved dilution history/i);
  assert.match(scored.scores.dilution_potential_impact.explanation, /numerator.*denominator/i);
  assert.match(scored.scores.reverse_split_risk.explanation, /resolved split history.*listing status/i);
  assert.ok(["limited_coverage", "unscored"].includes(scored.scores.dilution_historical_severity.state));
});

test("Sparse explanations retain evidence-backed current and historical identity", async () => {
  const result = await researchHistorical("MULN", { cik: 1499961, name: "Bollinger Innovations, Inc.", documents: { "bollingerinnovations_8k.htm": "Mullen Automotive Inc. changed its name to Bollinger Innovations, Inc. and ticker MULN changed to BINI effective July 28, 2025. Trading will be suspended and commence on OTCID under BINI on October 13, 2025." } });
  const report = calibrateReportScores(result.report); const claimMap = new Map(report.claims.map((item) => [item.id, item]));
  const current = claimMap.get("claim-sec-identity"); const prior = report.issuer.prior_identities.find((item) => item.ticker === "MULN");
  assert.match(current.text, /requested ticker MULN.*current ticker is BINI.*OTCID/i);
  assert.match(claimMap.get(prior.claim_ids[0]).text, /historical ticker MULN.*current ticker BINI/i);
  assert.match(report.scores.dilution_potential_impact.explanation, /required/i);
  assert.equal(reportValidator(report).valid, true, JSON.stringify(reportValidator(report).errors));
});

test("TUP and TUPBQ resolve delisted OTC lineage with Chapter 11 and going concern", async () => {
  for (const ticker of ["TUP", "TUPBQ"]) {
    const result = await researchHistorical(ticker, { cik: 1008654, name: "Tupperware Brands Corporation", documents: {
      "tup-20221231.htm": "The conditions raise substantial doubt about the Company's ability to continue as a going concern.",
      "tup-20240917.htm": "The Corporation filed voluntary petitions to commence proceedings under chapter 11 of the Bankruptcy Code. NYSE notified the Corporation it determined to commence proceedings to delist the common stock. Trading was suspended and commenced on the OTC Expert Market as TUPBQ."
    } });
    assert.equal(result.report.security.listing_venue, "OTC Expert Market");
    assert.equal(result.report.security.listing_status, "delisted");
    assert.equal(result.evidence_packet.identity_resolution.current_ticker, "TUPBQ");
    assert.equal(result.report.financial_assessment.going_concern.state, "confirmed");
    assert.ok(result.report.financial_assessment.material_warnings.some((item) => /Bankruptcy/i.test(item.title)));
    assert.ok(result.report.sources.some((item) => item.id === "source-sec-historical-identity" && item.url.endsWith("/000100865424000068/tup-20240917.htm")));
    const finalized = calibrateReportScores(result.report);
    assert.match(finalized.financial_assessment.going_concern.summary, /substantial doubt/i);
    assert.match(finalized.claims.find((item) => item.id === "claim-sec-identity").text, /current ticker is TUPBQ.*OTC Expert Market/i);
    assert.match(finalized.scores.financial_health.explanation, /going-concern|critical warning/i);
    assert.equal(reportValidator(finalized).valid, true, JSON.stringify(reportValidator(finalized).errors));
  }
});

test("NIO IFRS summary and scoring share the newest comparable annual revenue and loss series", async () => {
  const annual = (value, year, tagAccn) => fact(value, { start: `${year}-01-01`, end: `${year}-12-31`, filed: `${year + 1}-04-10`, form: "20-F", accn: tagAccn });
  const result = await researchFixture({ ticker: "NIO", companyFacts: { cik: 1, entityName: "NIO Corp.", facts: { "ifrs-full": {
    Revenue: concept("Revenue", [annual(55_617_933_000, 2023, "r23"), annual(65_731_559_000, 2024, "r24"), annual(87_487_510_000, 2025, "r25"), fact(167_180_000, { start: "2023-01-01", end: "2023-12-31", filed: "2024-04-09", form: "20-F", accn: "stale-custom" })], "CNY"),
    ProfitLossAttributableToOwnersOfParent: concept("Loss attributable to owners", [annual(-20_719_800_000, 2023, "p23"), annual(-22_401_700_000, 2024, "p24"), annual(-23_100_000_000, 2025, "p25")], "CNY")
  } } } });
  const revenue = result.report.financial_assessment.metrics.revenue; const loss = result.report.financial_assessment.metrics.profitability;
  assert.equal(revenue.value, 87_487_510_000); assert.equal(revenue.period_end, "2025-12-31");
  assert.equal(revenue.annual_observations.at(-1).value, revenue.value);
  assert.equal(loss.value, -23_100_000_000); assert.equal(loss.annual_observations.length, 3);
  const scored = calibrateReportScores(result.report);
  assert.equal(scored.scores.financial_revenue_trend.state, "confirmed");
  assert.equal(scored.scores.financial_net_income_trend.state, "confirmed");
  assert.match(scored.scores.financial_revenue_trend.explanation, /annual periods/i);
  assert.match(scored.scores.financial_net_income_trend.explanation, /annual periods/i);
  assert.equal(result.report.financial_assessment.reporting_currency, "CNY");
});

test("NIO issuer-specific SEC taxonomy normalizes attributable annual net loss", async () => {
  const annual = (value, year, accn) => fact(value, { start: `${year}-01-01`, end: `${year}-12-31`, filed: `${year + 1}-04-10`, form: "20-F", accn });
  const result = await researchFixture({ ticker: "NIO", cik: 1736541, companyFacts: { cik: 1736541, entityName: "NIO Inc.", facts: { nio: {
    NetLossAttributableToOrdinaryShareholdersOfNioInc: concept("Net loss attributable to NIO Inc. ordinary shareholders", [annual(-20_700_000_000, 2023, "n23"), annual(-22_400_000_000, 2024, "n24"), annual(-23_100_000_000, 2025, "n25")], "CNY")
  } } } });
  const metric = result.report.financial_assessment.metrics.profitability;
  assert.equal(metric.value, -23_100_000_000); assert.equal(metric.unit, "CNY"); assert.deepEqual(metric.annual_observations.map((item) => item.value), [-20_700_000_000, -22_400_000_000, -23_100_000_000]);
  assert.equal(calibrateReportScores(result.report).scores.financial_net_income_trend.state, "confirmed");
});

test("NIO Sparse-3 live-style extension label is accepted only for its CIK and CNY unit", async () => {
  const annual = (value, year, accn) => fact(value, { start: `${year}-01-01`, end: `${year}-12-31`, filed: `${year + 1}-04-10`, form: "20-F", accn });
  const companyFacts = { cik: 1736541, entityName: "NIO Inc.", facts: { nio: { UnexpectedAttributableLossTag: concept("Net loss attributable to ordinary shareholders of NIO Inc.", [annual(-20_700_000_000, 2023, "n23"), annual(-22_400_000_000, 2024, "n24"), annual(-23_100_000_000, 2025, "n25")], "CNY") } } };
  const accepted = await researchFixture({ ticker: "NIO", cik: 1736541, companyFacts });
  assert.deepEqual(accepted.report.financial_assessment.metrics.profitability.annual_observations.map((item) => item.value), [-20_700_000_000, -22_400_000_000, -23_100_000_000]);
  const rejected = await researchFixture({ ticker: "OTHER", cik: 1, companyFacts: { ...companyFacts, cik: 1, entityName: "OTHER Corp." } });
  assert.equal(rejected.report.financial_assessment.metrics.profitability.state, "unknown");
});

test("rejected NIO Company Facts concepts retain bounded structural diagnostics only", async () => {
  const companyFacts = { cik: 1736541, entityName: "NIO Corp.", facts: {
    "ifrs-full": { Revenue: concept("Revenue", [fact(65_731_600_000, { start: "2024-01-01", end: "2024-12-31", filed: "2025-04-10", form: "20-F", accn: "nio-revenue" })], "CNY") },
    nio: { AmbiguousLossMeasure: concept("Loss allocated to equity holders", [fact(-22_400_000_000, { start: "2024-01-01", end: "2024-12-31", filed: "2025-04-10", form: "20-F", accn: "nio-loss" })], "CNY") }
  } };
  const result = await researchFixture({ ticker: "NIO", cik: 1736541, companyFacts });
  assert.equal(result.report.financial_assessment.metrics.profitability.state, "unknown");
  assert.match(result.report.financial_assessment.metrics.profitability.summary, /revenue history was usable.*attributable annual net-loss normalization remained unavailable/i);
  const diagnostic = result.evidence_packet.normalization_diagnostics.find((item) => item.concept_tag === "AmbiguousLossMeasure");
  assert.deepEqual(diagnostic, { taxonomy_namespace: "nio", concept_tag: "AmbiguousLossMeasure", label: "Loss allocated to equity holders", semantic_category: "non_equivalent_or_unestablished", unit: "CNY", currency: "CNY", start_date: "2024-01-01", end_date: "2024-12-31", duration_days: 365, cadence: "annual", accession: "nio-loss", form: "20-F", rejection_reason: "attributable_profit_loss_semantics_not_established", issuer_cik: "0001736541" });
  assert.equal(JSON.stringify(result.report).includes("AmbiguousLossMeasure"), false);
  assert.equal("val" in diagnostic, false);
});

test("Sparse-5 NIO rejected concepts are non-equivalent to attributable ordinary-shareholder net loss", () => {
  const candidates = [
    ["ComprehensiveIncomeNetOfTax", "Comprehensive Income (Loss), Net of Tax, Attributable to Parent", "comprehensive_income_not_net_income"],
    ["ComprehensiveIncomeNetOfTaxIncludingPortionAttributableToNoncontrollingInterest", "Comprehensive Income (Loss), Net of Tax, Including Portion Attributable to Noncontrolling Interest", "comprehensive_income_not_net_income"],
    ["NetIncomeLossAttributableToNoncontrollingInterest", "Net Income (Loss) Attributable to Noncontrolling Interest", "noncontrolling_interest_only"],
    ["OtherComprehensiveIncomeForeignCurrencyTranslationAdjustmentTaxPortionAttributableToParent", "Other Comprehensive Income (Loss), Foreign Currency Translation Adjustment, Tax, Portion Attributable to Parent", "comprehensive_income_not_net_income"],
    ["ProfitLoss", "Net Income (Loss), Including Portion Attributable to Noncontrolling Interest", "consolidated_profit_loss_including_noncontrolling_interest"]
  ];
  for (const [tag, label, expected] of candidates) assert.equal(classifyProfitConceptSemantics({ tag, label }), expected);
  assert.equal(candidates.some(([tag, label]) => classifyProfitConceptSemantics({ tag, label }) === "attributable_to_ordinary_shareholders"), false);
});

test("NIO remains Limited when only Sparse-5 non-equivalent SEC concepts exist", async () => {
  const annual = (value, year, accn) => fact(value, { start: `${year}-01-01`, end: `${year}-12-31`, filed: `${year + 1}-04-10`, form: "20-F", accn });
  const candidate = (label, tag) => [tag, concept(label, [annual(-20, 2023, `${tag}-23`), annual(-22, 2024, `${tag}-24`)], "CNY")];
  const facts = Object.fromEntries([
    candidate("Comprehensive Income (Loss), Net of Tax, Attributable to Parent", "ComprehensiveIncomeNetOfTax"),
    candidate("Comprehensive Income (Loss), Net of Tax, Including Portion Attributable to Noncontrolling Interest", "ComprehensiveIncomeNetOfTaxIncludingPortionAttributableToNoncontrollingInterest"),
    candidate("Net Income (Loss) Attributable to Noncontrolling Interest", "NetIncomeLossAttributableToNoncontrollingInterest"),
    candidate("Net Income (Loss), Including Portion Attributable to Noncontrolling Interest", "ProfitLoss")
  ]);
  const result = await researchFixture({ ticker: "NIO", cik: 1736541, companyFacts: { cik: 1736541, entityName: "NIO Inc.", facts: { "us-gaap": facts } } });
  assert.equal(result.report.financial_assessment.metrics.profitability.state, "unknown");
  assert.equal(calibrateReportScores(result.report).scores.financial_net_income_trend.value, null);
  assert.ok(result.evidence_packet.normalization_diagnostics.every((item) => item.semantic_category !== "attributable_to_ordinary_shareholders"));
});

test("terminal OTC reports label earlier exchange pressure as historical", async () => {
  for (const ticker of ["BIOR", "MULN", "TUPBQ"]) {
    const registry = { BIOR: [1580063, "Biora Therapeutics, Inc.", "bior-20241210.htm", "Nasdaq notified the Company that its securities were subject to delisting. Trading was suspended and began on OTC Pink."], MULN: [1499961, "Bollinger Innovations, Inc.", "bollingerinnovations_8k.htm", "Nasdaq notified the Company that its securities were subject to delisting. Trading was suspended and commenced on OTCID."], TUPBQ: [1008654, "Tupperware Brands Corporation", "tup-20240917.htm", "NYSE notified the Company that its securities were subject to delisting. Trading was suspended and commenced on OTC Expert Market."] }[ticker];
    const result = await researchHistorical(ticker, { cik: registry[0], name: registry[1], documents: { [registry[2]]: registry[3] } });
    assert.match(result.report.sections.compliance_and_warnings.summary, /currently .*delisted.*prior exchange deficiencies are historical/i);
    assert.ok(result.report.sections.compliance_and_warnings.items.every((item) => item.resolution_state === "historical" && item.title === "Historical exchange compliance event"));
  }
});

test("capital diagnostics enumerate missing evidence without forcing scores", async () => {
  const result = await researchHistorical("BIOR", { cik: 1580063, name: "Biora Therapeutics, Inc.", documents: { "bior-20241009.htm": "The Company completed a 1-for-10 reverse stock split effective October 18, 2024." } });
  const diagnostic = diagnoseCapitalScoreSufficiency(result.report);
  for (const value of Object.values(diagnostic)) { assert.ok(value.required_inputs.length); assert.ok(value.missing_inputs.length); assert.equal(value.final_state, "limited_coverage"); assert.equal(value.value, null); }
  assert.ok(diagnostic.reverse_split_risk.available_inputs.includes("current listing state"));
});

test("deterministic catalyst classifications always normalize to the report enum", () => {
  const cases = { accounting: "legal", bankruptcy: "corporate_action", restructuring: "corporate_action", listing: "regulatory", delisting: "regulatory", operational: "product", financing: "financing", contract: "contract", nonsense_internal_label: "other" };
  for (const [input, expected] of Object.entries(cases)) assert.equal(normalizeCatalystClassification(input), expected, input);
  const finding = extractSecFilingEvidence({ html: "Item 4.02. Previously issued financial statements should no longer be relied upon and will be restated.", form: "8-K", filed: "2026-01-10", accession: "accounting", documentUrl: "https://www.sec.gov/accounting.htm", documentName: "accounting.htm" }).find((item) => item.kind === "catalyst");
  assert.equal(finding.classification, "legal");
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

test("AMC comma-delimited historical split terms remain a completed canonical action", () => {
  const result = extractSecFilingEvidenceWithDiagnostics({
    html: "On August 24, 2023, the one-for-ten reverse stock split became effective.",
    form: "8-K", filed: "2023-08-14", evaluatedAt: "2026-08-28T00:00:00Z",
    accession: "amc-live-shaped", documentUrl: "https://www.sec.gov/amc-live-shaped", documentName: "amc-live-shaped.htm"
  });
  const split = result.findings.find((item) => item.kind === "reverse_split");
  assert.equal(split?.ratio, "1-for-10");
  assert.equal(split?.event_date, "2023-08-24");
  assert.equal(split?.action_state, "completed");
  assert.equal(result.corporate_action_diagnostics.find((item) => item.extracted_ratio === "1-for-10")?.disposition, "accepted");
});

test("AMC current filing selection promotes the completed split into the report", async () => {
  const result = await researchFixture({
    ticker: "AMC",
    filings: [{ accessionNumber: "0001104659-23-090981", form: "8-K", filingDate: "2023-08-14", reportDate: "2023-08-24", primaryDocument: "amc-split.htm", items: "5.03", primaryDocDescription: "Reverse split" }],
    documents: { "amc-split.htm": "On August 24, 2023, the one-for-ten reverse stock split became effective." },
    companyFacts: { cik: 1, entityName: "AMC Corp.", facts: {} }
  });
  assert.ok(result.report.sections.reverse_splits.items.some((item) => item.title === "Completed 1-for-10 reverse split" && item.event_date === "2023-08-24"));
});

test("AMC delayed ratio clause remains bound inside the expanded local split span", () => {
  const html = `The Company completed a reverse stock split pursuant to the plan. ${"inline XBRL context ".repeat(40)} At a ratio of 1-for-10, the action became effective August 24, 2023.`;
  const result = extractSecFilingEvidenceWithDiagnostics({
    html, form: "8-K", filed: "2023-08-14", evaluatedAt: "2026-08-28T00:00:00Z",
    accession: "amc-delayed-ratio", documentUrl: "https://www.sec.gov/amc-delayed-ratio", documentName: "amc-delayed-ratio.htm"
  });
  const split = result.findings.find((item) => item.kind === "reverse_split");
  assert.equal(split?.ratio, "1-for-10");
  assert.equal(split?.event_date, "2023-08-24");
  assert.equal(split?.action_state, "completed");
  assert.equal(result.corporate_action_diagnostics.find((item) => item.extracted_ratio === "1-for-10")?.canonical_acceptance_invariant_passed, true);
});

test("NCPL live-shaped Item 4.02 prevention-of-reliance language is extracted and invalidates affected metrics", async () => {
  const result = await researchFixture({
    ticker: "NCPL",
    filings: [{ accessionNumber: "0001493152-26-038853", form: "8-K", filingDate: "2026-08-18", reportDate: "2026-08-18", primaryDocument: "form8-k.htm", items: "4.01 4.02 9.01", primaryDocDescription: "Auditor change and non-reliance" }],
    documents: {
      "form8-k.htm": "Item 4.02. Non-Reliance on Previously Issued Financial Statements or a Related Audit Report or Completed Interim Review. On August 12, 2026, the auditor advised that action should be taken to prevent future reliance on affected previously issued financial statements and related audit reports."
    },
    companyFacts: { cik: 1, entityName: "NCPL Corp.", facts: { "us-gaap": { NetCashProvidedByUsedInOperatingActivities: concept("OCF", [fact(-8, { start: "2026-01-01", end: "2026-06-30" }), fact(-4, { start: "2025-01-01", end: "2025-06-30", filed: "2025-08-15", accn: "prior" })]) } } }
  });
  const warning = result.report.financial_assessment.material_warnings.find((item) => item.kind === "accounting" && item.severity === "critical");
  assert.ok(warning, "critical non-reliance warning should be retained");
  assert.match(warning.summary, /prevent future reliance|previously issued financial statements/i);
  assert.equal(result.report.financial_assessment.metrics.operating_cash_flow.state, "limited_coverage");
  assert.equal(calibrateReportScores(result.report).scores.financial_operating_cash_flow_trend.value, null);
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
