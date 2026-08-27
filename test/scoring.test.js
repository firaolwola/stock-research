import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildScoreRollup, calibrateReportScores, LEGACY_SCORING_METHODOLOGY_VERSION, SCORING_METHODOLOGY_VERSION, SCORE_DEFINITIONS } from "../lib/scoring.js";

const load = async (name) => JSON.parse(await readFile(new URL(`../fixtures/reports/${name}.json`, import.meta.url), "utf8"));
const actualDilution = (report, percent = 20) => {
  report.sections.dilution.items = [{ ...report.sections.dilution.items[0], kind: "other_dilution", evidence_role: "actual_issuance", title: "Completed share issuance", summary: "Confirmed share-count increase.", value: percent, unit: "percent_of_shares" }];
  return report;
};
const scoreableCatalyst = (report) => {
  report.catalyst_assessment.current.claim_ids = ["claim-catalyst"];
  for (const factor of Object.values(report.catalyst_assessment.current.factors)) {
    factor.claim_ids = ["claim-catalyst"];
    if (!["high", "medium", "low"].includes(factor.rating)) factor.rating = "medium";
  }
  return report;
};
const marketContext = (report, price = 8, volume = 2) => {
  report.sections.financial_context.items.push(
    { id: "market-price", kind: "other", title: "EOD price change", state: "confirmed", summary: "Latest close versus prior close.", event_date: "2026-08-24", value: price, unit: "price_change_percent", claim_ids: ["claim-analogue-reaction"] },
    { id: "market-volume", kind: "other", title: "EOD relative volume", state: "confirmed", summary: "Latest volume versus baseline.", event_date: "2026-08-24", value: volume, unit: "volume_ratio", claim_ids: ["claim-analogue-reaction"] }
  );
  return report;
};

test("methodology 2 is deterministic, explicit, and preserves the 1.0 baseline", async () => {
  const report = marketContext(scoreableCatalyst(actualDilution(await load("complete"))));
  const first = calibrateReportScores(report); const second = calibrateReportScores(report);
  assert.equal(LEGACY_SCORING_METHODOLOGY_VERSION, "1.0.0");
  assert.equal(SCORING_METHODOLOGY_VERSION, "2.0.0");
  assert.deepEqual(first.scores, second.scores);
  assert.deepEqual(Object.keys(first.scores), Object.keys(SCORE_DEFINITIONS));
  for (const score of Object.values(first.scores)) assert.equal(score.methodology_version, "2.0.0");
  assert.equal(first.scores.long_term_company_quality.state, "limited_coverage");
});

test("actual dilution is distinct from registration-only evidence", async () => {
  const registration = calibrateReportScores(await load("complete"));
  assert.equal(registration.scores.dilution_historical_severity.value, null);
  assert.match(registration.scores.dilution_historical_severity.explanation, /registration/i);
  assert.equal(calibrateReportScores(actualDilution(await load("complete"), 20)).scores.dilution_historical_severity.value, 6);
  assert.equal(calibrateReportScores(actualDilution(await load("complete"), 80)).scores.dilution_historical_severity.value, 10);
});

test("warrants and convertibles need denominator-based share terms for impact", async () => {
  const report = await load("complete");
  report.sections.dilution.items = [{ ...report.sections.dilution.items[0], kind: "warrant", evidence_role: "instrument_overhang", value: 18, unit: "percent_of_shares" }];
  const scores = calibrateReportScores(report).scores;
  assert.equal(scores.dilution_historical_severity.value, null);
  assert.equal(scores.dilution_potential_impact.value, 6);
});

test("stale, conflicting, missing, and failed-provider evidence stays unscored", async () => {
  const partial = calibrateReportScores(await load("partial"));
  for (const score of Object.values(partial.scores)) { assert.notEqual(score.state, "confirmed"); assert.equal(score.value, null); }
  const stale = await load("complete"); stale.financial_assessment.state = "limited_coverage";
  assert.equal(calibrateReportScores(stale).scores.financial_health.value, null);
});

