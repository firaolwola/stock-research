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
import { loadRealAppConfig } from "../startup-config.js";

dotenv.config({ quiet: true });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verificationPlans = new Map([
  ["issue-55-2026-08-28-approved-sparse-expansion-one-verification-three-runs", "fast-reliability-2026-08-28-sparse-expansion-1-verification-1.json"],
  ["issue-55-2026-08-28-approved-sparse-expansion-one-verification-two-three-runs", "fast-reliability-2026-08-28-sparse-expansion-1-verification-2.json"]
]);
const planName = verificationPlans.get(process.env.RUN_APPROVED_FAST_CALIBRATION) ?? "fast-reliability-2026-08-28-sparse-expansion-1.json";
const planPath = path.join(root, "evaluation", "plans", planName);
const plan = JSON.parse(await readFile(planPath, "utf8"));
const proposalBytes = await readFile(path.join(root, ...plan.proposal.split("/")));
if (createHash("sha256").update(proposalBytes).digest("hex") !== plan.proposal_sha256) throw new Error("The frozen sparse-expansion proposal changed.");
if (process.env.RUN_APPROVED_FAST_CALIBRATION !== plan.approval_token) throw new Error(`Live calibration is locked. Set RUN_APPROVED_FAST_CALIBRATION=${plan.approval_token} only for the approved run.`);

const approval = plan.approval;
const expectedTickers = ["REKR", "ZAPPF", "GMBL"];
if (JSON.stringify(approval.tickers) !== JSON.stringify(expectedTickers) || approval.maximum_runs !== 3 || approval.runs_per_ticker !== 1 || approval.automatic_retries !== false || approval.difficult_budget_approved !== false || approval.deep_runs !== 0 || approval.hosted_web_search !== false) throw new Error("The sparse-expansion approval does not match the locked runner.");
if (approval.maximum_openai_cost_usd !== .09 || approval.maximum_alpha_vantage_requests !== 6 || approval.maximum_twelve_data_requests !== 6 || approval.maximum_combined_optional_provider_attempts !== 12 || approval.fast_ceiling_ms_per_ticker !== 20000 || approval.maximum_aggregate_fast_runtime_ms !== 60000) throw new Error("The sparse-expansion resource bounds changed.");
if (JSON.stringify(plan.provider_policy.provider_order) !== JSON.stringify(["alpha_vantage", "twelve_data"])) throw new Error("The approved provider order changed.");
for (const preserved of plan.preserve_artifacts) {
  const bytes = await readFile(path.join(root, ...preserved.path.split("/")));
  if (createHash("sha256").update(bytes).digest("hex") !== preserved.sha256) throw new Error(`Refusing to run because ${preserved.path} changed.`);
}

const proposal = JSON.parse(proposalBytes);
if (JSON.stringify(proposal.cases.map(({ ticker }) => ticker)) !== JSON.stringify(expectedTickers)) throw new Error("The frozen proposal cases changed.");
const outputRoot = path.join(root, "evaluation", "live", plan.output_directory);
const existing = await readdir(outputRoot).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
if (existing.length) throw new Error(`Refusing to rerun or overwrite existing live output at ${outputRoot}.`);
await mkdir(path.join(outputRoot, "raw"), { recursive: true });
await mkdir(path.join(outputRoot, "review"), { recursive: true });

