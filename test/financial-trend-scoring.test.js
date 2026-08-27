import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calibrateReportScores } from "../lib/scoring.js";

const load = async () => JSON.parse(await readFile(new URL("../fixtures/reports/complete.json", import.meta.url), "utf8"));
const scoreKeys = {
  revenue: "financial_revenue_trend", profitability: "financial_net_income_trend", debt: "financial_debt_trend",
  free_cash_flow: "financial_free_cash_flow_trend", cash: "financial_cash_trend", operating_cash_flow: "financial_operating_cash_flow_trend"
};
const annual = (values, unit = "USD millions", claimIds = ["claim-financial"]) => values.map((value, index) => ({
  value, unit, period_start: `${2022 + index}-01-01`, period_end: `${2022 + index}-12-31`, claim_ids: claimIds
}));
const balances = (values, unit = "USD millions", claimIds = ["claim-financial"]) => values.map((value, index) => ({
  value, unit, period_start: `${2022 + index}-12-31`, period_end: `${2022 + index}-12-31`, claim_ids: claimIds
}));

async function trend(metricKey, values, { pointInTime = false } = {}) {
  const report = await load(); const metric = report.financial_assessment.metrics[metricKey];
  if (pointInTime) {
    const dates = ["2025-12-31", "2026-03-31", "2026-06-30"];
    metric.observations = values.map((value, index) => ({ value, unit: "USD millions", period_start: dates[index], period_end: dates[index], claim_ids: ["claim-financial"] }));
  } else metric.annual_observations = annual(values);
  return calibrateReportScores(report).scores[scoreKeys[metricKey]];
}

test("revenue rewards growth and penalizes decline without scoring company size", async () => {
  const smallGrowth = await trend("revenue", [2, 2.4, 3]);
  const largeDecline = await trend("revenue", [20_000, 18_000, 15_000]);
  assert.ok(smallGrowth.value > 5); assert.ok(largeDecline.value < 5); assert.ok(smallGrowth.value > largeDecline.value);
});

test("net income distinguishes shrinking losses, worsening losses, and profit crossover", async () => {
  const shrinking = await trend("profitability", [-20, -14, -8]);
  const worsening = await trend("profitability", [-8, -14, -20]);
  const crossover = await trend("profitability", [-10, -2, 6]);
  assert.ok(shrinking.value > worsening.value); assert.ok(crossover.value > shrinking.value);
});

test("debt rewards decline and penalizes rapid growth", async () => {
  const declining = await trend("debt", [100, 80, 60], { pointInTime: true });
  const growing = await trend("debt", [60, 85, 130], { pointInTime: true });
  assert.ok(declining.value > 5); assert.ok(growing.value < 5);
});

test("cash-flow scores distinguish positive improvement from negative deterioration", async () => {
  for (const metric of ["free_cash_flow", "operating_cash_flow"]) {
    const improving = await trend(metric, [-5, 2, 10]);
    const deteriorating = await trend(metric, [5, -2, -10]);
    assert.ok(improving.value > deteriorating.value, metric);
    assert.ok(improving.value > 5, metric); assert.ok(deteriorating.value < 5, metric);
  }
});

test("cash rewards growth and penalizes depletion only when fresh", async () => {
  const growth = await trend("cash", [20, 30, 45], { pointInTime: true });
  const depletion = await trend("cash", [45, 30, 15], { pointInTime: true });
  assert.ok(growth.value > 5); assert.ok(depletion.value < 5);
  const stale = await load(); stale.financial_assessment.as_of = "2027-12-31";
  assert.equal(calibrateReportScores(stale).scores.financial_cash_trend.state, "limited_coverage");
});

test("stale SEC flow history remains unscored", async () => {
  const report = await load(); report.financial_assessment.as_of = "2028-01-01";
  assert.equal(calibrateReportScores(report).scores.financial_revenue_trend.state, "limited_coverage");
  assert.equal(calibrateReportScores(report).scores.financial_operating_cash_flow_trend.value, null);
});

test("one observation, conflict, unit mismatch, and cadence mismatch remain unscored", async () => {
  const one = await load(); one.financial_assessment.metrics.revenue.annual_observations = annual([10]); one.financial_assessment.metrics.revenue.observations = [];
  assert.equal(calibrateReportScores(one).scores.financial_revenue_trend.value, null);

  const conflict = await load(); conflict.claims.find((claim) => claim.id === "claim-financial").state = "conflicting";
  assert.equal(calibrateReportScores(conflict).scores.financial_revenue_trend.value, null);

  const currency = await load(); currency.financial_assessment.metrics.revenue.annual_observations[1].unit = "EUR millions";
  assert.equal(calibrateReportScores(currency).scores.financial_revenue_trend.value, null);

  const cadence = await load(); cadence.financial_assessment.metrics.revenue.annual_observations[1].period_start = "2023-10-01";
  assert.equal(calibrateReportScores(cadence).scores.financial_revenue_trend.value, null);
});

test("secondary-provider financial observations are ignored for scoring", async () => {
  const report = await load();
  report.sources.push({ id: "source-discovery-financial", source_type: "other_secondary", title: "Discovery financial value", publisher: "Example discovery API", url: "https://example.test/value", published_date: "2026-08-24", accessed_at: "2026-08-24T15:00:00Z", confidence: "low", claim_ids: ["claim-discovery-financial"] });
  report.claims.push({ id: "claim-discovery-financial", section: "financial_context", text: "Secondary value.", state: "confirmed", materiality: "material", as_of: "2026-08-24", source_ids: ["source-discovery-financial"], conflict_note: null });
  report.financial_assessment.metrics.revenue.annual_observations = annual([10, 12], "USD millions", ["claim-discovery-financial"]);
  const score = calibrateReportScores(report).scores.financial_revenue_trend;
  assert.equal(score.state, "limited_coverage"); assert.equal(score.value, null); assert.match(score.explanation, /secondary-provider/i);
});
