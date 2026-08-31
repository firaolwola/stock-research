import dotenv from "dotenv";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceFirstResearchClient } from "../evidence-first-research-client.js";
import { createOpenAIResearchClient } from "../openai-research-client.js";
import { createSecEvidenceClient } from "../lib/sec-evidence.js";
import { createBoundedFastSourceClient } from "../lib/bounded-fast-sources.js";
import { createReportValidator } from "../lib/report-validation.js";
import { finalizeResearchReport } from "../lib/finalize-research-report.js";
import { evaluateCalibrationProviderAvailability } from "../lib/calibration-provider-policy.js";
import { resolveEvaluationPlan } from "../lib/evaluation-plan.js";
import { loadRealAppConfig } from "../startup-config.js";
import { formatSecPreflightFailure, runSecConnectivityPreflight } from "../lib/sec-connectivity-preflight.js";

dotenv.config({ quiet: true });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredPlanPath = process.env.APPROVED_FAST_CALIBRATION_PLAN?.trim();
const planPath = configuredPlanPath
  ? path.resolve(root, configuredPlanPath)
  : path.join(root, "evaluation", "plans", "fast-reliability-2026-08-27-batch-3.json");
const { plan, provenance: planProvenance } = await resolveEvaluationPlan({ root, planPath, requiredFields: [
  { path: "base_plan", type: "string" }, { path: "approval_token", type: "string" },
  { path: "cases", type: "array" }, { path: "approval.tickers", type: "array" },
  { path: "approval.maximum_runs", type: "number" }, { path: "approval.maximum_openai_cost_usd", type: "number" },
  { path: "approval.fast_ceiling_ms_per_ticker", type: "number" }, { path: "configuration.model", type: "string" },
  { path: "provider_policy.provider_order", type: "array" }, { path: "output_directory", type: "string" }
] });
const batchPlan = plan;
const basePlanPath = path.join(root, ...plan.base_plan.split("/"));
const basePlan = JSON.parse(await readFile(basePlanPath, "utf8"));
const approvalToken = batchPlan.approval_token;
if (process.env.RUN_APPROVED_FAST_CALIBRATION !== approvalToken) {
  throw new Error(`Live calibration is locked. Set RUN_APPROVED_FAST_CALIBRATION=${approvalToken} only for the approved run.`);
}
const caseTickers = plan.cases.map((scenario) => scenario.ticker);
if (plan.approval.maximum_runs !== plan.cases.length || plan.approval.runs_per_ticker !== 1 || plan.approval.automatic_retries !== false || plan.approval.difficult_budget_approved !== false) {
  throw new Error("The frozen approval does not match the bounded runner.");
}
if (JSON.stringify(plan.approval.tickers) !== JSON.stringify(caseTickers) || batchPlan.configuration.change_from_batch_2 !== "none" || batchPlan.approval.deep_runs !== 0 || batchPlan.approval.hosted_web_search !== false) {
  throw new Error("The bounded confirmation must match its declared cases and Fast configuration without Deep or hosted search.");
}
const currentDay = new Date().toISOString().slice(0, 10); const configuredProviders = [process.env.ALPHA_VANTAGE_API_KEY?.trim() ? "alpha_vantage" : null, process.env.TWELVE_DATA_API_KEY?.trim() ? "twelve_data" : null].filter(Boolean);
const alphaAvailable = currentDay === batchPlan.alpha_vantage_preflight.usage_day ? batchPlan.alpha_vantage_preflight.inferred_remaining_on_approval_day : batchPlan.alpha_vantage_preflight.free_daily_limit;
const providerPreflight = evaluateCalibrationProviderAvailability({ alphaRequestsAvailable: alphaAvailable, alphaRequestsRequired: plan.approval.maximum_alpha_vantage_requests, configuredProviders: configuredProviders.filter((provider) => batchPlan.provider_policy.approved_providers.includes(provider)), optionalContextMaySettleLimited: batchPlan.provider_policy.optional_context_may_settle_limited, requiresOwnerReview: batchPlan.provider_policy.requires_owner_review_after_architecture_change });
if (!providerPreflight.allowed) throw new Error(`Batch 3 provider preflight blocked: ${providerPreflight.reason}.`);
if (JSON.stringify(batchPlan.provider_policy.provider_order) !== JSON.stringify(["alpha_vantage", "twelve_data"])) throw new Error("The bounded confirmation provider policy does not match the approved order.");
for (const preserved of batchPlan.preserve_prior_batches) {
  for (const [name, expected] of [["summary.json", preserved.summary_sha256], ["run-summary.json", preserved.run_summary_sha256]]) {
    const original = await readFile(path.join(root, ...preserved.directory.split("/"), name));
    if (createHash("sha256").update(original).digest("hex") !== expected) throw new Error(`Refusing to run because ${preserved.directory}/${name} changed.`);
  }
}

const outputRoot = path.join(root, "evaluation", "live", batchPlan.output_directory);
const existingRaw = await readdir(path.join(outputRoot, "raw")).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
const existingRoot = await readdir(outputRoot).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
if (existingRaw.length || existingRoot.some((name) => !["raw", "review"].includes(name))) {
  throw new Error(`Refusing to rerun or overwrite existing live output at ${outputRoot}.`);
}
await mkdir(path.join(outputRoot, "raw"), { recursive: true });
await mkdir(path.join(outputRoot, "review"), { recursive: true });

