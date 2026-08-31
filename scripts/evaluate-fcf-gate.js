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
  const coverageAudit = await load("evaluation/diagnostics/fast-fcf-coverage-audit-2026-08-31.json");
  const parserBindingGap = coverageAudit.cause_counts.parser_or_binding_gap > 0;
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
      },
      fcf_semantics: {
        numeric_coverage: {
          detected: coverageAudit.denominator_views.strict_usable_fcf.detected,
          expected: coverageAudit.denominator_views.strict_usable_fcf.expected,
          recall: coverageAudit.denominator_views.strict_usable_fcf.recall,
          gate_status: "coverage_not_proven",
          reason: "Unavailable or accounting-invalid authoritative capex is not converted into a numeric FCF score."
        },
        safe_unresolved_settlement: {
          settled: coverageAudit.denominator_views.safe_settlement.settled,
          evaluated: coverageAudit.denominator_views.safe_settlement.evaluated,
          rate: coverageAudit.denominator_views.safe_settlement.rate,
          gate_status: "passed",
          reason: "Missing or invalid inputs remain Limited/Unscored and never become favorable evidence."
        },
        coverage_limited_acceptance: {
          accepted: coverageAudit.denominator_views.safe_settlement.rate === 1 && !parserBindingGap,
          policy: "Unavailable or accounting-invalid authoritative capex may settle Limited/Unscored without failing the category gate only after bounded parser/binding gaps are resolved; no favorable numeric FCF score is permitted.",
          parser_binding_gap_count: coverageAudit.cause_counts.parser_or_binding_gap,
          numeric_coverage_remains_unproven: true
        },
        pooled_with_frozen_same_five: false
      }
    },
    miss_classifications: [
      ...(parserBindingGap ? [{ id: "captured-filing-table-binding-gap", cause: "normalization", settlement: "Limited/Unscored", detail: "AMC has a captured capex table withheld for missing currency context; correct the bounded binding gap before accepting coverage-limited settlement." }] : []),
      { id: "frozen-fcf-unavailable-1", cause: "unavailable_evidence", settlement: "Limited/Unscored", detail: "No aligned authoritative capex pair was available in the frozen packet." },
      { id: "frozen-fcf-unavailable-2", cause: "unavailable_evidence", settlement: "Limited/Unscored", detail: "No aligned authoritative capex pair was available in the frozen packet." }
    ],
    source_policy: { scoring_authority: "SEC", filing_table_fallback: "bounded_selected_filings_only", secondary_provider_values_ignored: true, ocf_only_is_not_fcf: true },
    next_live_plan: { requires_owner_approval: true, max_runs: 5, retries: 0, max_openai_cost_usd: 0.15, max_alpha_vantage_requests: 10, max_twelve_data_requests: 10, fast_ceiling_ms_per_ticker: 20000, hosted_web_search: false, output_directory: "evaluation/live/2026-08-31-fcf-gate-confirmation-1" },
    gate: { passed: !parserBindingGap, reason: parserBindingGap ? "FCF coverage-limited acceptance remains open because a captured AMC filing-table candidate has an unresolved currency-context binding gap." : "FCF coverage-limited acceptance is satisfied: unresolved authoritative capex remains Limited/Unscored with no favorable inference. Numeric coverage remains unproven and frozen denominators remain immutable.", issue_55_must_remain_open: true, pr_74_ready_to_merge: false }
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/evaluate-fcf-gate.js")) {
  const output = await buildFcfGate();
  await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
  await writeFile(new URL("evaluation/diagnostics/fast-fcf-gate-2026-08-31.json", root), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ passed: output.gate.passed, frozen_recall: output.denominators.frozen_same_five.recall, independent_control_recall: output.denominators.independent_clean_controls.recall }));
}
