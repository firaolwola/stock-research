import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("sparse-batch corrections stay separate from the frozen answer key", async () => {
  const planBytes = await readFile(new URL("../evaluation/plans/fast-reliability-2026-08-27-sparse.json", import.meta.url));
  const corrections = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse-corrections.json");
  assert.equal(createHash("sha256").update(planBytes).digest("hex"), corrections.frozen_plan_sha256);
  assert.equal(corrections.changes_frozen_plan, false);
  assert.deepEqual(corrections.corrections.map((item) => item.ticker), ["BIOR", "MULN"]);
  assert.ok(corrections.corrections.every((item) => item.frozen_text_is_stale && item.source.startsWith("https://www.sec.gov/")));
});

test("Issue 55 sparse batch 2 reuses the frozen cases under new strict bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse-2.json");
  assert.equal(plan.required_ancestor, "27ee9aa");
  assert.equal(plan.output_directory, "2026-08-27-sparse-2");
  assert.deepEqual(plan.approval.tickers, ["BIOR", "MULN", "NIO", "TUPBQ"]);
  assert.equal(plan.approval.maximum_runs, 4);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.12);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 8);
  assert.equal(plan.approval.maximum_twelve_data_requests, 8);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 16);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(plan.preserve_prior_batches.length, 4);
});

test("Issue 55 sparse batch 2 records improvement without passing reliability", async () => {
  const result = await loadJson("../evaluation/live/2026-08-27-sparse-2/summary.json");
  assert.equal(result.completed_runs, 4);
  assert.equal(result.overall_material_checks.recall, 0.8125);
  assert.equal(result.valid_report_rate.rate, 0.25);
  assert.equal(result.settlement_accuracy.pass_rate, 1);
  assert.equal(result.operations.alpha_vantage_requests, 8);
  assert.equal(result.operations.twelve_data_requests, 0);
  assert.ok(result.operations.measured_openai_cost_usd <= 0.12);
  assert.equal(result.issue_must_remain_open, true);
  assert.ok(result.severe_misleading_misses.length > 0);
});

test("Issue 55 sparse batch 3 preserves the frozen cases and approved bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse-3.json");
  assert.equal(plan.required_ancestor, "08b7f50");
  assert.equal(plan.output_directory, "2026-08-27-sparse-3");
  assert.deepEqual(plan.approval.tickers, ["BIOR", "MULN", "NIO", "TUPBQ"]);
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
  assert.equal(plan.preserve_prior_batches.length, 5);
});

test("Issue 55 sparse batch 3 restores validity but still fails reliability", async () => {
  const result = await loadJson("../evaluation/live/2026-08-27-sparse-3/summary.json");
  const run = await loadJson("../evaluation/live/2026-08-27-sparse-3/run-summary.json");
  assert.equal(result.completed_runs, 4);
  assert.equal(result.overall_material_checks.recall, 0.875);
  assert.equal(result.valid_report_rate.rate, 1);
  assert.equal(result.explanation_fidelity.pass_rate, 0);
  assert.equal(result.settlement_accuracy.pass_rate, 1);
  assert.equal(result.score_calibration.pass_rate, 0.3889);
  assert.equal(run.completed_run_count, 4);
  assert.equal(run.alpha_vantage_requests, 8);
  assert.equal(run.twelve_data_requests, 0);
  assert.equal(run.combined_optional_provider_attempts, 8);
  assert.ok(run.known_openai_cost_usd <= 0.12);
  assert.ok(run.runs.every((item) => item.result === "report" && item.elapsed_ms <= 20000));
  assert.equal(result.issue_must_remain_open, true);
  assert.ok(result.severe_misleading_misses.length > 0);
});

test("Issue 55 sparse batch 4 freezes the post-Sparse-3 verification bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse-4.json");
  assert.equal(plan.required_ancestor, "7614589");
  assert.equal(plan.output_directory, "2026-08-27-sparse-4");
  assert.deepEqual(plan.approval.tickers, ["BIOR", "MULN", "NIO", "TUPBQ"]);
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
  assert.equal(plan.preserve_prior_batches.length, 6);
});

