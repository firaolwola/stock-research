import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const frozenArtifacts = [
  "evaluation/plans/fast-reliability-2026-08-27.json",
  "evaluation/live/2026-08-27/summary.json",
  "evaluation/live/2026-08-27-batch-2/summary.json",
  "evaluation/live/2026-08-27-batch-3/summary.json",
  "evaluation/live/2026-08-28-final-five-confirmation-1/summary.json",
  "evaluation/live/2026-08-27-sparse-1/summary.json",
  "evaluation/live/2026-08-27-sparse-2/summary.json",
  "evaluation/live/2026-08-27-sparse-3/summary.json",
  "evaluation/live/2026-08-27-sparse-4/summary.json",
  "evaluation/live/2026-08-27-sparse-5/summary.json",
  "evaluation/live/2026-08-28-sparse-expansion-1-verification-2/summary.json",
  "evaluation/live/2026-08-28-final-sparse-proof-verification-3/summary.json",
  "evaluation/live/2026-08-31-fcf-remeasurement-2/run-summary.json",
  "evaluation/plans/fast-score-calibration-2026-08-31.json",
  "evaluation/diagnostics/fast-score-calibration-2026-08-31.json"
];

const cohortDefinitions = [
  ["batch-1", "evaluation/live/2026-08-27/summary.json"],
  ["batch-2", "evaluation/live/2026-08-27-batch-2/summary.json"],
  ["batch-3", "evaluation/live/2026-08-27-batch-3/summary.json"],
  ["final-five-confirmation", "evaluation/live/2026-08-28-final-five-confirmation-1/summary.json"]
];

const sampleSizeMap = [
  { category: "completed_reverse_splits", independent_positive_cases: 5, status: "practical_minimum_but_small_audit_passed" },
  { category: "active_listing_deficiency", independent_positive_cases: 3, status: "practical_minimum_but_small" },
  { category: "going_concern_bankruptcy", independent_positive_cases: 4, status: "practical_minimum_but_small" },
  { category: "foreign_issuer_adr_ifrs", independent_positive_cases: 3, status: "practical_minimum_but_small" },
  { category: "otc_delisted", independent_positive_cases: 5, status: "practical_minimum_but_small" },
  { category: "free_cash_flow_trend", independent_positive_cases: 5, detected_in_frozen_same_five: 3, status: "coverage_limited_safe_settlement_separate" }
];

const missClassifications = [
  { id: "same-five-free-cash-flow", cause: "unavailable_evidence", status: "coverage_limited_numeric_gate", detail: "Two of five expected FCF pairs were unavailable or invalidated; numeric coverage remains separate from safe settlement." },
  { id: "batch-3-score-calibration", cause: "scoring", status: "historical_rubric_distinct_from_current_offline_matrix", detail: "Historical Batch 3 score-range results are preserved; the current deterministic calibration matrix is evaluated independently." },
  { id: "overlapping-cohort-recall", cause: "evaluation", status: "not_poolable", detail: "Same-five cohorts overlap and use different rubrics; no single pooled recall is defensible." },
  { id: "nio-attributable-annual-net-loss", cause: "unavailable_evidence", status: "correctly_limited", detail: "No safe authoritative attributable annual loss concept was available; this is excluded from system-miss counts." },
  { id: "historical-targeted-parser-misses", cause: "retrieval_or_normalization", status: "frozen_and_corrected_for_covered_shapes", detail: "AMC, NCPL, AAPL, NXL, SMCI, ONFO, and STN mechanisms were corrected or confirmed prospectively; historical misses remain unchanged." }
];

async function load(relative) {
  return JSON.parse(await readFile(new URL(relative, root), "utf8"));
}

async function hash(relative) {
  const text = await readFile(new URL(relative, root), "utf8");
  return createHash("sha256").update(text.toString().replace(/\r\n/g, "\n")).digest("hex");
}

function cohortRecord(id, summary) {
  const result = summary.overall_material_checks ?? summary.adjudication ?? {};
  const categoryRecall = summary.category_recall ?? {};
  return {
    id,
    source: cohortDefinitions.find(([key]) => key === id)?.[1] ?? null,
    expected_material_checks: result.expected ?? null,
    detected_material_checks: result.detected ?? null,
    recall: result.recall ?? null,
    category_recall: categoryRecall,
    valid_report_rate: summary.valid_report_rate ?? null,
    explanation_fidelity: summary.explanation_fidelity ?? null,
    settlement_accuracy: summary.settlement_accuracy ?? null,
    score_calibration: summary.score_calibration ?? null,
    severe_misleading_misses: summary.severe_misleading_misses ?? []
  };
}

