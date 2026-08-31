import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CALIBRATION_COMPONENTS, evaluateRelativeOrdering, evaluateScoreCalibration, calibrationSummary } from "../lib/score-calibration.js";

const root = new URL("../", import.meta.url);
const plan = JSON.parse(await readFile(new URL("evaluation/plans/fast-score-calibration-2026-08-31.json", root), "utf8"));
const planComponents = new Map(plan.score_components.map((component) => [component.key, component]));
const componentErrors = [];
for (const [key, definition] of Object.entries(CALIBRATION_COMPONENTS)) {
  const declared = planComponents.get(key);
  if (!declared || declared.direction !== definition.direction) componentErrors.push(`${key} direction metadata drift`);
}
if (planComponents.size !== Object.keys(CALIBRATION_COMPONENTS).length) componentErrors.push("calibration plan does not enumerate every score component");
const load = async (relative) => JSON.parse(await readFile(new URL(relative, root), "utf8"));

function annual(values, claimIds = ["claim-financial"]) {
  return values.map((value, index) => ({ value, unit: "USD millions", period_start: `${2024 + index}-01-01`, period_end: `${2024 + index}-12-31`, claim_ids: claimIds }));
}

function balances(values, claimIds = ["claim-financial"]) {
  return values.map((value, index) => ({ value, unit: "USD millions", period_start: `${2024 + index}-12-31`, period_end: `${2024 + index}-12-31`, claim_ids: claimIds }));
}

function trendReport(base, metricKey, values, pointInTime = false) {
  const report = structuredClone(base);
  report.financial_assessment.as_of = "2026-08-24";
  const metric = report.financial_assessment.metrics[metricKey];
  metric.state = "confirmed";
  metric.observations = pointInTime ? balances(values) : [];
  metric.annual_observations = pointInTime ? [] : annual(values);
  return report;
}

function listingPressureReport(base) {
  const report = structuredClone(base);
  report.sections.reverse_splits = {
    state: "confirmed", summary: "One completed reverse split was found.", coverage_notes: [], claim_ids: ["claim-splits"],
    items: [{ id: "split-1", kind: "reverse_split", title: "Completed reverse split", state: "confirmed", summary: "Completed reverse split.", event_date: "2025-01-02", corporate_action_state: "completed", claim_ids: ["claim-splits"] }]
  };
  report.sections.compliance_and_warnings = {
    state: "confirmed", summary: "An active exchange compliance notice remains.", coverage_notes: [], claim_ids: ["claim-warnings"],
    items: [{ id: "compliance-1", kind: "exchange_compliance", title: "Active listing deficiency", state: "confirmed", summary: "An active minimum bid deficiency remains.", event_date: "2026-08-01", resolution_state: "active", claim_ids: ["claim-warnings"] }]
  };
  return report;
}

const reports = {};
const caseResults = [];
for (const item of plan.cases) {
  const report = await load(item.fixture);
  reports[item.id] = report;
  caseResults.push({ id: item.id, ...evaluateScoreCalibration(report, item.expected) });
}
const base = reports["complete-control"];
const generated = {
  growth: trendReport(base, "revenue", [100, 120, 150]),
  decline: trendReport(base, "revenue", [150, 120, 100]),
  "declining-debt": trendReport(base, "debt", [150, 120, 100], true),
  "growing-debt": trendReport(base, "debt", [100, 130, 180], true),
  "clean-listing": base,
  "listing-pressure": listingPressureReport(base)
};
const orderingResults = plan.relative_ordering.map((rule) => {
  const comparison = evaluateRelativeOrdering(generated[rule.higher_report], generated[rule.lower_report], rule.score_key);
  return { id: rule.id, ...comparison };
});
const summary = calibrationSummary(caseResults);
const output = {
  plan_id: plan.plan_id,
  issue: plan.issue,
  methodology_version: plan.methodology_version,
  live_execution: false,
  plan_component_errors: componentErrors,
  cases: caseResults.map(({ id, valid, errors, components }) => ({ id, valid, errors, components })),
  relative_ordering: orderingResults,
  summary: { ...summary, ordering_passed: orderingResults.filter((x) => x.valid).length, ordering_total: orderingResults.length }
};
await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
await writeFile(new URL("evaluation/diagnostics/fast-score-calibration-2026-08-31.json", root), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.summary));
if (!summary.failed && !componentErrors.length && orderingResults.every((result) => result.valid)) process.exit(0);
process.exitCode = 1;
