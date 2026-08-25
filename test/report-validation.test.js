import assert from "node:assert/strict";
import test from "node:test";
import { createReportValidator } from "../lib/report-validation.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const validateReport = createReportValidator(await loadReportSchema());

test("shared complete and partial fixtures validate", async () => {
  for (const name of ["complete", "partial"]) {
    const result = validateReport(await loadReportFixture(name));
    assert.deepEqual(result, { valid: true, errors: [] }, `${name} fixture should validate`);
  }
});

test("invalid fixture data returns useful schema diagnostics", async () => {
  const report = await loadReportFixture("complete");
  report.schema_version = "not-supported";

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.type === "schema" && error.path === "/schema_version"));
});

test("broken claim/source links return useful semantic diagnostics", async () => {
  const report = await loadReportFixture("complete");
  report.claims[0].source_ids = ["source-missing"];

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.type === "semantic" && error.message.includes("source-missing")));
});

test("complete fixture demonstrates required source classes and explicit conflict", async () => {
  const report = await loadReportFixture("complete");
  const sourceTypes = new Set(report.sources.map((source) => source.source_type));

  for (const type of ["sec_filing", "exchange_notice", "company_release", "original_news", "secondary_aggregator"]) {
    assert.equal(sourceTypes.has(type), true, `fixture should include ${type}`);
  }
  const secondary = report.sources.find((source) => source.source_type === "secondary_aggregator");
  assert.equal(secondary.confidence, "low");
  const conflict = report.claims.find((claim) => claim.id === "claim-catalyst-value-conflict");
  assert.equal(conflict.state, "unknown");
  assert.ok(conflict.source_ids.length >= 2);
});

test("confirmed report records require exact sourced claim references", async () => {
  const report = await loadReportFixture("complete");
  report.sections.dilution.items[0].claim_ids = [];

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.message.includes("section item dilution-1 must reference a claim")));
});

test("secondary evidence must carry reduced confidence", async () => {
  const report = await loadReportFixture("complete");
  report.sources.push({
    id: "source-secondary-test",
    title: "Secondary Market Summary",
    url: "https://aggregator.example.com/acme",
    published_date: "2026-08-23",
    source_type: "secondary_aggregator",
    confidence: "high",
    retrieved_at: "2026-08-24T15:00:00Z",
    supported_claim_ids: ["claim-catalyst"]
  });
  report.claims.find((claim) => claim.id === "claim-catalyst").source_ids.push("source-secondary-test");

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.message.includes("cannot assign high confidence to secondary evidence")));
});

test("missing and malformed source data is rejected", async () => {
  const missing = await loadReportFixture("complete");
  missing.claims.find((claim) => claim.id === "claim-dilution").source_ids = [];
  assert.ok(validateReport(missing).errors.some((error) => error.message.includes("must cite evidence")));

  const malformed = await loadReportFixture("complete");
  malformed.sources[0].url = "not-a-direct-https-url";
  malformed.sources[0].published_date = "tomorrow";
  const result = validateReport(malformed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.type === "schema" && error.path === "/sources/0/url"));
  assert.ok(result.errors.some((error) => error.type === "schema" && error.path === "/sources/0/published_date"));

  const impossible = await loadReportFixture("complete");
  impossible.sources[0].title = " ";
  impossible.sources[0].published_date = "2026-08-25";
  const semanticResult = validateReport(impossible);
  assert.ok(semanticResult.errors.some((error) => error.message.includes("must have a useful title")));
  assert.ok(semanticResult.errors.some((error) => error.message.includes("before its publication date")));
});

test("conflicting primary and secondary evidence remains explicit and unscored", async () => {
  const report = await loadReportFixture("complete");
  report.metadata.completion_status = "partial";
  report.metadata.coverage_limitations = [{
    code: "conflicting_catalyst_terms",
    explanation: "Primary and secondary reports disagree about material contract terms.",
    affected_sections: ["catalysts_and_news", "catalyst_strength"]
  }];
  report.sections.catalysts_and_news.state = "unknown";
  report.sections.catalysts_and_news.summary = "Available sources conflict about the catalyst terms.";
  report.sections.catalysts_and_news.claim_ids = ["claim-catalyst-conflict"];
  report.sections.catalysts_and_news.items = [];
  report.scores.catalyst_strength.state = "unknown";
  report.scores.catalyst_strength.value = null;
  report.scores.catalyst_strength.explanation = "Conflicting evidence prevents scoring.";
  report.scores.catalyst_strength.claim_ids = ["claim-catalyst-conflict"];
  report.claims.push({
    id: "claim-catalyst-conflict",
    text: "Primary and secondary sources conflict about the contract terms.",
    materiality: "high",
    state: "unknown",
    as_of: "2026-08-24T15:00:00Z",
    source_ids: ["source-news", "source-secondary-conflict"]
  });
  report.sources.find((source) => source.id === "source-news").supported_claim_ids.push("claim-catalyst-conflict");
  report.sources.push({
    id: "source-secondary-conflict",
    title: "ACME Contract Terms Summary",
    url: "https://aggregator.example.com/acme-contract",
    published_date: "2026-08-23",
    source_type: "secondary_aggregator",
    confidence: "low",
    retrieved_at: "2026-08-24T15:00:00Z",
    supported_claim_ids: ["claim-catalyst-conflict"]
  });

  assert.deepEqual(validateReport(report), { valid: true, errors: [] });
});
