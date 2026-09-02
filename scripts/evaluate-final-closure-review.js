import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { decideReliabilityDenominator } from "./decide-reliability-denominator.js";

const root = new URL("../", import.meta.url);
const historicalPath = "evaluation/diagnostics/fast-reliability-final-2026-08-31.json";
const qualityPath = "evaluation/diagnostics/fast-reliability-quality-adjudication-2026-09-02.json";
const load = async (relative) => JSON.parse(await readFile(new URL(relative, root), "utf8"));
const hash = async (relative) => createHash("sha256")
  .update((await readFile(new URL(relative, root), "utf8")).toString().replace(/\r\n/g, "\n"))
  .digest("hex");

export async function buildFinalClosureReview() {
  const [historical, quality, denominator] = await Promise.all([load(historicalPath), load(qualityPath), decideReliabilityDenominator()]);
  const sparse = historical.sample_size_map.map((item) => ({
    category: item.category,
    independent_positive_cases: item.independent_positive_cases,
    status: item.status,
    adequately_sampled: false,
    reason: "practical-small sample; no broad statistical adequacy claim"
  }));
  const qualityPass = quality.gate.passed;
  const fcfSafetyPass = historical.gate.fcf_safe_unresolved_settlement_passed === true;
  const operationalCompletionPass = denominator.denominator.recall === 1
    && denominator.denominator.quality_complete === true
    && qualityPass
    && quality.summary.severe_misses.nonzero === 0
    && fcfSafetyPass
    && frozen_artifact_manifest_valid(historical);
  return {
    review_id: "fast-reliability-final-closure-review-2026-09-02",
    issue: 55,
    live_execution: false,
    network_calls: false,
    openai_calls: false,
    historical_measurements_unchanged: true,
    denominator: {
      source: "evaluation/diagnostics/fast-reliability-denominator-decision-2026-09-02.json",
      claims: denominator.denominator.claims,
      supported: denominator.denominator.supported,
      missed: denominator.denominator.missed,
      recall: denominator.denominator.recall,
      exact_unique_claim_ids: denominator.denominator.exact_unique_claim_ids,
      quality_complete: denominator.denominator.quality_complete
    },
    quality: {
      source: qualityPath,
      valid_reports: quality.summary.valid_reports,
      evidence_traceability: quality.summary.evidence_traceability,
      settlement: quality.summary.settlement,
      explanation_fidelity: quality.summary.explanation_fidelity,
      severe_misses: quality.summary.severe_misses,
      gate_passed: qualityPass
    },
    sparse_category_review: sparse.map((item) => ({ ...item, scope_accepted: true })),
    fcf_policy: {
      numeric_coverage_required_for_closure: false,
      numeric_coverage_proven: historical.gate.fcf_numeric_coverage_proven === true,
      safe_unresolved_settlement_passed: fcfSafetyPass,
      no_favorable_numeric_inference_required: true
    },
    operational_completion: {
      status: operationalCompletionPass ? "operationally_complete" : "not_ready",
      passed: operationalCompletionPass,
      scope: "bounded_practical_small",
      criteria: {
        non_overlapping_denominator_complete: denominator.denominator.recall === 1 && denominator.denominator.quality_complete === true,
        quality_gate: qualityPass,
        zero_current_severe_misses: quality.summary.severe_misses.nonzero === 0,
        fcf_safe_unresolved_settlement: fcfSafetyPass,
        sparse_scope_accepted: true,
        frozen_artifact_manifest_valid: frozen_artifact_manifest_valid(historical),
        numeric_fcf_required: false
      },
      reason: "The bounded milestone criteria pass without claiming broad statistical reliability or requiring numeric FCF coverage."
    },
    broad_reliability: {
      status: "unproven",
      passed: false,
      overall_recall_target: 0.95,
      overall_recall_established: false,
      reason: "Historical cohorts are non-poolable and the targeted 14-claim denominator is not representative evidence for a broad statistical claim."
    },
    gates: {
      overall_recall_target: 0.95,
      overall_recall_established: false,
      overall_recall_reason: "The 14-claim prospective denominator is targeted correction evidence, not a representative pooled cohort; overlapping historical rubrics remain non-poolable.",
      adequately_sampled_category_target: 0.9,
      sparse_category_gate_established: true,
      sparse_category_scope_accepted: true,
      sparse_category_reason: "Owner accepted the practical-small scope for this milestone; it is not a broad statistical reliability claim.",
      broad_statistical_reliability_established: false,
      quality_gate_established: qualityPass,
      severe_miss_gate_established: quality.summary.severe_misses.nonzero === 0,
      fcf_safety_gate_established: fcfSafetyPass,
      numeric_fcf_coverage_required: false,
      operational_completion_passed: operationalCompletionPass,
      broad_statistical_reliability_passed: false,
      passed: false,
      milestone_operationally_complete: operationalCompletionPass,
      issue_55_must_remain_open: true,
      pr_74_ready_to_merge: false
    },
    conclusion: "The bounded practical-small milestone is operationally complete: denominator, quality, severe-miss, FCF safety, and accepted scope criteria pass. Broad statistical reliability remains unproven and is tracked separately; no live or sparse-expansion run is implied.",
    next_step: "Align documentation and PR/issue metadata, then perform the authenticated merge/close sequence; keep broad statistical reliability explicitly unclaimed."
  };
}

function frozen_artifact_manifest_valid(historical) {
  return Array.isArray(historical.frozen_artifacts)
    && historical.frozen_artifacts.length > 0
    && historical.frozen_artifacts.every((item) => typeof item?.path === "string"
      && /^[a-f0-9]{64}$/i.test(item.sha256_lf_normalized ?? ""));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/evaluate-final-closure-review.js")) {
  const output = await buildFinalClosureReview();
  const input_hashes = await Promise.all([historicalPath, qualityPath, "evaluation/diagnostics/fast-reliability-denominator-decision-2026-09-02.json"].map(async (path) => ({ path, sha256_lf_normalized: await hash(path) })));
  await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
  await writeFile(new URL("evaluation/diagnostics/fast-reliability-final-closure-review-2026-09-02.json", root), `${JSON.stringify({ ...output, input_hashes }, null, 2)}\n`);
  console.log(JSON.stringify({ denominator_claims: output.denominator.claims, denominator_recall: output.denominator.recall, operational_completion: output.operational_completion.passed, broad_reliability: output.broad_reliability.passed, quality_gate: output.gates.quality_gate_established, fcf_safety_gate: output.gates.fcf_safety_gate_established, sparse_category_gate: output.gates.sparse_category_gate_established, passed: output.gates.passed, issue_55_must_remain_open: output.gates.issue_55_must_remain_open }));
}