export async function buildFinalAdjudication() {
  const cohortSummaries = await Promise.all(cohortDefinitions.map(async ([id, relative]) => cohortRecord(id, await load(relative))));
  const calibration = await load("evaluation/diagnostics/fast-score-calibration-2026-08-31.json");
  const fcfCoverage = await load("evaluation/diagnostics/fast-fcf-coverage-audit-2026-08-31.json");
  const reverseSplit = await load("evaluation/diagnostics/fast-reverse-split-adjudication-2026-08-31.json");
  const reverseSplitAuditPassed = reverseSplit.denominator?.recall === 1
    && reverseSplit.denominator?.precision === 1
    && reverseSplit.safe_settlement?.severe_misses === 0;
  const currentMisses = missClassifications.map((item) => item.id === "batch-3-score-calibration"
    ? { ...item, detail: `Historical Batch 3 score-range results remain frozen; current offline matrix pass rate is ${calibration.summary?.passed ?? 0}/${calibration.summary?.total ?? 0}.` }
    : item);
  const artifactHashes = await Promise.all(frozenArtifacts.map(async (path) => ({ path, sha256_lf_normalized: await hash(path) })));
  const finalFive = cohortSummaries.find((cohort) => cohort.id === "final-five-confirmation");
  const gate = {
    overall_recall_target: 0.95,
    overall_recall_established: false,
    overall_recall_reason: "Overlapping same-five cohorts use different rubrics; descriptive recall is reported per cohort and is not pooled.",
    adequately_sampled_category_target: 0.9,
    adequately_sampled_categories_pass: false,
    failing_categories: [],
    coverage_limited_categories: ["free_cash_flow_trend"],
    reverse_split_audit_passed: reverseSplitAuditPassed,
    fcf_numeric_coverage_proven: false,
    fcf_safe_unresolved_settlement_passed: fcfCoverage.denominator_views.safe_settlement.rate === 1,
    score_range_target: 0.9,
    score_range_pass_rate: calibration.summary?.pass_rate ?? 0,
    zero_unresolved_severe_misses_in_latest_targeted_shapes: true,
    passed: false,
    issue_55_must_remain_open: true,
    pr_74_ready_to_merge: false
  };
  return {
    adjudication_id: "fast-reliability-final-2026-08-31",
    issue: 78,
    issue_55: 55,
    live_execution: false,
    generated_at: "2026-08-31",
    frozen_artifacts: artifactHashes,
    cohorts: cohortSummaries,
    descriptive_comparison: {
      batch_1_recall: 0.6628,
      batch_2_recall: 0.8256,
      batch_3_recall: 0.9651,
      final_five_confirmation_recall: finalFive?.recall ?? 0.9535,
      pooling_allowed: false
    },
    sample_size_map: sampleSizeMap,
    unavailable_authoritative_evidence: [{ case: "NIO attributable annual net loss", classification: "unavailable_authoritative_evidence", counted_as_system_miss: false }],
    miss_classifications: currentMisses,
    gate,
    fcf_semantics: {
      numeric_coverage: fcfCoverage.denominator_views.strict_usable_fcf,
      safe_unresolved_settlement: fcfCoverage.denominator_views.safe_settlement,
      pooled_with_frozen_same_five: false
    },
    reverse_split_adjudication: reverseSplit,
    required_next_step: "Keep #55 and PR #74 open. The offline reverse-split audit passes five practical independent cases (15/15 canonical events) but remains a small, non-statistical sample. Treat numeric FCF coverage as unproven, safe unresolved settlement as a separate passed safety gate, and resolve remaining overall recall and score/explanation gaps before closure review."
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/evaluate-final-reliability.js")) {
  const output = await buildFinalAdjudication();
  await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
  await writeFile(new URL("evaluation/diagnostics/fast-reliability-final-2026-08-31.json", root), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ passed: output.gate.passed, issue_55_must_remain_open: output.gate.issue_55_must_remain_open, artifact_count: output.frozen_artifacts.length }));
}
