import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EvaluationPlanError, resolveEvaluationPlan, validateResolvedEvaluationPlan } from "../lib/evaluation-plan.js";

async function withPlans(documents, entry, run, hashes = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), "stock-research-plan-"));
  try {
    for (const [name, value] of Object.entries(documents)) await writeFile(path.join(root, name), `${JSON.stringify(value)}\n`);
    if (hashes) for (const value of Object.values(documents)) {
      const ref = value.parent_plan ?? value.base_plan; if (!ref) continue;
      const bytes = await readFile(path.join(root, ref));
      if (value.parent_plan) value.parent_plan_sha256 = createHash("sha256").update(bytes).digest("hex");
      else value.base_plan_sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    if (hashes) for (const [name, value] of Object.entries(documents)) await writeFile(path.join(root, name), `${JSON.stringify(value)}\n`);
    await run(await resolveEvaluationPlan({ root, planPath: path.join(root, entry) }));
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("evaluation plans resolve one two and three inheritance levels with descendant precedence", async () => {
  const documents = {
    "root.json": { baseline_plan: "answer.json", cases: [{ id: "root", ticker: "ROOT" }], approval: { maximum_openai_cost_usd: .15, fast_ceiling_ms_per_ticker: 20000, automatic_retries: false }, configuration: { model: "model-a", tools: [] }, provider_policy: { provider_order: ["alpha"], hosted_search: false } },
    "parent.json": { parent_plan: "root.json", approval: { maximum_openai_cost_usd: .06 }, configuration: { model: "model-b" } },
    "child.json": { parent_plan: "parent.json", approval: { maximum_openai_cost_usd: .03 }, cases: [{ id: "muln", ticker: "MULN" }] },
    "final.json": { parent_plan: "child.json", output_directory: "final-output", approval: { maximum_alpha_vantage_requests: 2 } }
  };
  await withPlans(documents, "final.json", ({ plan, provenance }) => {
    assert.equal(plan.baseline_plan, "answer.json");
    assert.deepEqual(plan.cases, [{ id: "muln", ticker: "MULN" }]);
    assert.equal(plan.approval.maximum_openai_cost_usd, .03);
    assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
    assert.equal(plan.approval.automatic_retries, false);
    assert.equal(plan.configuration.model, "model-b");
    assert.deepEqual(plan.configuration.tools, []);
    assert.deepEqual(plan.provider_policy.provider_order, ["alpha"]);
    assert.equal(provenance.baseline_plan, "root.json");
    assert.equal(provenance["approval.maximum_openai_cost_usd"], "child.json");
    assert.equal(provenance.output_directory, "final.json");
  }, false);
});

test("evaluation plan inheritance detects missing parents and cycles", async () => {
  await assert.rejects(() => withPlans({ "child.json": { parent_plan: "missing.json" } }, "child.json", () => {}, false), (error) => error instanceof EvaluationPlanError && error.safe_reason === "evaluation_plan_parent_missing");
  await assert.rejects(() => withPlans({ "a.json": { parent_plan: "b.json" }, "b.json": { parent_plan: "a.json" } }, "a.json", () => {}, false), (error) => error instanceof EvaluationPlanError && error.safe_reason === "evaluation_plan_inheritance_cycle");
  await assert.rejects(() => withPlans({ "self.json": { parent_plan: "self.json" } }, "self.json", () => {}, false), (error) => error instanceof EvaluationPlanError && error.safe_reason === "evaluation_plan_inheritance_cycle");
});

test("evaluation plan inheritance rejects a changed frozen parent", async () => {
  await assert.rejects(() => withPlans({ "parent.json": { baseline_plan: "answer.json" }, "child.json": { parent_plan: "parent.json", parent_plan_sha256: "0".repeat(64) } }, "child.json", () => {}, false), (error) => error instanceof EvaluationPlanError && error.safe_reason === "evaluation_plan_parent_hash_mismatch");
});

test("resolved plans validate required fields before runtime setup", async () => {
  let networkSetup = false;
  assert.throws(() => {
    validateResolvedEvaluationPlan({ approval: { tickers: ["MULN"] } }, [{ path: "baseline_plan", type: "string" }]);
    networkSetup = true;
  }, (error) => error instanceof EvaluationPlanError && error.safe_reason === "evaluation_plan_required_field_invalid" && error.detail.field === "baseline_plan");
  assert.equal(networkSetup, false);
});

test("malformed inherited required fields fail with controlled validation", () => {
  assert.throws(() => validateResolvedEvaluationPlan({ baseline_plan: 42, approval: { automatic_retries: "no" } }, [{ path: "baseline_plan", type: "string" }, { path: "approval.automatic_retries", type: "boolean" }]), (error) => error.safe_reason === "evaluation_plan_required_field_invalid");
});

test("Verification-3 recursively inherits the frozen baseline and provider constraints", async () => {
  const root = path.resolve(".");
  const result = await resolveEvaluationPlan({ root, planPath: path.join(root, "evaluation/plans/fast-reliability-2026-08-27-muln-verification-3.json"), requiredFields: [
    { path: "baseline_plan", type: "string" }, { path: "baseline_plan_sha256", type: "string" }, { path: "approval.tickers", type: "array" },
    { path: "approval.maximum_openai_cost_usd", type: "number" }, { path: "approval.fast_ceiling_ms_per_ticker", type: "number" },
    { path: "approval.automatic_retries", type: "boolean" }, { path: "provider_policy.provider_order", type: "array" }, { path: "output_directory", type: "string" }
  ] });
  assert.equal(result.plan.baseline_plan, "evaluation/plans/fast-reliability-2026-08-27-sparse.json");
  assert.deepEqual(result.plan.approval.tickers, ["MULN"]);
  assert.equal(result.plan.approval.maximum_openai_cost_usd, .03);
  assert.equal(result.plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(result.provenance.baseline_plan, "evaluation/plans/fast-reliability-2026-08-27-muln-verification.json");
});

test("Verification-4 resolves the complete four-plan ancestry before runtime", async () => {
  const root = path.resolve(".");
  const result = await resolveEvaluationPlan({ root, planPath: path.join(root, "evaluation/plans/fast-reliability-2026-08-27-muln-verification-4.json"), requiredFields: [
    { path: "baseline_plan", type: "string" }, { path: "approval.maximum_openai_cost_usd", type: "number" },
    { path: "approval.fast_ceiling_ms_per_ticker", type: "number" }, { path: "provider_policy.provider_order", type: "array" },
    { path: "preserve_failed_verification_3.directory", type: "string" }, { path: "output_directory", type: "string" }
  ] });
  assert.equal(result.plan.baseline_plan, "evaluation/plans/fast-reliability-2026-08-27-sparse.json");
  assert.equal(result.plan.output_directory, "2026-08-27-muln-verification-4");
  assert.equal(result.plan.approval.maximum_openai_cost_usd, .03);
  assert.equal(result.plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.deepEqual(result.plan.provider_policy.provider_order, ["alpha_vantage", "twelve_data"]);
  assert.equal(result.chain.length, 4);
});

test("Verification-5 inherits the frozen baseline and exact final one-run bounds", async () => {
  const root = path.resolve(".");
  const planPath = path.join(root, "evaluation/plans/fast-reliability-2026-08-27-muln-verification-5.json");
  const { plan, chain } = await resolveEvaluationPlan({ root, planPath, requiredFields: [{ path: "baseline_plan", type: "string" }, { path: "preserve_verification_4.directory", type: "string" }] });
  assert.equal(plan.required_ancestor, "dfae2a9");
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, 0.03);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.output_directory, "2026-08-27-muln-verification-5");
  assert.equal(chain.length, 5);
});

test("Verification-6 inherits all frozen bounds and preserves Verification-5", async () => {
  const root = path.resolve(".");
  const planPath = path.join(root, "evaluation/plans/fast-reliability-2026-08-28-muln-verification-6.json");
  const { plan, chain } = await resolveEvaluationPlan({ root, planPath, requiredFields: [
    { path: "baseline_plan", type: "string" }, { path: "approval.maximum_openai_cost_usd", type: "number" },
    { path: "approval.maximum_alpha_vantage_requests", type: "number" }, { path: "approval.maximum_twelve_data_requests", type: "number" },
    { path: "approval.maximum_combined_optional_provider_attempts", type: "number" }, { path: "approval.fast_ceiling_ms_per_ticker", type: "number" },
    { path: "preserve_verification_5.directory", type: "string" }, { path: "output_directory", type: "string" }
  ] });
  assert.equal(plan.required_ancestor, "2092c1c");
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, .03);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 2);
  assert.equal(plan.approval.maximum_twelve_data_requests, 2);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(plan.output_directory, "2026-08-28-muln-verification-6");
  assert.equal(plan.preserve_verification_5.directory, "evaluation/live/2026-08-27-muln-verification-5");
  assert.equal(chain.length, 6);
});

