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
  assert.ok(Math.abs(result.operations.average_cost_usd - 0.07375) < 1e-9);
  assert.equal(result.operations.maximum_cost_usd, 0.08);
  assert.equal(result.operations.input_tokens, 22000);
  assert.equal(result.operations.output_tokens, 8000);
  assert.equal(result.operations.web_search_calls, 4);
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
