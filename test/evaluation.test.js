import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateSample, MATERIAL_RISK_CATEGORIES, validateEvaluationSample, validateEvaluationSet } from "../lib/evaluation.js";

const loadJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("the dated evaluation set satisfies its required coverage matrix", async () => {
  const evaluationSet = await loadJson("../evaluation/cases.json");
  const result = validateEvaluationSet(evaluationSet);
  assert.deepEqual(result, { valid: true, errors: [] });
  const covered = new Set(evaluationSet.cases.flatMap((scenario) => scenario.expected_evidence || []));
  assert.deepEqual([...MATERIAL_RISK_CATEGORIES].sort(), [...covered].sort());
  assert.deepEqual(new Set(evaluationSet.cases.filter((scenario) => scenario.kind === "research_quality").map((scenario) => scenario.size_bucket)), new Set(["large", "mid", "small", "micro", "not_applicable"]));
});

test("the token-free calibration sample reports category recall separately from app failures", async () => {
  const evaluationSet = await loadJson("../evaluation/cases.json");
  const sample = await loadJson("../evaluation/samples/mock-results.json");
  const result = evaluateSample(evaluationSet, sample);
  assert.equal(sample.live_calls, false);
  assert.equal(result.research_quality.material_risk_recall, 1);
  assert.equal(result.research_quality.meets_target, true);
  assert.equal(result.research_quality.uncertainty_accuracy, 1);
  assert.equal(result.operations.latency_p50_ms, 4200);
  assert.equal(result.operations.latency_p95_ms, 8500);
  assert.ok(Math.abs(result.operations.average_cost_usd - 0.02275) < 1e-9);
  assert.equal(result.operations.maximum_cost_usd, 0.028);
  assert.equal(result.operations.input_tokens, 14000);
  assert.equal(result.operations.output_tokens, 2800);
  assert.equal(result.operations.web_search_calls, 0);
  assert.equal(result.operations.fast_cost_target_usd, 0.03);
  assert.deepEqual(result.operations.fast_first_useful_target_ms, { min: 3000, max: 10000 });
  assert.deepEqual(result.operations.fast_complete_target_ms, { min: 15000, max: 20000 });
  assert.equal(result.operations.meets_latency_target, true);
  assert.equal(result.operations.meets_cost_target, true);
  assert.equal(result.operations.coverage_and_recall_reported_together, true);
  assert.deepEqual(result.research_quality.score_calibration, {
    evaluated: 13,
    passed: 13,
    pass_rate: 1,
    by_category: {
      dilution_offerings: { evaluated: 4, passed: 4, pass_rate: 1 },
      reverse_splits: { evaluated: 2, passed: 2, pass_rate: 1 },
      financial_context: { evaluated: 3, passed: 3, pass_rate: 1 },
      catalysts_news: { evaluated: 4, passed: 4, pass_rate: 1 }
    }
  });
  assert.deepEqual(result.deterministic_app_checks, { evaluated: 3, failures: [] });
  assert.deepEqual(result.research_quality.deterministic_app_failures, []);
});

test("a deterministic failure during research is not counted as a missed research fact", async () => {
  const evaluationSet = await loadJson("../evaluation/cases.json");
  const result = evaluateSample(evaluationSet, { as_of: "2026-08-25", live_calls: false, runs: [{ case_id: "mock-acme-complete", result_kind: "deterministic_app_failure" }] });
  assert.equal(result.research_quality.material_risk_recall, null);
  assert.deepEqual(result.research_quality.deterministic_app_failures, [{ case_id: "mock-acme-complete", reason: "deterministic application failure" }]);
});

test("validation rejects evidence dated after a scenario cutoff", async () => {
  const changed = structuredClone(await loadJson("../evaluation/cases.json"));
  const scenario = changed.cases.find((item) => item.known_material_facts?.some((fact) => fact.sources?.length));
  scenario.known_material_facts.find((fact) => fact.sources?.length).sources[0].published_date = "2099-01-01";
  const result = validateEvaluationSet(changed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("published after its as_of date")));
});

test("validation requires explicit approval and a bounded paid run", async () => {
  const changed = structuredClone(await loadJson("../evaluation/cases.json"));
  changed.live_evaluation_policy.requires_explicit_approval = false;
  changed.live_evaluation_policy.max_cases_per_approved_run = 0;
  const result = validateEvaluationSet(changed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("paid live evaluation must require explicit approval"));
  assert.ok(result.errors.includes("paid live evaluation must have a positive case bound"));
});

test("live samples require bounded approval and complete operational measurements", async () => {
  const evaluationSet = await loadJson("../evaluation/cases.json");
  const sample = { live_calls: true, runs: [{ case_id: "mock-acme-complete", result_kind: "research_report", latency_ms: 5000 }] };
  const invalid = validateEvaluationSample(evaluationSet, sample);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes("live samples require an explicit approval record"));
  assert.ok(invalid.errors.some((error) => error.includes("must record latency, cost, tokens, and web searches")));

  sample.runs[0] = { ...sample.runs[0], estimated_cost_usd: 0.08, input_tokens: 10000, output_tokens: 4000, web_search_calls: 2 };
  sample.approval_record = { approved: true, run_date: "2026-08-25", model_configuration: "gpt-5.1 / no reasoning / fast", max_budget_usd: 0.10, output_location: "evaluation/results/example.json", case_ids: ["mock-acme-complete"] };
  assert.deepEqual(validateEvaluationSample(evaluationSet, sample), { valid: true, errors: [] });
});

