import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createReportValidator } from "../lib/report-validation.js";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const schema = await load("../schema/stock-report.schema.json");
const complete = await load("../fixtures/reports/complete.json");
const partial = await load("../fixtures/reports/partial.json");
const validate = createReportValidator(schema);

test("strong catalyst remains distinct from company quality and is fully traceable", () => {
  const result = validate(complete);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.notDeepEqual(complete.scores.catalyst_strength.claim_ids, complete.scores.long_term_company_quality.claim_ids);
  assert.ok(complete.catalyst_assessment.current.claim_ids.every((id) => complete.claims.find((claim) => claim.id === id)?.source_ids.length));
  assert.equal(complete.catalyst_assessment.historical_analogues.items[0].comparison_limitations.length, 3);
});

test("weak catalyst preserves unfavorable evidence without becoming advice", () => {
  const report = structuredClone(complete);
  report.catalyst_assessment.current.factors.specificity.rating = "low";
  report.catalyst_assessment.current.factors.novelty.rating = "low";
  report.catalyst_assessment.near_term_implication.direction = "mixed";
  report.catalyst_assessment.near_term_implication.summary = "Limited specificity and novelty weaken the evidence despite a confirmed event; the result does not predict a stock move.";
  assert.equal(validate(report).valid, true);
});

test("stale catalyst is represented explicitly", () => {
  const report = structuredClone(complete);
  report.catalyst_assessment.current.event_date = "2026-07-01";
  report.catalyst_assessment.current.factors.recency.rating = "low";
  report.catalyst_assessment.current.factors.recency.explanation = "The event is outside the most recent trading week and may already be reflected in the market context.";
  assert.equal(validate(report).valid, true);
});

test("ambiguous catalyst remains unknown and cannot produce a favorable setup score", () => {
  const result = validate(partial);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(partial.catalyst_assessment.current.state, "unknown");
  assert.equal(partial.scores.catalyst_strength.value, null);
  assert.equal(partial.scores.near_term_setup_quality.value, null);
});

test("unsupported catalyst and missing analogue produce unknown rather than invented history", () => {
  assert.equal(partial.catalyst_assessment.historical_analogues.state, "unknown");
  assert.deepEqual(partial.catalyst_assessment.historical_analogues.items, []);
  assert.match(partial.catalyst_assessment.historical_analogues.summary, /No reliably comparable prior issuer event/);
  assert.equal(validate(partial).valid, true);
});

test("historical analogues require comparison limits and valid reaction windows", () => {
  const noLimits = structuredClone(complete);
  noLimits.catalyst_assessment.historical_analogues.items[0].comparison_limitations = [];
  assert.ok(validate(noLimits).errors.some((error) => error.message.includes("must state comparison limitations")));
  const reversed = structuredClone(complete);
  reversed.catalyst_assessment.historical_analogues.items[0].reaction_windows[0].start = "2025-05-15";
  assert.ok(validate(reversed).errors.some((error) => error.message.includes("start cannot be after end")));
});

test("unsupported probability precision and advisory wording are rejected", () => {
  const precise = structuredClone(complete);
  precise.catalyst_assessment.near_term_implication.summary = "There is a 73% chance of a favorable reaction.";
  assert.ok(validate(precise).errors.some((error) => error.message.includes("unsupported numerical precision")));
  const advisory = structuredClone(complete);
  advisory.catalyst_assessment.near_term_implication.summary = "Buy before the event.";
  assert.ok(validate(advisory).errors.some((error) => error.message.includes("must remain non-advisory")));
});
