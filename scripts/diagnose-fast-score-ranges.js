import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCORE_KEYS = Object.freeze({
  financial_health: "financial_health", revenue: "financial_revenue_trend", net_income: "financial_net_income_trend",
  debt: "financial_debt_trend", free_cash_flow: "financial_free_cash_flow_trend", cash: "financial_cash_trend",
  operating_cash_flow: "financial_operating_cash_flow_trend", historical_dilution: "dilution_historical_severity",
  future_dilution: "dilution_future_likelihood", potential_dilution: "dilution_potential_impact",
  reverse_split: "reverse_split_risk", catalyst: "catalyst_strength", near_term_setup: "near_term_setup_quality"
});
const METRIC_KEYS = Object.freeze({ revenue: "revenue", net_income: "profitability", debt: "debt", free_cash_flow: "free_cash_flow", cash: "cash", operating_cash_flow: "operating_cash_flow" });

function sourcesFor(report, claimIds) {
  const claims = new Map(report.claims.map((item) => [item.id, item])); const sources = new Map(report.sources.map((item) => [item.id, item]));
  return [...new Set(claimIds.flatMap((id) => claims.get(id)?.source_ids ?? []))].map((id) => {
    const source = sources.get(id); return source ? { id, source_type: source.source_type, title: source.title, published_at: source.published_at } : { id, missing: true };
  });
}

function classification(expectedName, score, metric) {
  if (score.state !== "confirmed") {
    if (metric?.state === "confirmed" && (metric.observations?.length ?? 0) < 2 && (metric.annual_observations?.length ?? 0) < 2) return "legitimately Limited";
    if (metric?.state !== "confirmed") return "bad evidence retrieval";
    return "bad normalization";
  }
  return "scoring formula behavior";
}

export function buildScoreRangeDiagnostics(plan, rawReports) {
  const failures = [];
  for (const scenario of plan.cases) {
    const report = rawReports.get(scenario.ticker)?.report;
    if (!report) continue;
    for (const [expectedName, expectedRange] of Object.entries(scenario.score_ranges)) {
      const score = report.scores[SCORE_KEYS[expectedName]];
      const allowedLimited = scenario.limited_allowed?.includes(expectedName) && score?.state !== "confirmed";
      const passes = score?.state === "confirmed" && score.value >= expectedRange[0] && score.value <= expectedRange[1];
      if (passes) continue;
      const metric = METRIC_KEYS[expectedName] ? report.financial_assessment.metrics[METRIC_KEYS[expectedName]] : null;
      const claimIds = [...new Set([...(score?.claim_ids ?? []), ...(metric?.claim_ids ?? []), ...(metric?.observations ?? []).flatMap((item) => item.claim_ids ?? []), ...(metric?.annual_observations ?? []).flatMap((item) => item.claim_ids ?? [])])];
      failures.push({
        ticker: scenario.ticker, component: expectedName, expected_owner_range: expectedRange,
        actual: { state: score?.state ?? "missing", value: score?.value ?? null }, limited_settlement_allowed_by_baseline: Boolean(allowedLimited),
        normalized_inputs: metric ? { state: metric.state, current_value: metric.value, unit: metric.unit, observations: metric.observations ?? [], annual_observations: metric.annual_observations ?? [] } : null,
        selected_periods: metric ? [...(metric.observations ?? []), ...(metric.annual_observations ?? [])].map(({ period_start, period_end, value, unit }) => ({ period_start, period_end, value, unit })) : [],
        source_filings: sourcesFor(report, claimIds), formula_components: score?.components ?? [], confidence: score?.confidence ?? "unknown",
        reason: score?.explanation ?? "The score component was absent.", classification: classification(expectedName, score ?? {}, metric)
      });
    }
  }
  return { diagnostic_version: "1.0.0", methodology_version: "2.1.0", source_batch: "2026-08-27-batch-2", measured_results_unchanged: true, failed_cases: failures };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const plan = JSON.parse(await readFile(resolve(root, "evaluation/plans/fast-reliability-2026-08-27.json"), "utf8"));
  const reports = new Map();
  for (const scenario of plan.cases) reports.set(scenario.ticker, JSON.parse(await readFile(resolve(root, `evaluation/live/2026-08-27-batch-2/raw/${scenario.ticker}.json`), "utf8")));
  const output = resolve(root, "evaluation/diagnostics/fast-score-ranges-2026-08-27-batch-2.json");
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(buildScoreRangeDiagnostics(plan, reports), null, 2)}\n`);
  console.log(`Wrote ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
