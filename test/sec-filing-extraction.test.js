import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractFilingCapitalExpenditureFacts, extractSecFilingEvidence, filingHtmlToText, findMaterialExhibitUrl, findMaterialExhibitUrls } from "../lib/sec-filing-extraction.js";

const samples = JSON.parse(await readFile(new URL("../fixtures/sec-filings/representative.json", import.meta.url), "utf8"));
const evaluation = JSON.parse(await readFile(new URL("../evaluation/cases.json", import.meta.url), "utf8"));
const extract = (html, form = "8-K") => extractSecFilingEvidence({ html: `<html><body>${html}</body></html>`, form, filed: "2026-08-24", accession: "0000000000-26-000001", documentUrl: "https://www.sec.gov/Archives/example.htm", documentName: "example.htm" });

test("bounded filing extraction covers representative material-risk language", () => {
  const findings = extract(Object.values(samples).filter((value) => typeof value === "string" && value.includes(".")).join(" "));
  for (const kind of ["reverse_split", "offering", "warrant", "convertible", "going_concern", "exchange_compliance", "non_reliance", "catalyst"]) assert.ok(findings.some((finding) => finding.kind === kind), kind);
  assert.equal(findings.find((finding) => finding.kind === "reverse_split").ratio, "1-for-100");
  assert.equal(findings.find((finding) => finding.kind === "offering").transaction_state, "actual_issuance");
  assert.equal(findings.find((finding) => finding.kind === "offering").value, 12_500_000);
});

test("registered capacity is not mislabeled as actual issuance", () => {
  const offering = extract(samples.registered_capacity, "F-3").find((finding) => finding.kind === "offering");
  assert.equal(offering.transaction_state, "registered_capacity"); assert.equal(offering.evidence_state, "limited_coverage");
});

test("HTML normalization removes code and resolves only SEC material exhibits", () => {
  assert.equal(filingHtmlToText("<style>private</style><p>A &amp; B</p><script>secret</script>"), "A & B");
  assert.equal(findMaterialExhibitUrl('<a href="ex99-1.htm">Exhibit 99.1</a>', "https://www.sec.gov/Archives/edgar/data/1/main.htm"), "https://www.sec.gov/Archives/edgar/data/1/ex99-1.htm");
  assert.deepEqual(findMaterialExhibitUrls('<a href="exh_991.htm">99.1</a><a href="ex-992xmda2025.htm">99.2</a>', "https://www.sec.gov/Archives/edgar/data/1/main.htm"), [
    "https://www.sec.gov/Archives/edgar/data/1/exh_991.htm",
    "https://www.sec.gov/Archives/edgar/data/1/ex-992xmda2025.htm"
  ]);
  assert.equal(findMaterialExhibitUrl('<a href="https://example.com/ex99-1.htm">Outside</a>', "https://www.sec.gov/a.htm"), null);
});

test("SEC filing-table capex extraction normalizes explicit annual values and provenance", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><caption>Years ended December 31 (USD in millions)</caption><tr><th>Years ended December 31</th><th>2025</th><th>2024</th></tr><tr><td>Capital expenditures</td><td>(2,000)</td><td>(1,000)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "annual-capex", documentUrl: "https://www.sec.gov/Archives/annual-capex.htm", documentName: "annual-capex.htm"
  });
  assert.deepEqual(result.facts.map(({ val, start, end, unit, source_type }) => ({ val, start, end, unit, source_type })), [
    { val: -2_000_000_000, start: "2025-01-01", end: "2025-12-31", unit: "USD", source_type: "sec_filing_table" },
    { val: -1_000_000_000, start: "2024-01-01", end: "2024-12-31", unit: "USD", source_type: "sec_filing_table" }
  ]);
  assert.equal(result.diagnostics[0].disposition, "accepted");
  assert.match(result.facts[0].source_url, /sec\.gov/);
});

test("SEC filing-table capex extraction selects an explicit Consolidated value from segmented annual tables", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: [
      `<table><tr><th>Year Ended</th></tr><tr><th>December 31, 2025</th></tr><tr><th>(In millions)</th><th>U.S. Markets</th><th>International Markets</th><th>Consolidated</th></tr><tr><td>Capital expenditures</td><td>174.2</td><td>71.9</td><td>246.1</td></tr></table>`,
      `<table><tr><th>Year Ended</th></tr><tr><th>December 31, 2024</th></tr><tr><th>(In millions)</th><th>U.S. Markets</th><th>International Markets</th><th>Consolidated</th></tr><tr><td>Capital expenditures</td><td>171.4</td><td>74.1</td><td>245.5</td></tr></table>`
    ].join(""),
    form: "10-K", filed: "2026-02-23", reportDate: "2025-12-31", accession: "amc-segmented-capex", currencyHint: "USD", documentUrl: "https://www.sec.gov/Archives/amc-segmented-capex.htm", documentName: "amc-segmented-capex.htm"
  });
  assert.deepEqual(result.facts.map(({ val, start, end, unit }) => ({ val, start, end, unit })), [
    { val: 246_100_000, start: "2025-01-01", end: "2025-12-31", unit: "USD" },
    { val: 245_500_000, start: "2024-01-01", end: "2024-12-31", unit: "USD" }
  ]);
  assert.equal(result.facts[0].capital_expenditure_type, "total_capital_expenditure");
  assert.ok(result.diagnostics.every((item) => item.disposition === "accepted" && item.column_selection === "explicit_consolidated"));
  assert.ok(result.diagnostics.every((item) => item.currency_source === "caller_hint"));
});