test("Verification-7 inherits the exact overlap-precedence one-run bounds and preserves Verification-6", async () => {
  const root = path.resolve(".");
  const planPath = path.join(root, "evaluation/plans/fast-reliability-2026-08-28-muln-verification-7.json");
  const { plan, chain } = await resolveEvaluationPlan({ root, planPath, requiredFields: [
    { path: "baseline_plan", type: "string" }, { path: "approval.maximum_openai_cost_usd", type: "number" },
    { path: "approval.maximum_alpha_vantage_requests", type: "number" }, { path: "approval.maximum_twelve_data_requests", type: "number" },
    { path: "approval.maximum_combined_optional_provider_attempts", type: "number" }, { path: "approval.fast_ceiling_ms_per_ticker", type: "number" },
    { path: "preserve_verification_6.directory", type: "string" }
  ] });
  assert.deepEqual(plan.approval.tickers, ["MULN"]);
  assert.equal(plan.approval.maximum_runs, 1);
  assert.equal(plan.approval.automatic_retries, false);
  assert.equal(plan.approval.maximum_openai_cost_usd, .03);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 2);
  assert.equal(plan.approval.maximum_twelve_data_requests, 2);
  assert.equal(plan.approval.maximum_combined_optional_provider_attempts, 4);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.equal(plan.approval.deep_runs, 0);
  assert.equal(plan.approval.hosted_web_search, false);
  assert.equal(plan.output_directory, "2026-08-28-muln-verification-7");
  assert.equal(plan.preserve_verification_6.directory, "evaluation/live/2026-08-28-muln-verification-6");
  assert.equal(chain.length, 7);
});