test("Issue 55 artifacts preserve the approved bound and failed reliability gate", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27.json");
  const result = await loadJson("../evaluation/live/2026-08-27/summary.json");
  assert.deepEqual(plan.approval.tickers, ["AAPL", "AMC", "NCPL", "NXL", "SMCI"]);
  assert.equal(plan.approval.maximum_runs, 5);
  assert.equal(plan.approval.runs_per_ticker, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.difficult_budget_approved, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.15);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 10);
  assert.equal(result.completed_runs, 5);
  assert.equal(result.operations.alpha_vantage_requests, 10);
  assert.ok(result.operations.conservative_maximum_possible_cost_usd <= plan.approval.maximum_openai_cost_usd);
  assert.equal(result.overall_material_checks.passes, false);
  assert.ok(result.severe_misleading_misses.length > 0);
  assert.equal(result.issue_must_remain_open, true);
});

test("Issue 55 batch 2 remains separately bounded and records improvement without claiming reliability", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-batch-2.json");
  const result = await loadJson("../evaluation/live/2026-08-27-batch-2/summary.json");
  assert.deepEqual(plan.approval.tickers, ["AAPL", "AMC", "NCPL", "NXL", "SMCI"]);
  assert.equal(plan.approval.maximum_runs, 5);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(result.completed_runs, 5);
  assert.equal(result.operations.alpha_vantage_requests, 10);
  assert.ok(result.operations.conservative_maximum_possible_cost_usd <= plan.approval.maximum_openai_cost_usd);
  assert.ok(result.overall_material_checks.recall > result.overall_material_checks.batch_1_recall);
  assert.equal(result.overall_material_checks.passes, false);
  assert.equal(result.validation.post_scoring_reports_valid, 4);
  assert.ok(result.severe_misleading_misses.length > 0);
  assert.equal(result.issue_must_remain_open, true);
});

test("Issue 55 batch 3 freezes the same five cases and approved provider bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-batch-3.json");
  const result = await loadJson("../evaluation/live/2026-08-27-batch-3/summary.json");
  assert.deepEqual(plan.approval.tickers, ["AAPL", "AMC", "NCPL", "NXL", "SMCI"]);
  assert.equal(plan.required_ancestor, "3aa5a79"); assert.equal(plan.configuration.change_from_batch_2, "none");
  assert.equal(plan.approval.maximum_runs, 5); assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.deep_runs, 0); assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(plan.alpha_vantage_preflight.inferred_remaining_on_approval_day, 5);
  assert.equal(plan.alpha_vantage_preflight.approved_batch_3_requests, 10);
  assert.equal(plan.alpha_vantage_preflight.status, "blocked_until_daily_reset");
  assert.equal(plan.provider_policy.requires_owner_review_after_architecture_change, false);
  assert.deepEqual(plan.provider_policy.provider_order, ["alpha_vantage", "twelve_data"]);
  assert.equal(plan.approval.maximum_twelve_data_requests, 10);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 20);
  assert.equal(plan.preserve_prior_batches.length, 2);
  assert.equal(result.completed_runs, 5);
  assert.equal(result.validation.post_scoring_reports_valid, 5);
  assert.equal(result.overall_material_checks.recall, 0.9651);
  assert.equal(result.overall_material_checks.passes_recall_only, true);
  assert.ok(result.severe_misleading_misses.length > 0);
  assert.equal(result.issue_must_remain_open, true);
});

test("Issue 55 sparse batch freezes independent baselines and strict live bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse.json");
  const result = await loadJson("../evaluation/live/2026-08-27-sparse-1/summary.json");
  assert.deepEqual(plan.approval.tickers, ["BIOR", "MULN", "NIO", "TUPBQ"]);
  assert.equal(plan.required_ancestor, "81ec4d2");
  assert.equal(plan.approval.maximum_runs, 4);
  assert.equal(plan.approval.runs_per_ticker, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.12);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 8);
  assert.equal(plan.approval.maximum_twelve_data_requests, 8);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 16);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.deepEqual(plan.provider_policy.provider_order, ["alpha_vantage", "twelve_data"]);
  assert.equal(plan.provider_policy.alpha_vantage_is_hard_gate, false);
  assert.equal(plan.preserve_prior_batches.length, 3);
  assert.deepEqual(plan.cases.map((item) => item.ticker), plan.approval.tickers);
  for (const scenario of plan.cases) {
    assert.ok(scenario.authoritative_sources.length > 0);
    assert.ok(scenario.known_baseline.length > 0);
    assert.ok(scenario.severe_miss_conditions.length > 0);
  }
  assert.equal(result.completed_runs, 4);
  assert.equal(result.valid_report_rate.valid, 4);
  assert.equal(result.overall_material_checks.recall, 0.1875);
  assert.equal(result.operations.alpha_vantage_requests, 2);
  assert.equal(result.operations.twelve_data_requests, 0);
  assert.ok(result.operations.measured_openai_cost_usd <= plan.approval.maximum_openai_cost_usd);
  assert.ok(result.severe_misleading_misses.length > 0);
  assert.equal(result.issue_must_remain_open, true);
});