test("SEC filing-table capex extraction binds flattened segmented annual tables to Consolidated", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><tr><td><div>Year Ended</div><div>June 30, 2026</div><div>(In millions)</div><div>U.S. Markets International Markets Consolidated</div><div>Capital expenditures 174.2 71.9 246.1</div></td></tr></table>`,
    form: "10-K", filed: "2026-08-01", reportDate: "2026-06-30", accession: "amc-flattened-segmented-capex", currencyHint: "USD", documentUrl: "https://www.sec.gov/Archives/amc-flattened-segmented-capex.htm", documentName: "amc-flattened-segmented-capex.htm"
  });
  assert.deepEqual(result.facts.map(({ val, start, end, unit }) => ({ val, start, end, unit })), [
    { val: 246_100_000, start: "2026-01-01", end: "2026-06-30", unit: "USD" }
  ]);
  assert.equal(result.diagnostics[0].column_selection, "flattened_consolidated");
  assert.equal(result.diagnostics[0].disposition, "accepted");
});

test("SEC filing-table capex extraction binds a single flattened Consolidated value", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><tr><td><div>Year Ended</div><div>June 30, 2026</div><div>(In millions)</div><div>Consolidated Capital expenditures 246.1</div></td></tr></table>`,
    form: "10-K", filed: "2026-08-01", reportDate: "2026-06-30", accession: "amc-flattened-consolidated-capex", currencyHint: "USD", documentUrl: "https://www.sec.gov/Archives/amc-flattened-consolidated-capex.htm", documentName: "amc-flattened-consolidated-capex.htm"
  });
  assert.deepEqual(result.facts.map(({ val, start, end, unit }) => ({ val, start, end, unit })), [
    { val: 246_100_000, start: "2026-01-01", end: "2026-06-30", unit: "USD" }
  ]);
  assert.equal(result.diagnostics[0].column_selection, "flattened_consolidated_single");
  assert.equal(result.diagnostics[0].disposition, "accepted");
});

