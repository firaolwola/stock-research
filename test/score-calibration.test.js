import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CALIBRATION_COMPONENTS, evaluateRelativeOrdering, evaluateScoreCalibration, inspectScoreFidelity } from "../lib/score-calibration.js";
import { calibrateReportScores, SCORE_DEFINITIONS } from "../lib/scoring.js";

const load = async (name = "complete") => JSON.parse(await readFile(new URL(`../fixtures/reports/${name}.json`, import.meta.url), "utf8"));
const annual = (values, claimIds = ["claim-financial"]) => values.map((value, index) => ({ value, unit: "USD millions", period_start: `${2024 + index}-01-01`, period_end: `${2024 + index}-12-31`, claim_ids: claimIds }));
const balances = (values) => values.map((value, index) => ({ value, unit: "USD millions", period_start: `${2024 + index}-12-31`, period_end: `${2024 + index}-12-31`, claim_ids: ["claim-financial"] }));

function withTrend(base, key, values, pointInTime = false) {
  const report = structuredClone(base);
  report.financial_assessment.as_of = "2026-08-24";
  report.financial_assessment.metrics[key].state = "confirmed";
  report.financial_assessment.metrics[key].observations = pointInTime ? balances(values) : [];
  report.financial_assessment.metrics[key].annual_observations = pointInTime ? [] : annual(values);
  return report;
}

test("calibration matrix covers every Methodology 2.1 score direction and horizon", async () => {
  assert.deepEqual(Object.keys(CALIBRATION_COMPONENTS).sort(), Object.keys(SCORE_DEFINITIONS).sort());
  const result = evaluateScoreCalibration(await load(), Object.fromEntries(Object.keys(SCORE_DEFINITIONS).map((key) => [key, { state: key === "financial_health" || key.includes("financial_") || key === "reverse_split_risk" ? "confirmed" : "limited_coverage" }])));
  assert.equal(result.valid, true, result.errors.join("; "));
  for (const [key, [direction, horizon]] of Object.entries(SCORE_DEFINITIONS)) {
    assert.equal(result.scores[key].direction, direction);
    assert.equal(result.scores[key].time_horizon, horizon);
  }
});

test("confirmed financial explanations name normalized values and dated evidence", async () => {
  const report = await load();
  const scores = calibrateReportScores(report).scores;
  for (const key of ["financial_revenue_trend", "financial_net_income_trend", "financial_debt_trend", "financial_free_cash_flow_trend", "financial_cash_trend", "financial_operating_cash_flow_trend"]) {
    const score = scores[key];
    assert.equal(score.state, "confirmed", key);
    assert.match(score.explanation, /Observed normalized SEC values:/, key);
    assert.ok(score.claim_ids.length > 0, key);
    assert.equal(inspectScoreFidelity(report, score, key).valid, true, key);
  }
});

test("missing, stale, conflicting, and secondary financial evidence remains Limited/Unscored", async () => {
  const partial = await load("partial");
  const partialResult = evaluateScoreCalibration(partial);
  assert.equal(partialResult.valid, true, partialResult.errors.join("; "));
  assert.ok(Object.values(partialResult.scores).every((score) => score.state !== "confirmed" || Number.isFinite(score.value)));

  const stale = await load(); stale.financial_assessment.as_of = "2028-12-31";
  assert.equal(calibrateReportScores(stale).scores.financial_revenue_trend.state, "limited_coverage");
  const conflict = await load(); conflict.claims.find((claim) => claim.id === "claim-financial").state = "conflicting";
  assert.equal(calibrateReportScores(conflict).scores.financial_free_cash_flow_trend.state, "limited_coverage");
  const secondary = await load();
  secondary.financial_assessment.metrics.revenue.observations = [];
  secondary.financial_assessment.metrics.revenue.annual_observations = annual([10, 12], ["claim-catalyst-value-conflict"]);
  assert.equal(calibrateReportScores(secondary).scores.financial_revenue_trend.state, "limited_coverage");
});

test("relative ordering is company-relative and direction-aware", async () => {
  const base = await load();
  const growth = withTrend(base, "revenue", [100, 120, 150]);
  const decline = withTrend(base, "revenue", [150, 120, 100]);
  const revenue = evaluateRelativeOrdering(growth, decline, "financial_revenue_trend");
  assert.equal(revenue.valid, true);
  const decliningDebt = withTrend(base, "debt", [150, 120, 100], true);
  const growingDebt = withTrend(base, "debt", [100, 130, 180], true);
  assert.equal(evaluateRelativeOrdering(decliningDebt, growingDebt, "financial_debt_trend").valid, true);
});

test("unresolved scores never expose a fake numeric range", async () => {
  const report = await load("partial");
  const scores = calibrateReportScores(report).scores;
  for (const [key, score] of Object.entries(scores)) {
    if (score.state !== "confirmed") assert.equal(score.value, null, key);
  }
});