test("the one-case runner resolves and validates plans before runtime or network construction", async () => {
  const source = await readFile(new URL("../scripts/run-approved-muln-verification-implementation.js", import.meta.url), "utf8");
  const resolveAt = source.indexOf("await resolveEvaluationPlan");
  assert.ok(resolveAt > 0);
  assert.ok(source.indexOf("loadRealAppConfig()") > resolveAt);
  assert.ok(source.indexOf("new OpenAI(") > resolveAt);
  assert.ok(source.indexOf("createSecEvidenceClient(") > resolveAt);
  assert.ok(source.indexOf("baseline.cases?.find") > resolveAt);
});

test("the established multi-case runner uses the same recursive pre-runtime resolver", async () => {
  const source = await readFile(new URL("../scripts/run-approved-fast-calibration.js", import.meta.url), "utf8");
  const resolveAt = source.indexOf("await resolveEvaluationPlan");
  assert.ok(resolveAt > 0);
  assert.ok(source.indexOf("loadRealAppConfig()") > resolveAt);
  assert.ok(source.indexOf("new OpenAI(") > resolveAt);
  assert.ok(source.indexOf("for (const scenario of plan.cases)") > resolveAt);
});

test("every approved live runner gates client construction on zero-token SEC connectivity", async () => {
  const runners = [
    "run-approved-fast-calibration.js",
    "run-approved-sparse-calibration.js",
    "run-approved-sparse-expansion.js",
    "run-approved-final-sparse-proof.js",
    "run-approved-muln-verification-implementation.js"
  ];
  for (const runner of runners) {
    const source = await readFile(new URL(`../scripts/${runner}`, import.meta.url), "utf8");
    const preflightAt = source.indexOf("runSecConnectivityPreflight");
    const openAiAt = source.indexOf("new OpenAI(");
    const sourceClientAt = source.indexOf("createSecEvidenceClient(");
    assert.ok(preflightAt > 0, `${runner} must call the SEC preflight`);
    assert.ok(openAiAt > preflightAt, `${runner} must preflight before OpenAI construction`);
    assert.ok(sourceClientAt > preflightAt, `${runner} must preflight before SEC client construction`);
  }
});