test("SEC filing-table capex extraction supports comparable quarterly and YTD columns", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><tr><th>Six months ended June 30</th><th>2026</th><th>2025</th></tr><tr><td>Payments to acquire property, plant and equipment (USD in thousands)</td><td>(12)</td><td>(10)</td></tr></table>`,
    form: "10-Q", filed: "2026-08-15", reportDate: "2026-06-30", accession: "ytd-capex", documentUrl: "https://www.sec.gov/Archives/ytd-capex.htm", documentName: "ytd-capex.htm"
  });
  assert.deepEqual(result.facts.map(({ val, start, end }) => ({ val, start, end })), [
    { val: -12_000, start: "2026-01-01", end: "2026-06-30" },
    { val: -10_000, start: "2025-01-01", end: "2025-06-30" }
  ]);
});

test("SEC filing-table capex extraction keeps separate qualifying intangible rows", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><caption>Years ended December 31 (USD in millions)</caption><tr><th>Years ended December 31</th><th>2025</th><th>2024</th></tr><tr><td>Purchases of patents</td><td>(4)</td><td>(3)</td></tr><tr><td>Purchases of trademarks</td><td>(2)</td><td>(1)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "intangible-capex", documentUrl: "https://www.sec.gov/Archives/intangible-capex.htm", documentName: "intangible-capex.htm"
  });
  assert.equal(result.facts.length, 4);
  assert.ok(result.facts.every((fact) => fact.capital_expenditure_type === "intangible_assets"));
  assert.deepEqual(result.facts.map(({ val, end }) => ({ val, end })), [
    { val: -4_000_000, end: "2025-12-31" }, { val: -3_000_000, end: "2024-12-31" },
    { val: -2_000_000, end: "2025-12-31" }, { val: -1_000_000, end: "2024-12-31" }
  ]);
  assert.notEqual(result.facts[0].source_id, result.facts[2].source_id, "each row retains distinct provenance");
  assert.ok(result.diagnostics.filter((item) => item.disposition === "accepted").every((item) => item.row_index !== null));
});

test("non-cash intangible disclosures are withheld from FCF extraction", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><caption>Years ended December 31 (USD in millions)</caption><tr><th>Years ended December 31</th><th>2025</th></tr><tr><td>Non-cash purchases of patents</td><td>(4)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "noncash-intangible", documentUrl: "https://www.sec.gov/Archives/noncash-intangible.htm", documentName: "noncash-intangible.htm"
  });
  assert.deepEqual(result.facts, []);
  assert.equal(result.diagnostics[0].reason, "non_cash_capex");
});

test("SEC filing-table capex extraction accepts a bounded adjacent unit note", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<p>Cash flow amounts are presented in USD in millions.</p><table><tr><th>Years ended December 31</th><th>2025</th><th>2024</th></tr><tr><td>Payments for property, plant and equipment</td><td>(12)</td><td>(10)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "adjacent-unit", documentUrl: "https://www.sec.gov/Archives/adjacent-unit.htm", documentName: "adjacent-unit.htm"
  });
  assert.deepEqual(result.facts.map(({ val, unit }) => ({ val, unit })), [{ val: -12_000_000, unit: "USD" }, { val: -10_000_000, unit: "USD" }]);
  assert.equal(result.diagnostics[0].disposition, "accepted");
});

test("adjacent capex units cannot cross a neighboring table boundary", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<table><tr><th>Revenue</th><th>2025</th></tr><tr><td>Revenue</td><td>100</td></tr></table><p>Revenue amounts are in EUR millions.</p><table><tr><th>Years ended December 31</th><th>2025</th></tr><tr><td>Capital expenditures</td><td>(12)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "boundary-unit", documentUrl: "https://www.sec.gov/Archives/boundary-unit.htm", documentName: "boundary-unit.htm"
  });
  assert.equal(result.facts[0].unit, "EUR");
});

test("filing-table capex extraction handles US-dollar scale notation", () => {
  const result = extractFilingCapitalExpenditureFacts({
    html: `<p>(US$ in millions)</p><table><tr><th>Year ended December 31</th><th>2025</th></tr><tr><td>Capital expenditures</td><td>(3.5)</td></tr></table>`,
    form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "us-dollar-scale", documentUrl: "https://www.sec.gov/Archives/us-dollar-scale.htm", documentName: "us-dollar-scale.htm"
  });
  assert.deepEqual(result.facts.map(({ val, unit }) => ({ val, unit })), [{ val: -3_500_000, unit: "USD" }]);
});

test("SEC filing-table capex fallback withholds ambiguous currency or column alignment", () => {
  const noCurrency = extractFilingCapitalExpenditureFacts({ html: "<table><tr><th>Years ended December 31</th><th>2025</th></tr><tr><td>Capital expenditures</td><td>(12)</td></tr></table>", form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "no-currency", documentUrl: "https://www.sec.gov/no-currency", documentName: "no-currency.htm" });
  assert.deepEqual(noCurrency.facts, []); assert.equal(noCurrency.diagnostics[0].reason, "currency_not_explicit");
  const mismatch = extractFilingCapitalExpenditureFacts({ html: "<table><tr><th>Years ended December 31 (USD in millions)</th><th>2025</th><th>2024</th></tr><tr><td>Capital expenditures</td><td>(12)</td></tr></table>", form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "mismatch", documentUrl: "https://www.sec.gov/mismatch", documentName: "mismatch.htm" });
  assert.deepEqual(mismatch.facts, []); assert.equal(mismatch.diagnostics[0].reason, "period_value_column_mismatch");
  const malformed = extractFilingCapitalExpenditureFacts({ html: "<div>Capital expenditures (USD in millions) 2025 (12)</div>", form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "malformed", documentUrl: "https://www.sec.gov/malformed", documentName: "malformed.htm" });
  assert.deepEqual(malformed.facts, []); assert.deepEqual(malformed.diagnostics, []);
  const unsupportedForm = extractFilingCapitalExpenditureFacts({ html: "<table><tr><th>Years ended December 31 (USD in millions)</th><th>2025</th></tr><tr><td>Capital expenditures</td><td>(12)</td></tr></table>", form: "8-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: "unsupported", documentUrl: "https://www.sec.gov/unsupported", documentName: "unsupported.htm" });
  assert.deepEqual(unsupportedForm.facts, []); assert.equal(unsupportedForm.diagnostics[0].reason, "form_not_supported");
});

for (const [ticker, label] of [
  ["AMC", "Payments to acquire property and equipment"],
  ["NCPL", "Capital additions"],
  ["NXL", "Purchase of property, plant and equipment"]
]) {
  test(`${ticker}-style filing-table capex shape is bounded and authoritative`, () => {
    const result = extractFilingCapitalExpenditureFacts({
      html: `<table><tr><th>Years ended December 31 (USD in millions)</th><th>2025</th><th>2024</th></tr><tr><td>${label}</td><td>(8)</td><td>(5)</td></tr></table>`,
      form: "10-K", filed: "2026-02-15", reportDate: "2025-12-31", accession: `${ticker.toLowerCase()}-capex`, documentUrl: `https://www.sec.gov/Archives/${ticker.toLowerCase()}-capex.htm`, documentName: `${ticker.toLowerCase()}-capex.htm`
    });
    assert.equal(result.facts.length, 2);
    assert.ok(result.facts.every((fact) => fact.source_type === "sec_filing_table" && fact.unit === "USD"));
    assert.ok(result.facts.every((fact) => fact.form === "10-K"));
  });
}

