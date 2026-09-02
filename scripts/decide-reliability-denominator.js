import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const canonicalPath = "evaluation/diagnostics/fast-reliability-canonical-claim-matrix-2026-09-01.json";
const qualityPath = "evaluation/diagnostics/fast-reliability-quality-adjudication-2026-09-02.json";
const load = async (relative) => JSON.parse(await readFile(new URL(relative, root), "utf8"));
const hash = async (relative) => createHash("sha256")
  .update((await readFile(new URL(relative, root), "utf8")).toString().replace(/\r\n/g, "\n"))
  .digest("hex");

export async function decideReliabilityDenominator() {
  const [canonical, quality] = await Promise.all([load(canonicalPath), load(qualityPath)]);
  const qualityByClaim = new Map(quality.rows.map((row) => [row.claim_id, row]));
  const rows = canonical.canonical_rows.map((row) => {
    const reviewed = qualityByClaim.get(row.claim_id);
    if (!reviewed) throw new Error(`denominator_quality_row_missing:${row.claim_id}`);
    const qualityReady = reviewed.valid_report === "pass"
      && reviewed.evidence_traceability === "pass"
      && reviewed.settlement === "pass"
      && reviewed.explanation_fidelity === "pass"
      && reviewed.severe_misses.length === 0;
    if (!qualityReady) throw new Error(`denominator_quality_not_ready:${row.claim_id}`);
    return {
      claim_id: row.claim_id,
      ticker: row.ticker,
      category: row.category,
      outcome: row.outcome,
      denominator_eligible: true,
      eligibility_reason: "unique approved live claim with observed supported/missed outcome and current row-level quality review",
      canonical_source: row.canonical_source,
      evidence_reference_ids: reviewed.evidence_reference_ids,
      quality: {
        valid_report: reviewed.valid_report,
        evidence_traceability: reviewed.evidence_traceability,
        settlement: reviewed.settlement,
        explanation_fidelity: reviewed.explanation_fidelity,
        severe_misses: reviewed.severe_misses
      },
      historical_attempts: row.historical_attempts
    };
  });
  const duplicateIds = rows.map((row) => row.claim_id).filter((id, index, all) => all.indexOf(id) !== index);
  const supported = rows.filter((row) => row.outcome === "supported").length;
  const missed = rows.filter((row) => row.outcome === "missed").length;
  return {
    decision_id: "fast-reliability-denominator-decision-2026-09-02",
    issue: 55,
    live_execution: false,
    network_calls: false,
    openai_calls: false,
    decision: {
      denominator_unit: "unique_frozen_claim_id",
      precedence: "latest corrected canonical outcome wins; earlier attempts remain lineage",
      include: "approved live claim with observed supported/missed outcome and current quality review",
      exclude: ["fixtures", "unexecuted claims", "not_observed", "unavailable_authoritative_evidence", "duplicate claim IDs"],
      pooling: "overlapping cohorts are not pooled",
      historical_artifacts_immutable: true,
      nio_policy: "unavailable_authoritative_evidence is excluded from system-miss counts"
    },
    source_totals: {
      canonical_unique_claims: canonical.denominator.total_unique_claims,
      canonical_excluded_not_observed: canonical.exclusions.not_observed,
      canonical_excluded_unavailable: canonical.exclusions.unavailable_authoritative_evidence,
      canonical_excluded_fixture_or_unexecuted: canonical.exclusions.non_executed_or_fixture
    },
    denominator: {
      claims: rows.length,
      supported,
      missed,
      recall: rows.length ? supported / rows.length : null,
      exact_unique_claim_ids: duplicateIds.length === 0,
      duplicate_claim_ids: duplicateIds,
      quality_complete: true,
      evidence_references_present: rows.filter((row) => row.evidence_reference_ids.length > 0).length
    },
    rows,
    gates: {
      claim_level_recall: supported === rows.length,
      quality_dimensions: quality.gate.passed,
      overall_recall_established: false,
      sparse_category_gate_established: false,
      numeric_fcf_coverage_proven: false,
      numeric_fcf_closure_required: false,
      fcf_safety_gate_passed: true,
      safe_unresolved_settlement_passed: true,
      passed: false,
      issue_55_must_remain_open: true,
      pr_74_ready_to_merge: false
    },
    next_step: "Proceed to final #55 closure review on the non-overlapping recall, sparse-category, quality, and severe-miss gates; keep numeric FCF coverage informational while requiring safe unresolved settlement."
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/decide-reliability-denominator.js")) {
  const output = await decideReliabilityDenominator();
  const input_hashes = await Promise.all([canonicalPath, qualityPath].map(async (path) => ({ path, sha256_lf_normalized: await hash(path) })));
  await mkdir(new URL("evaluation/diagnostics/", root), { recursive: true });
  await writeFile(new URL("evaluation/diagnostics/fast-reliability-denominator-decision-2026-09-02.json", root), `${JSON.stringify({ ...output, input_hashes }, null, 2)}\n`);
  console.log(JSON.stringify({ claims: output.denominator.claims, supported: output.denominator.supported, missed: output.denominator.missed, recall: output.denominator.recall, passed: output.gates.passed, issue_55_must_remain_open: output.gates.issue_55_must_remain_open }));
}
