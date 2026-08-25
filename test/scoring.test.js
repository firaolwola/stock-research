import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildScoreRollup, calibrateReportScores, SCORING_METHODOLOGY_VERSION, SCORE_DEFINITIONS } from "../lib/scoring.js";

const load = async (name) => JSON.parse(await readFile(new URL(`../fixtures/reports/${name}.json`, import.meta.url), "utf8"));

test("score calibration is deterministic and exposes every construct input", async () => {
  const report = await load("complete");
  const first = calibrateReportScores(report);
  const second = calibrateReportScores(report);
  assert.deepEqual(first.scores, second.scores);
  assert.deepEqual(Object.keys(first.scores), Object.keys(SCORE_DEFINITIONS));
  for (const score of Object.values(first.scores)) {
    assert.equal(score.methodology_version, SCORING_METHODOLOGY_VERSION);
    assert.ok(score.explanation);
    assert.ok(score.time_horizon);
    assert.ok(score.components.length > 0);
  }
  assert.equal(first.scores.dilution_historical_severity.value, 2);
  assert.equal(first.scores.dilution_future_likelihood.value, 2.3);
  assert.equal(first.scores.dilution_potential_impact.value, 3.1);
  assert.equal(first.scores.reverse_split_risk.value, 1);
});

test("unknown evidence never becomes a low or favorable numeric score", async () => {
  const report = calibrateReportScores(await load("partial"));
  for (const score of Object.values(report.scores)) {
    assert.notEqual(score.state, "confirmed");
    assert.equal(score.value, null);
    assert.equal(score.confidence, "unknown");
  }
});

test("near-term setup changes independently from longer-term company quality", async () => {
  const base = await load("complete");
  base.catalyst_assessment.current.factors.potential_significance = { rating: "medium", explanation: "Supported terms indicate moderate potential significance.", claim_ids: ["claim-catalyst"] };
  base.catalyst_assessment.current.factors.specificity.claim_ids = ["claim-catalyst"];
  base.catalyst_assessment.near_term_implication.claim_ids = ["claim-catalyst", "claim-analogue-event", "claim-analogue-reaction"];
  const favorable = calibrateReportScores(base);
  const weakerInput = structuredClone(base);
  weakerInput.catalyst_assessment.current.factors.recency.rating = "low";
  weakerInput.catalyst_assessment.current.factors.specificity.rating = "low";
  weakerInput.catalyst_assessment.near_term_implication.direction = "weakens";
  const weaker = calibrateReportScores(weakerInput);
  assert.equal(favorable.scores.long_term_company_quality.value, weaker.scores.long_term_company_quality.value);
  assert.ok(favorable.scores.near_term_setup_quality.value > weaker.scores.near_term_setup_quality.value);
  assert.equal(favorable.scores.near_term_setup_quality.claim_ids.includes("claim-financial"), false);
});

test("optional roll-ups expose component values and propagate uncertainty", async () => {
  const complete = calibrateReportScores(await load("complete"));
  const risk = buildScoreRollup(complete.scores, { name: "Capital structure attention", score_keys: ["dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk"] });
  assert.equal(risk.state, "confirmed");
  assert.equal(risk.component_scores.length, 4);
  const partial = calibrateReportScores(await load("partial"));
  const unresolved = buildScoreRollup(partial.scores, { name: "Capital structure attention", score_keys: ["dilution_historical_severity", "reverse_split_risk"] });
  assert.equal(unresolved.value, null);
  assert.equal(unresolved.state, "limited_coverage");
  assert.throws(() => buildScoreRollup(complete.scores, { name: "Mixed", score_keys: ["financial_health", "reverse_split_risk"] }), /opposite score directions/);
});

test("calibrated wording avoids precise probabilities and advice", async () => {
  const report = calibrateReportScores(await load("complete"));
  const wording = Object.values(report.scores).map((score) => score.explanation).join(" ");
  assert.doesNotMatch(wording, /\b\d+(?:\.\d+)?%\s+(?:chance|probability|likely|odds)\b/i);
  assert.doesNotMatch(wording, /\b(?:buy|sell|entry price|exit price|position sizing|price target)\b/i);
});
