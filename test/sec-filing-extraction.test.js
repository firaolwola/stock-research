import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractSecFilingEvidence, filingHtmlToText, findMaterialExhibitUrl } from "../lib/sec-filing-extraction.js";

const samples = JSON.parse(await readFile(new URL("../fixtures/sec-filings/representative.json", import.meta.url), "utf8"));
const evaluation = JSON.parse(await readFile(new URL("../evaluation/cases.json", import.meta.url), "utf8"));
const extract = (html, form = "8-K") => extractSecFilingEvidence({ html: `<html><body>${html}</body></html>`, form, filed: "2026-08-24", accession: "0000000000-26-000001", documentUrl: "https://www.sec.gov/Archives/example.htm", documentName: "example.htm" });

test("bounded filing extraction covers representative material-risk language", () => {
  const findings = extract(Object.values(samples).filter((value) => typeof value === "string" && value.includes(".")).join(" "));
  for (const kind of ["reverse_split", "offering", "warrant", "convertible", "going_concern", "exchange_compliance", "accounting_warning", "catalyst"]) assert.ok(findings.some((finding) => finding.kind === kind), kind);
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