const config = loadRealAppConfig();
const secPreflight = await runSecConnectivityPreflight({ userAgent: config.secUserAgent });
if (!secPreflight.ok) {
  console.error(`SEC preflight failed before live research: ${formatSecPreflightFailure(secPreflight)}`);
  throw new Error("SEC connectivity preflight failed; no live research was started.");
}
if (!config.alphaVantageApiKey && !config.twelveDataApiKey) console.warn("No optional market/news provider is configured; calibration will preserve SEC/Nasdaq evidence and settle optional context Limited.");
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const reportValidator = createReportValidator(schema);
const openai = new OpenAI({ apiKey: config.apiKey });
const deepClient = createOpenAIResearchClient(openai, { schema });
const boundedSourceClient = createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey, twelveDataApiKey: config.twelveDataApiKey, providerOrder: batchPlan.provider_policy.provider_order });
const client = createEvidenceFirstResearchClient({
  secClient: createSecEvidenceClient({ userAgent: config.secUserAgent }),
  boundedSourceClient,
  openai,
  deepClient,
  reportValidator
});

// The production server normally keeps Node alive. This standalone runner must
// do the same while SEC's intentionally unref'ed fair-access delay is pending.
const runnerKeepAlive = setInterval(() => {}, 1_000);
const runs = [];
try {
for (const scenario of plan.cases) {
  const started = performance.now();
  try {
    const result = await client.researchTicker(scenario.ticker, { stage: "fast", budgetClass: "normal" });
    // Match the application boundary: Fast retrieval assembles evidence first,
    // then deterministic scoring supplies the schema-required score object.
    const finalized = finalizeResearchReport(result.report, { reportValidator, requestedTicker: scenario.ticker });
    const calibratedReport = finalized.report;
    const validation = finalized.validation;
    const record = {
      case_id: scenario.id,
      ticker: scenario.ticker,
      attempted_at: new Date().toISOString(),
      elapsed_ms: Math.round(performance.now() - started),
      validation,
      report: calibratedReport,
      evidence_records: result.evidence_records ?? [],
      evidence_packet: result.evidence_packet ?? null,
      synthesis: result.synthesis ?? null,
      operations: result.operations ?? null,
      evaluation_plan_provenance: planProvenance
    };
    await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
    runs.push({
      case_id: scenario.id,
      ticker: scenario.ticker,
      result: finalized.valid ? "report" : "invalid_report",
      elapsed_ms: record.elapsed_ms,
      estimated_cost_usd: result.operations?.estimated_cost_usd ?? result.operations?.budget?.cost_consumed_usd ?? null,
      input_tokens: result.operations?.input_tokens ?? null,
      output_tokens: result.operations?.output_tokens ?? null,
      alpha_vantage_requests_today: result.operations?.bounded_sources?.alpha_vantage_requests_today ?? null,
      provider_usage: result.operations?.bounded_sources?.providers ?? null,
      completion_status: calibratedReport?.metadata?.completion_status ?? null,
      termination_reason: result.operations?.budget?.termination_reason ?? null
    });
  } catch (error) {
    const failure = {
      case_id: scenario.id,
      ticker: scenario.ticker,
      attempted_at: new Date().toISOString(),
      elapsed_ms: Math.round(performance.now() - started),
      result: "application_failure",
      error: { constructor: error?.constructor?.name ?? null, name: error?.name ?? null, code: error?.code ?? null }
    };
    await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(failure, null, 2)}\n`, { flag: "wx" });
    runs.push(failure);
  }
}

const totalKnownCost = runs.reduce((sum, run) => sum + (Number.isFinite(run.estimated_cost_usd) ? run.estimated_cost_usd : 0), 0);
const maximumAlphaRequests = Math.max(0, ...runs.map((run) => run.alpha_vantage_requests_today ?? 0));
const maximumTwelveDataRequests = Math.max(0, ...runs.map((run) => run.provider_usage?.quotas?.find((item) => item.provider === "twelve_data")?.daily_used ?? 0));
const combinedOptionalProviderAttempts = runs.reduce((sum, run) => sum + ["market", "news"].flatMap((operation) => run.provider_usage?.[operation]?.attempts ?? []).reduce((count, attempt) => count + (attempt.request_count ?? 0), 0), 0);
const summary = {
  plan: path.relative(root, planPath).replaceAll("\\", "/"),
  live_calls: true,
  approved_run_count: plan.approval.maximum_runs,
  completed_run_count: runs.length,
  known_openai_cost_usd: Number(totalKnownCost.toFixed(6)),
  maximum_approved_openai_cost_usd: plan.approval.maximum_openai_cost_usd,
  alpha_vantage_requests: maximumAlphaRequests,
  maximum_approved_alpha_vantage_requests: plan.approval.maximum_alpha_vantage_requests,
  twelve_data_requests: maximumTwelveDataRequests,
  maximum_approved_twelve_data_requests: plan.approval.maximum_twelve_data_requests,
  combined_optional_provider_attempts: combinedOptionalProviderAttempts,
  maximum_approved_combined_optional_provider_attempts: plan.approval.maximum_combined_optional_provider_attempts,
  runs
};
if (runs.length !== plan.approval.maximum_runs || totalKnownCost > plan.approval.maximum_openai_cost_usd || maximumAlphaRequests > plan.approval.maximum_alpha_vantage_requests || maximumTwelveDataRequests > plan.approval.maximum_twelve_data_requests || combinedOptionalProviderAttempts > plan.approval.maximum_combined_optional_provider_attempts) {
  summary.approval_violation = true;
}
await writeFile(path.join(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
} finally {
  clearInterval(runnerKeepAlive);
}