test("Issue 55 sparse batch 4 remains below the reliability gate", async () => {
  const result = await loadJson("../evaluation/live/2026-08-27-sparse-4/summary.json");
  const run = await loadJson("../evaluation/live/2026-08-27-sparse-4/run-summary.json");
  assert.equal(result.completed_runs, 4);
  assert.equal(result.overall_material_checks.recall, 0.875);
  assert.equal(result.valid_report_rate.rate, 1);
  assert.equal(result.explanation_fidelity.pass_rate, 0.25);
  assert.equal(result.settlement_accuracy.pass_rate, 1);
  assert.equal(result.score_calibration.pass_rate, 0.3889);
  assert.equal(run.completed_run_count, 4);
  assert.equal(run.alpha_vantage_requests, 8);
  assert.equal(run.twelve_data_requests, 0);
  assert.equal(run.combined_optional_provider_attempts, 8);
  assert.ok(run.known_openai_cost_usd <= 0.12);
  assert.ok(run.runs.every((item) => item.result === "report" && item.elapsed_ms <= 20000));
  assert.equal(result.issue_must_remain_open, true);
  assert.ok(result.severe_misleading_misses.length > 0);
});

test("Issue 55 sparse batch 5 freezes canonical-action verification bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-sparse-5.json");
  assert.equal(plan.required_ancestor, "fa4e565");
  assert.equal(plan.output_directory, "2026-08-27-sparse-5");
  assert.deepEqual(plan.approval.tickers, ["BIOR", "MULN", "NIO", "TUPBQ"]);
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
  assert.equal(plan.preserve_prior_batches.length, 7);
});

test("Issue 55 sparse batch 5 remains below the reliability gate", async () => {
  const result = await loadJson("../evaluation/live/2026-08-27-sparse-5/summary.json");
  const run = await loadJson("../evaluation/live/2026-08-27-sparse-5/run-summary.json");
  assert.equal(result.completed_runs, 4);
  assert.equal(result.overall_material_checks.recall, 0.875);
  assert.equal(result.valid_report_rate.rate, 1);
  assert.equal(result.explanation_fidelity.pass_rate, 0.75);
  assert.equal(result.settlement_accuracy.pass_rate, 1);
  assert.equal(result.score_calibration.pass_rate, 0.3889);
  assert.equal(run.completed_run_count, 4);
  assert.equal(run.alpha_vantage_requests, 8);
  assert.equal(run.twelve_data_requests, 0);
  assert.equal(run.combined_optional_provider_attempts, 8);
  assert.ok(run.known_openai_cost_usd <= 0.12);
  assert.ok(run.runs.every((item) => item.result === "report" && item.elapsed_ms <= 20000));
  assert.equal(result.issue_must_remain_open, true);
  assert.equal(result.severe_misleading_misses.length, 2);
});

test("Issue 55 MULN-only verification freezes the approved one-run bounds", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-muln-verification.json");
  assert.equal(plan.required_ancestor, "85c2842");
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.03);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 2);
  assert.equal(plan.approval.maximum_twelve_data_requests, 2);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(plan.preserve_prior_batches.length, 8);
});

test("MULN verification runner retains the event loop until its one research promise settles", async () => {
  const source = await readFile(new URL("../scripts/run-approved-muln-verification-implementation.js", import.meta.url), "utf8");
  assert.match(source, /const runnerKeepAlive = setInterval/);
  assert.match(source, /finally \{ clearInterval\(runnerKeepAlive\); \}/);
  const result = await loadJson("../evaluation/live/2026-08-27-muln-verification/run-summary.json");
  assert.equal(result.status, "runner_failure_no_result");
  assert.equal(result.retry_performed, false);
  assert.equal(result.approval_consumed, true);
});