test("AMC and NCPL correction confirmation resolves two declared cases with bounded overrides", async () => {
  const root = path.resolve(".");
  const planPath = path.join(root, "evaluation/plans/fast-reliability-2026-08-28-amc-ncpl-confirmation-1.json");
  const { plan, provenance, chain } = await resolveEvaluationPlan({ root, planPath, requiredFields: [
    { path: "base_plan", type: "string" }, { path: "cases", type: "array" },
    { path: "approval.tickers", type: "array" }, { path: "approval.maximum_runs", type: "number" },
    { path: "approval.maximum_openai_cost_usd", type: "number" }, { path: "provider_policy.provider_order", type: "array" }
  ] });
  assert.deepEqual(plan.approval.tickers, ["AMC", "NCPL"]);
  assert.deepEqual(plan.cases.map((item) => item.ticker), ["AMC", "NCPL"]);
  assert.equal(plan.approval.maximum_runs, plan.cases.length);
  assert.equal(plan.approval.maximum_openai_cost_usd, .06);
  assert.deepEqual(plan.provider_policy.provider_order, ["alpha_vantage", "twelve_data"]);
  assert.equal(provenance["approval.maximum_runs"], "evaluation/plans/fast-reliability-2026-08-28-amc-ncpl-confirmation-1.json");
  assert.equal(chain.length, 4);
});

test("Issue 81 FCF gate confirmation plan resolves frozen five-ticker bounds", async () => {
  const root = path.resolve(".");
  const planPath = path.join(root, "evaluation/plans/fast-reliability-2026-08-31-fcf-gate-confirmation-1.json");
  const { plan, chain } = await resolveEvaluationPlan({ root, planPath, requiredFields: [
    { path: "base_plan", type: "string" }, { path: "cases", type: "array" },
    { path: "approval.tickers", type: "array" }, { path: "approval.maximum_runs", type: "number" },
    { path: "approval.maximum_openai_cost_usd", type: "number" },
    { path: "approval.maximum_alpha_vantage_requests", type: "number" },
    { path: "approval.maximum_twelve_data_requests", type: "number" },
    { path: "approval.fast_ceiling_ms_per_ticker", type: "number" },
    { path: "provider_policy.provider_order", type: "array" }
  ] });
  assert.deepEqual(plan.approval.tickers, ["AAPL", "AMC", "NCPL", "NXL", "SMCI"]);
  assert.deepEqual(plan.cases.map((item) => item.ticker), plan.approval.tickers);
  assert.equal(plan.approval.maximum_runs, 5);
  assert.equal(plan.approval.maximum_openai_cost_usd, .15);
  assert.equal(plan.approval.maximum_alpha_vantage_requests, 10);
  assert.equal(plan.approval.maximum_twelve_data_requests, 10);
  assert.equal(plan.approval.fast_ceiling_ms_per_ticker, 20000);
  assert.deepEqual(plan.provider_policy.provider_order, ["alpha_vantage", "twelve_data"]);
  assert.ok(chain.length >= 2);
});
