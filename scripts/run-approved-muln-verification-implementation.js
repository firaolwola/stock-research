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
const planPath = path.join(root, "evaluation", "plans", "fast-reliability-2026-08-27-muln-verification.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
if (process.env.RUN_APPROVED_FAST_CALIBRATION !== plan.approval_token) throw new Error(`Live calibration is locked. Set RUN_APPROVED_FAST_CALIBRATION=${plan.approval_token} only for the approved run.`);
const approval = plan.approval;
if (JSON.stringify(approval.tickers) !== JSON.stringify(["MULN"]) || approval.maximum_runs !== 1 || approval.runs_per_ticker !== 1 || approval.automatic_retries !== false || approval.maximum_openai_cost_usd !== 0.03 || approval.maximum_alpha_vantage_requests !== 2 || approval.maximum_twelve_data_requests !== 2 || approval.maximum_combined_optional_provider_attempts !== 4 || approval.fast_ceiling_ms_per_ticker !== 20000 || approval.difficult_budget_approved !== false || approval.deep_runs !== 0 || approval.hosted_web_search !== false) throw new Error("The MULN approval bounds changed.");
const baselineBytes = await readFile(path.join(root, ...plan.baseline_plan.split("/")));
if (createHash("sha256").update(baselineBytes).digest("hex") !== plan.baseline_plan_sha256) throw new Error("The frozen baseline plan changed.");
for (const preserved of plan.preserve_prior_batches) {
  for (const [name, expected] of [["summary.json", preserved.summary_sha256], ["run-summary.json", preserved.run_summary_sha256]]) {
    const bytes = await readFile(path.join(root, ...preserved.directory.split("/"), name));
    if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error(`Refusing to run because ${preserved.directory}/${name} changed.`);
  }
}
const outputRoot = path.join(root, "evaluation", "live", plan.output_directory);
if ((await readdir(outputRoot).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error))).length) throw new Error("Refusing to overwrite MULN verification output.");
await mkdir(path.join(outputRoot, "raw"), { recursive: true });
await mkdir(path.join(outputRoot, "review"), { recursive: true });
const config = loadRealAppConfig();
const configuredProviders = [config.alphaVantageApiKey ? "alpha_vantage" : null, config.twelveDataApiKey ? "twelve_data" : null].filter(Boolean);
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const reportValidator = createReportValidator(schema);
const openai = new OpenAI({ apiKey: config.apiKey });
const client = createEvidenceFirstResearchClient({
  secClient: createSecEvidenceClient({ userAgent: config.secUserAgent }),
  boundedSourceClient: createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey, twelveDataApiKey: config.twelveDataApiKey, providerOrder: plan.provider_policy.provider_order }),
  openai,
  deepClient: createOpenAIResearchClient(openai, { schema }),
  reportValidator
});
const runnerKeepAlive = setInterval(() => {}, 1_000);
const started = performance.now(); let record; let run;
try {
  const result = await client.researchTicker("MULN", { stage: "fast", budgetClass: "normal" });
  const finalized = finalizeResearchReport(result.report, { reportValidator, requestedTicker: "MULN" });
  record = { case_id: "muln-2026-sparse", ticker: "MULN", attempted_at: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - started), validation: finalized.validation, report: finalized.report, evidence_records: result.evidence_records ?? [], evidence_packet: result.evidence_packet ?? null, synthesis: result.synthesis ?? null, operations: result.operations ?? null };
  const providers = result.operations?.bounded_sources?.providers ?? null;
  const attempts = ["market", "news"].flatMap((operation) => providers?.[operation]?.attempts ?? []).reduce((sum, attempt) => sum + (attempt.request_count ?? 0), 0);
  const quotaUsed = (provider) => providers?.quotas?.find((item) => item.provider === provider)?.daily_used ?? 0;
  run = { case_id: record.case_id, ticker: "MULN", result: finalized.valid ? "report" : "invalid_report", elapsed_ms: record.elapsed_ms, estimated_cost_usd: result.operations?.estimated_cost_usd ?? result.operations?.budget?.cost_consumed_usd ?? null, input_tokens: result.operations?.input_tokens ?? null, output_tokens: result.operations?.output_tokens ?? null, provider_usage: providers, optional_provider_attempts: attempts, alpha_vantage_requests: quotaUsed("alpha_vantage"), twelve_data_requests: quotaUsed("twelve_data"), completion_status: finalized.report?.metadata?.completion_status ?? null, termination_reason: result.operations?.budget?.termination_reason ?? null };
} catch (error) {
  record = { case_id: "muln-2026-sparse", ticker: "MULN", attempted_at: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - started), result: "application_failure", error: { constructor: error?.constructor?.name ?? null, name: error?.name ?? null, code: error?.code ?? null } };
  run = record;
} finally { clearInterval(runnerKeepAlive); }
await writeFile(path.join(outputRoot, "raw", "MULN.json"), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
const cost = Number.isFinite(run.estimated_cost_usd) ? run.estimated_cost_usd : 0;
const summary = { plan: path.relative(root, planPath).replaceAll("\\", "/"), live_calls: true, configured_optional_providers: configuredProviders, approved_run_count: 1, completed_run_count: 1, known_openai_cost_usd: Number(cost.toFixed(6)), maximum_approved_openai_cost_usd: 0.03, alpha_vantage_requests: run.alpha_vantage_requests ?? 0, maximum_approved_alpha_vantage_requests: 2, twelve_data_requests: run.twelve_data_requests ?? 0, maximum_approved_twelve_data_requests: 2, combined_optional_provider_attempts: run.optional_provider_attempts ?? 0, maximum_approved_combined_optional_provider_attempts: 4, runs: [run] };
if (cost > 0.03 || summary.alpha_vantage_requests > 2 || summary.twelve_data_requests > 2 || summary.combined_optional_provider_attempts > 4 || run.elapsed_ms > 20000) summary.approval_violation = true;
await writeFile(path.join(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