test("bounded extraction targets material-risk categories represented in the evaluation set", () => {
  const expected = new Set(evaluation.cases.flatMap((scenario) => scenario.known_material_facts ?? []).map((fact) => fact.category));
  const extracted = new Set(extract(Object.values(samples).filter((value) => typeof value === "string" && value.includes(".")).join(" ")).map((finding) => finding.category));
  for (const category of ["reverse_splits", "dilution_offerings", "warrants_convertibles", "compliance", "going_concern_accounting", "catalysts_news"]) {
    assert.equal(expected.has(category), true, `${category} missing from evaluation set`); assert.equal(extracted.has(category), true, `${category} missing from extraction fixture`);
  }
});

test("unrecognized selected filing text does not become reassuring not-found evidence", () => {
  const findings = extract("The selected filing could not be normalized into recognizable material-risk statements for this bounded pass.", "10-Q");
  assert.deepEqual(findings, []);
});

test("completed, authorized, and absent stock actions remain distinct", () => {
  const amc = extract("The Company filed a certificate of amendment to effect a reverse stock split at a ratio of 1-for-10. The reverse stock split became effective on August 24, 2023.").find((item) => item.kind === "reverse_split");
  const nxl = extract("Stockholders authorized the board to effect a reverse stock split at a ratio of 1-for-30 in the future.").find((item) => item.kind === "reverse_split");
  const smci = extract("The Company effected a ten-for-one stock split and split-adjusted trading commenced October 1, 2024.").find((item) => item.kind === "stock_split");
  assert.equal(amc.action_state, "completed"); assert.equal(amc.split_factor, .1);
  assert.equal(nxl.action_state, "authorized");
  assert.equal(smci.action_state, "completed"); assert.equal(smci.split_factor, 10);
  assert.equal(extract("No corporate-action disclosure is present.").some((item) => /split/.test(item.kind)), false);
});

test("reverse-split ratio tokens preserve complete multi-digit denominators", () => {
  const findings = extract([
    "The Company completed a 1-for-25 reverse stock split effective January 2, 2022.",
    "The Company completed a 1-for-100 reverse stock split effective January 2, 2023.",
    "The Company completed a 1-for-250 reverse stock split effective January 2, 2024.",
    "The Company completed a 1-for-1000 reverse stock split effective January 2, 2025."
  ].join(" ")).filter((item) => item.kind === "reverse_split");
  assert.deepEqual(findings.map((item) => item.ratio), ["1-for-25", "1-for-100", "1-for-250", "1-for-1000"]);
  assert.equal(findings.some((item) => ["1-for-2", "1-for-10"].includes(item.ratio)), false);
});

test("non-reliance requires event-specific language and does not absorb control warnings", () => {
  const actual = extract("Item 4.02 Non-Reliance on Previously Issued Financial Statements. The audit committee concluded that the statements should no longer be relied upon and will be restated.");
  assert.ok(actual.some((item) => item.kind === "non_reliance"));
  for (const boilerplate of [
    "Other information and forward-looking estimates should not be relied upon as guarantees of future results.",
    "Actual results may differ materially and estimates may change as additional information becomes available."
  ]) assert.equal(extract(boilerplate).some((item) => item.kind === "non_reliance"), false);
  const controls = extract("Management concluded that internal control over financial reporting was ineffective because a material weakness remained unremediated.", "10-K");
  assert.ok(controls.some((item) => item.kind === "accounting_warning"));
  assert.equal(controls.some((item) => item.kind === "non_reliance"), false);
});

test("exchange extraction distinguishes active and restored compliance", () => {
  const active = extract("Nasdaq notified the Company that it was not in compliance with the minimum bid price requirement.").find((item) => item.kind === "exchange_compliance");
  const restored = extract("Nasdaq notified the Company that it regained compliance with the continued listing standards and the matter is closed.").find((item) => item.kind === "exchange_compliance");
  assert.equal(active.resolution_state, "active"); assert.equal(restored.resolution_state, "resolved");
  assert.equal(extract("The common stock trades on Nasdaq.").some((item) => item.kind === "exchange_compliance"), false);
});