test("corrected MULN verification freezes a new one-process authorization", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-muln-verification-2.json");
  assert.equal(plan.required_ancestor, "e5833db");
  assert.equal(plan.output_directory, "2026-08-27-muln-verification-2");
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.03);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 2);
  assert.equal(plan.approval.maximum_twelve_data_requests, 2);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
});

test("corrected MULN live verification records the remaining severe parser failure", async () => {
  const result = await loadJson("../evaluation/live/2026-08-27-muln-verification-2/summary.json");
  const run = await loadJson("../evaluation/live/2026-08-27-muln-verification-2/run-summary.json");
  assert.equal(result.report_produced, true);
  assert.equal(result.valid_report_rate.rate, 1);
  assert.equal(result.completed_split_recall.recall, 0.3333);
  assert.equal(result.ratio_date_retrieval.recall, 1);
  assert.equal(result.explanation_fidelity.rate, 0);
  assert.equal(result.settlement_accuracy.rate, 1);
  assert.equal(result.severe_misleading_misses, 2);
  assert.equal(run.completed_run_count, 1);
  assert.equal(run.alpha_vantage_requests, 2);
  assert.equal(run.twelve_data_requests, 0);
  assert.equal(run.known_openai_cost_usd, 0);
  assert.ok(run.runs[0].elapsed_ms <= 20000);
  assert.equal(result.issue_must_remain_open, true);
});

test("final MULN verification freezes segment-binding approval and preserves the failed live baseline", async () => {
  const plan = await loadJson("../evaluation/plans/fast-reliability-2026-08-27-muln-verification-3.json");
  assert.equal(plan.required_ancestor, "536baea");
  assert.equal(plan.output_directory, "2026-08-27-muln-verification-3");
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.03);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 2);
  assert.equal(plan.approval.maximum_twelve_data_requests, 2);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.match(plan.preserve_previous_verification.raw_muln_sha256, /^[a-f0-9]{64}$/);
});

test("final MULN verification attempt records the pre-network runner failure without adjudicating the parser", async () => {
  const raw = await loadJson("../evaluation/live/2026-08-27-muln-verification-3/raw/MULN.json");
  const run = await loadJson("../evaluation/live/2026-08-27-muln-verification-3/run-summary.json");
  const result = await loadJson("../evaluation/live/2026-08-27-muln-verification-3/summary.json");
  assert.equal(raw.failure_phase, "plan_validation");
  assert.equal(raw.network_clients_created, false);
  assert.equal(run.completed_run_count, 0);
  assert.equal(run.known_openai_cost_usd, 0);
  assert.equal(run.alpha_vantage_requests, 0);
  assert.equal(run.twelve_data_requests, 0);
  assert.equal(run.retry_performed, false);
  assert.equal(result.canonical_live_events, null);
  assert.equal(result.muln_live_parser_blocker_resolved, false);
  assert.equal(result.issue_must_remain_open, true);
});

test("NIO Sparse-2 revenue diagnostic explains 9.6 without changing methodology", async () => {
  const diagnostic = await loadJson("../evaluation/diagnostics/nio-revenue-sparse-2.json");
  assert.equal(diagnostic.methodology_version, "2.1.0");
  assert.deepEqual(diagnostic.observations_cny.map((item) => item.period), ["2022", "2023", "2024", "2025"]);
  assert.ok(diagnostic.year_over_year_changes.every((value) => value > 0));
  const calculated = diagnostic.weights.average_direction * diagnostic.average_direction_component
    + diagnostic.weights.latest_change * diagnostic.latest_change_component
    + diagnostic.weights.consistency * diagnostic.consistency_component;
  assert.ok(Math.abs(calculated - diagnostic.unrounded_result) < 1e-9);
  assert.equal(Number(diagnostic.unrounded_result.toFixed(1)), diagnostic.reported_result);
  assert.match(diagnostic.conclusion, /range was too narrow.*methodology.*unchanged/i);
});
