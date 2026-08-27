import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import { finalizeResearchReport } from "../lib/finalize-research-report.js";
import { createReportValidator } from "../lib/report-validation.js";
import { calibrateReportScores, diagnoseCapitalScoreSufficiency } from "../lib/scoring.js";
import { boundedDocumentRows, createSecEvidenceClient } from "../lib/sec-evidence.js";
import { extractSecFilingEvidence, normalizeCatalystClassification } from "../lib/sec-filing-extraction.js";
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