test("reverse-split risk uses corporate actions and specific listing pressure", async () => {
  assert.equal(calibrateReportScores(await load("complete")).scores.reverse_split_risk.value, 0);
  const r = await load("complete"); r.sections.reverse_splits.state = "confirmed";
  r.sections.reverse_splits.items = [{ id: "split", kind: "reverse_split", title: "Reverse split", state: "confirmed", summary: "Confirmed corporate action.", event_date: "2025-01-01", claim_ids: ["claim-splits"] }];
  r.sections.compliance_and_warnings.state = "confirmed";
  r.sections.compliance_and_warnings.items = [{ id: "notice", kind: "exchange_compliance", title: "Bid-price deficiency", state: "confirmed", summary: "Specific exchange notice.", event_date: "2026-08-01", claim_ids: ["claim-warnings"] }];
  assert.ok(calibrateReportScores(r).scores.reverse_split_risk.value >= 7);
});

test("financial health caps going-concern evidence and requires true FCF", async () => {
  assert.equal(calibrateReportScores(await load("complete")).scores.financial_health.state, "confirmed");
  const r = await load("complete"); r.financial_assessment.going_concern.state = "confirmed"; r.financial_assessment.going_concern.claim_ids = ["claim-warnings"];
  r.financial_assessment.material_warnings = [{ id: "gc", kind: "going_concern", state: "confirmed", severity: "high", title: "Going concern", as_of: "2026-08-24", summary: "Substantial doubt.", claim_ids: ["claim-warnings"] }];
  assert.ok(calibrateReportScores(r).scores.financial_health.value <= 2);
});

test("discovery-only catalyst cannot score, but promoted primary evidence can", async () => {
  const discovery = scoreableCatalyst(await load("complete"));
  discovery.sources.find((x) => x.id === "source-news").source_type = "secondary_aggregator";
  discovery.sources.find((x) => x.id === "source-original-news").source_type = "secondary_aggregator";
  assert.equal(calibrateReportScores(discovery).scores.catalyst_strength.value, null);
  assert.equal(calibrateReportScores(scoreableCatalyst(await load("complete"))).scores.catalyst_strength.state, "confirmed");
});

test("setup requires catalyst plus bounded EOD price and volume, never analogues", async () => {
  const r = scoreableCatalyst(await load("complete"));
  assert.equal(calibrateReportScores(r).scores.near_term_setup_quality.value, null);
  const score = calibrateReportScores(marketContext(r)).scores.near_term_setup_quality;
  assert.equal(score.state, "confirmed");
  assert.equal(score.claim_ids.includes("claim-analogue-event"), false);
  assert.match(score.explanation, /analogues.*excluded/i);
});

test("roll-ups propagate uncertainty and reject mixed directions", async () => {
  const scored = calibrateReportScores(actualDilution(await load("complete"), 20));
  assert.equal(buildScoreRollup(scored.scores, { name: "Risks", score_keys: ["dilution_historical_severity", "reverse_split_risk"] }).state, "confirmed");
  const partial = calibrateReportScores(await load("partial"));
  assert.equal(buildScoreRollup(partial.scores, { name: "Risks", score_keys: ["dilution_historical_severity", "reverse_split_risk"] }).state, "limited_coverage");
  assert.throws(() => buildScoreRollup(scored.scores, { name: "Mixed", score_keys: ["financial_health", "reverse_split_risk"] }), /opposite/);
});

test("wording avoids precise probabilities and advice", async () => {
  const wording = Object.values(calibrateReportScores(await load("complete")).scores).map((x) => x.explanation).join(" ");
  assert.doesNotMatch(wording, /\b\d+(?:\.\d+)?%\s+(?:chance|probability|likely|odds)\b/i);
  assert.doesNotMatch(wording, /\b(?:buy|sell|entry price|exit price|position sizing|price target)\b/i);
});
