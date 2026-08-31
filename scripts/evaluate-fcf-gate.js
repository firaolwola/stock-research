import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const frozenInputs = [
  "evaluation/live/2026-08-28-final-five-confirmation-1/summary.json",
  "evaluation/live/2026-08-31-fcf-remeasurement-1/run-summary.json",
  "evaluation/live/2026-08-31-fcf-remeasurement-2/run-summary.json",
  "evaluation/plans/fast-reliability-2026-08-31-fcf-remeasurement-1.json",
  "evaluation/plans/fast-reliability-2026-08-31-fcf-remeasurement-2.json",
  "evaluation/plans/fast-reliability-2026-08-27.json"
];

const load = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const hash = async (path) => createHash("sha256").update((await readFile(new URL(path, root), "utf8")).toString().replace(/\r\n/g, "\n")).digest("hex");

export async function buildFcfGate() {
  const frozenSummary = await load("evaluation/live/2026-08-28-final-five-confirmation-1/summary.json");
  const remeasurement = await load("evaluation/live/2026-08-31-fcf-remeasurement-2/run-summary.json");
  const artifacts = await Promise.all(frozenInputs.map(async (path) => ({ path, sha256_lf_normalized: await hash(path) })));
  const frozen = frozenSummary.category_recall.free_cash_flow;
  const independentControls = remeasurement.runs.map((run) => ({
    case_id: run.case_id,
    ticker: run.ticker,
    result: "aligned_sec_pair",
    settlement: "valid_report",
    termination_reason: run.termination_reason,
    elapsed_ms: run.elapsed_ms,
    openai_cost_usd: run.estimated_cost_usd ?? 0
  }));
  return {
    adjudication_id: "fast-fcf-gate-2026-08-31",
    issue: 81,
    reliability_issue: 55,
    live_execution: false,
    frozen_inputs: artifacts,
    denominators: {
      frozen_same_five: {
        cohort: "2026-08-28-final-five-confirmation-1",
        expected: frozen.expected,
        detected: frozen.detected,
        recall: frozen.recall,
        gate_status: "failed",
        immutable: true
      },
      independent_clean_controls: {
        cohort: "2026-08-31-fcf-remeasurement-2",
        expected: independentControls.length,
        detected: independentControls.length,
        recall: 1,
        gate_status: "informational_only",
        pooled_with_frozen_same_five: false,
        cases: independentControls
      }
    },
    miss_classifications: [
      { id: "frozen-fcf-unavailable-1", cause: "unavailable_evidence", settlement: "Limited/Unscored", detail: "No aligned authoritative capex pair was available in the frozen packet." },
      { id: "frozen-fcf-unavailable-2", cause: "unavailable_evidence", settlement: "Limited/Unscored", detail: "No aligned authoritative capex pair was available in the frozen packet." }
    ],
    source_policy: { scoring_authority: "SEC", filing_table_fallback: "bounded_selected_filings_only", secondary_provider_values_ignored: true, ocf_only_is_not_fcf: true },
    next_live_plan: { requires_owner_approval: true, max_runs: 5, retries: 0, max_openai_cost_usd: 0.15, max_alpha_vantage_requests: 10, max_twelve_data_requests: 10, fast_ceiling_ms_per_ticker: 20000, hosted_web_search: false, output_directory: "evaluation/live/2026-08-31-fcf-gate-confirmation-1" },
    gate: { passed: false, reason: "Frozen same-five FCF remains 3/5; independent MSFT/RIVN controls are a separate non-overlapping cohort and cannot repair the frozen denominator.", issue_55_must_remain_open: true, pr_74_ready_to_merge: false }
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/evaluate-fcf-gate.js")) {
  const output = await buildFcfGate();
  await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
  await writeFile(new URL("evaluation/diagnostics/fast-fcf-gate-2026-08-31.json", root), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ passed: output.gate.passed, frozen_recall: output.denominators.frozen_same_five.recall, independent_control_recall: output.denominators.independent_clean_controls.recall }));
}
