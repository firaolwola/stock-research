import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";

const root = path.resolve(".");
const outputPath = process.argv[2] ?? "evaluation/diagnostics/fast-fcf-annual-policy-2026-08-31.json";
const cases = [
  ["AAPL", "evaluation/live/2026-08-31-fcf-gate-confirmation-1/raw/AAPL.json"],
  ["SMCI", "evaluation/live/2026-08-31-fcf-gate-confirmation-1/raw/SMCI.json"],
  ["MSFT", "evaluation/live/2026-08-31-fcf-remeasurement-2/raw/MSFT.json"],
  ["RIVN", "evaluation/live/2026-08-31-fcf-remeasurement-2/raw/RIVN.json"],
  ["AMC", "evaluation/live/2026-08-31-amc-fcf-confirmation-6/raw/AMC.json"]
];

async function loadJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function buildFcfAnnualPolicyAudit() {
  const schema = await loadJson("schema/stock-report.schema.json");
  const validate = createReportValidator(schema);
  const results = [];
  for (const [ticker, relativePath] of cases) {
    const raw = await loadJson(relativePath);
    const scored = calibrateReportScores(raw.report);
    const metric = scored.financial_assessment?.metrics?.free_cash_flow ?? {};
    const score = scored.scores?.financial_free_cash_flow_trend ?? {};
    const validation = validate(scored);
    const annual = metric.annual_observations ?? [];
    const interim = metric.observations ?? [];
    results.push({
      ticker,
      input: relativePath,
      report_valid_after_rescoring: validation.valid,
      annual_observation_count: annual.length,
      annual_periods: annual.map(({ period_start, period_end }) => ({ period_start, period_end })),
      interim_observation_count: interim.length,
      interim_periods: interim.map(({ period_start, period_end }) => ({ period_start, period_end })),
      interim_context: metric.interim_context ? {
        state: metric.interim_context.state,
        trend: metric.interim_context.trend,
        latest_value: metric.interim_context.latest_value,
        comparison_value: metric.interim_context.comparison_value,
        latest_period_end: metric.interim_context.latest_period_end,
        comparison_period_end: metric.interim_context.comparison_period_end
      } : null,
      recomputed_score_state: score.state ?? "missing",
      recomputed_score: score.value ?? null,
      score_explanation: score.explanation ?? null,
      score_uses_annual_primary: score.state === "confirmed" && /annual periods/.test(score.explanation ?? ""),
      safe_settlement: validation.valid && ["confirmed", "limited_coverage", "unknown"].includes(metric.state),
      frozen_saved_score: raw.report.scores?.financial_free_cash_flow_trend?.value ?? null
    });
  }
  const numeric = results.filter((item) => item.score_uses_annual_primary).length;
  const settled = results.filter((item) => item.safe_settlement).length;
  return {
    audit_id: "fast-fcf-annual-policy-2026-08-31",
    issue: 81,
    reliability_issue: 55,
    live_execution: false,
    network_calls: false,
    frozen_artifacts_modified: false,
    policy: {
      primary_fcf_trend: "comparable annual SEC observations only",
      interim_fcf: "separate dated freshness context; never mixed into the primary score",
      insufficient_annual_history: "Limited/Unscored"
    },
    cases: results,
    denominator_views: {
      annual_numeric_fcf: { detected: numeric, evaluated: results.length, recall: numeric / results.length, meaning: "Current scorer produces a numeric FCF trend from at least two comparable annual observations." },
      safe_settlement: { settled, evaluated: results.length, rate: settled / results.length, meaning: "Every stored case remains valid and unresolved evidence is not favorable evidence." }
    },
    conclusion: "Prospective offline recomputation only; historical calibration measurements and answer keys remain unchanged. A paid live remeasurement is not implied by this audit."
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/evaluate-fcf-annual-policy.js")) {
  const output = await buildFcfAnnualPolicyAudit();
  const absolutePath = path.join(root, outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ annual_numeric_recall: output.denominator_views.annual_numeric_fcf.recall, safe_settlement_rate: output.denominator_views.safe_settlement.rate, network_calls: false }, null, 2));
}