const config = loadRealAppConfig();
const configuredProviders = [config.alphaVantageApiKey ? "alpha_vantage" : null, config.twelveDataApiKey ? "twelve_data" : null].filter(Boolean);
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const reportValidator = createReportValidator(schema);
const openai = new OpenAI({ apiKey: config.apiKey });
const deepClient = createOpenAIResearchClient(openai, { schema });
const client = createEvidenceFirstResearchClient({
  secClient: createSecEvidenceClient({ userAgent: config.secUserAgent }),
  boundedSourceClient: createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey, twelveDataApiKey: config.twelveDataApiKey, providerOrder: plan.provider_policy.provider_order }),
  openai,
  deepClient,
  reportValidator
});
const countAttempts = (providers) => ["market", "news"].flatMap((operation) => providers?.[operation]?.attempts ?? []).reduce((sum, attempt) => sum + (attempt.request_count ?? 0), 0);
const runnerKeepAlive = setInterval(() => {}, 1_000);
const runs = [];
const batchStarted = performance.now();
try {
  for (const scenario of proposal.cases) {
    if (performance.now() - batchStarted >= approval.maximum_aggregate_fast_runtime_ms) throw new Error("Aggregate Fast runtime ceiling reached before the next case.");
    const started = performance.now();
    try {
      const result = await client.researchTicker(scenario.ticker, { stage: "fast", budgetClass: "normal" });
      const finalized = finalizeResearchReport(result.report, { reportValidator, requestedTicker: scenario.ticker });
      const record = { case_id: scenario.id, ticker: scenario.ticker, attempted_at: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - started), validation: finalized.validation, report: finalized.report, evidence_records: result.evidence_records ?? [], evidence_packet: result.evidence_packet ?? null, synthesis: result.synthesis ?? null, operations: result.operations ?? null };
      await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
      const providers = result.operations?.bounded_sources?.providers ?? null;
      runs.push({ case_id: scenario.id, ticker: scenario.ticker, result: finalized.valid ? "report" : "invalid_report", elapsed_ms: record.elapsed_ms, estimated_cost_usd: result.operations?.estimated_cost_usd ?? result.operations?.budget?.cost_consumed_usd ?? null, input_tokens: result.operations?.input_tokens ?? null, output_tokens: result.operations?.output_tokens ?? null, provider_usage: providers, optional_provider_attempts: countAttempts(providers), completion_status: finalized.report?.metadata?.completion_status ?? null, termination_reason: result.operations?.budget?.termination_reason ?? null });
      if (!finalized.valid) throw new Error(`Deterministic report validation failed for ${scenario.ticker}.`);
    } catch (error) {
      if (!runs.some((run) => run.ticker === scenario.ticker)) {
        const failure = { case_id: scenario.id, ticker: scenario.ticker, attempted_at: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - started), result: "application_failure", error: { constructor: error?.constructor?.name ?? null, name: error?.name ?? null, code: error?.code ?? null } };
        await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(failure, null, 2)}\n`, { flag: "wx" }).catch(() => {});
        runs.push(failure);
      }
      throw error;
    }
  }
} finally {
  clearInterval(runnerKeepAlive);
  const totalKnownCost = runs.reduce((sum, run) => sum + (Number.isFinite(run.estimated_cost_usd) ? run.estimated_cost_usd : 0), 0);
  const quotaUsed = (provider) => Math.max(0, ...runs.map((run) => run.provider_usage?.quotas?.find((item) => item.provider === provider)?.daily_used ?? 0));
  const combinedAttempts = runs.reduce((sum, run) => sum + (run.optional_provider_attempts ?? 0), 0);
  const summary = { plan: path.relative(root, planPath).replaceAll("\\", "/"), live_calls: true, configured_optional_providers: configuredProviders, approved_run_count: approval.maximum_runs, completed_run_count: runs.length, aggregate_elapsed_ms: Math.round(performance.now() - batchStarted), known_openai_cost_usd: Number(totalKnownCost.toFixed(6)), maximum_approved_openai_cost_usd: approval.maximum_openai_cost_usd, alpha_vantage_requests: quotaUsed("alpha_vantage"), maximum_approved_alpha_vantage_requests: approval.maximum_alpha_vantage_requests, twelve_data_requests: quotaUsed("twelve_data"), maximum_approved_twelve_data_requests: approval.maximum_twelve_data_requests, combined_optional_provider_attempts: combinedAttempts, maximum_approved_combined_optional_provider_attempts: approval.maximum_combined_optional_provider_attempts, runs };
  if (runs.length > 3 || totalKnownCost > .09 || summary.alpha_vantage_requests > 6 || summary.twelve_data_requests > 6 || combinedAttempts > 12 || runs.some((run) => run.elapsed_ms > 20000) || summary.aggregate_elapsed_ms > 60000) summary.approval_violation = true;
  await writeFile(path.join(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(summary, null, 2));
}
