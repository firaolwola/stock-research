import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractSecFilingEvidence, filingHtmlToText, findMaterialExhibitUrl } from "../lib/sec-filing-extraction.js";

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
  assert.equal(findMaterialExhibitUrl('<a href="https://example.com/ex99-1.htm">Outside</a>', "https://www.sec.gov/a.htm"), null);
});

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
