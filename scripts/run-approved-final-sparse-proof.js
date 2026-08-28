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
const verificationToken = "issue-55-2026-08-28-approved-final-sparse-proof-verification-two-runs";
const correctionToken = "issue-55-2026-08-28-approved-offline-correction-live-confirmation-two-runs";
const exhibitConfirmationToken = "issue-55-2026-08-28-approved-form-40f-exhibit-live-confirmation-three";
const approvalToken = process.env.RUN_APPROVED_FAST_CALIBRATION;
const planName = approvalToken === exhibitConfirmationToken ? "fast-reliability-2026-08-28-final-sparse-proof-verification-3.json" : approvalToken === correctionToken ? "fast-reliability-2026-08-28-final-sparse-proof-verification-2.json" : approvalToken === verificationToken ? "fast-reliability-2026-08-28-final-sparse-proof-verification-1.json" : "fast-reliability-2026-08-28-final-sparse-proof-1.json";
const planPath = path.join(root, "evaluation", "plans", planName);
const plan = JSON.parse(await readFile(planPath, "utf8"));
const readFrozen = async (relativePath, expectedHash) => {
  const bytes = await readFile(path.join(root, ...relativePath.split("/")));
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error(`Frozen input changed: ${relativePath}`);
  return JSON.parse(bytes);
};
const proposal = await readFrozen(plan.proposal, plan.proposal_sha256);
await readFrozen(plan.baseline, plan.baseline_sha256);
if (plan.preserved_measurement) await readFrozen(plan.preserved_measurement, plan.preserved_measurement_sha256);
if (plan.prior_confirmation) await readFrozen(plan.prior_confirmation, plan.prior_confirmation_sha256);
if (process.env.RUN_APPROVED_FAST_CALIBRATION !== plan.approval_token) throw new Error(`Live calibration is locked. Set RUN_APPROVED_FAST_CALIBRATION=${plan.approval_token}`);
const approval = plan.approval;
const expectedTickers = ["ONFO", "STN"];
if (JSON.stringify(approval.tickers) !== JSON.stringify(expectedTickers) || approval.maximum_runs !== 2 || approval.runs_per_ticker !== 1 || approval.automatic_retries !== false || approval.deep_runs !== 0 || approval.hosted_web_search !== false || approval.difficult_budget_approved !== false) throw new Error("Approval does not match the locked final sparse-proof runner.");
if (approval.maximum_openai_cost_usd !== .06 || approval.maximum_alpha_vantage_requests !== 4 || approval.maximum_twelve_data_requests !== 4 || approval.maximum_combined_optional_provider_attempts !== 8 || approval.fast_ceiling_ms_per_ticker !== 20000 || approval.maximum_aggregate_fast_runtime_ms !== 40000) throw new Error("Approved resource bounds changed.");
if (JSON.stringify(proposal.frozen_live_tickers) !== JSON.stringify(expectedTickers)) throw new Error("Frozen ticker list changed.");
const cases = proposal.candidate_adjudication.filter(({ ticker }) => expectedTickers.includes(ticker));
if (JSON.stringify(cases.map(({ ticker }) => ticker)) !== JSON.stringify(expectedTickers)) throw new Error("Frozen candidate order changed.");
const outputRoot = path.join(root, "evaluation", "live", plan.output_directory);
if ((await readdir(outputRoot).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error))).length) throw new Error(`Refusing to overwrite ${outputRoot}`);
await mkdir(path.join(outputRoot, "raw"), { recursive: true });
await mkdir(path.join(outputRoot, "review"), { recursive: true });
const config = loadRealAppConfig();
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const reportValidator = createReportValidator(schema);
const openai = new OpenAI({ apiKey: config.apiKey });
const client = createEvidenceFirstResearchClient({ secClient: createSecEvidenceClient({ userAgent: config.secUserAgent }), boundedSourceClient: createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey, twelveDataApiKey: config.twelveDataApiKey, providerOrder: plan.provider_policy.provider_order }), openai, deepClient: createOpenAIResearchClient(openai, { schema }), reportValidator });
const attempts = (providers) => ["market", "news"].flatMap((key) => providers?.[key]?.attempts ?? []).reduce((sum, item) => sum + (item.request_count ?? 0), 0);
const runs = []; const batchStarted = performance.now(); const keepAlive = setInterval(() => {}, 1000);
try {
  for (const scenario of cases) {
    if (performance.now() - batchStarted >= 40000) throw new Error("Aggregate runtime ceiling reached before next case.");
    const started = performance.now();
    try {
      const result = await client.researchTicker(scenario.ticker, { stage: "fast", budgetClass: "normal" });
      const finalized = finalizeResearchReport(result.report, { reportValidator, requestedTicker: scenario.ticker });
      const record = { case_id: `final-sparse-proof-${scenario.ticker.toLowerCase()}`, ticker: scenario.ticker, attempted_at: new Date().toISOString(), elapsed_ms: Math.round(performance.now() - started), validation: finalized.validation, report: finalized.report, evidence_records: result.evidence_records ?? [], evidence_packet: result.evidence_packet ?? null, synthesis: result.synthesis ?? null, operations: result.operations ?? null };
      await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
      const providers = result.operations?.bounded_sources?.providers ?? null;
      runs.push({ ticker: scenario.ticker, result: finalized.valid ? "report" : "invalid_report", elapsed_ms: record.elapsed_ms, estimated_cost_usd: result.operations?.estimated_cost_usd ?? result.operations?.budget?.cost_consumed_usd ?? null, provider_usage: providers, optional_provider_attempts: attempts(providers), completion_status: finalized.report?.metadata?.completion_status ?? null, termination_reason: result.operations?.budget?.termination_reason ?? null });
      if (!finalized.valid) throw new Error(`Report validation failed for ${scenario.ticker}`);
    } catch (error) {
      if (!runs.some((run) => run.ticker === scenario.ticker)) { const failure = { ticker: scenario.ticker, result: "application_failure", elapsed_ms: Math.round(performance.now() - started), error: { constructor: error?.constructor?.name ?? null, name: error?.name ?? null, code: error?.code ?? null } }; await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(failure, null, 2)}\n`, { flag: "wx" }).catch(() => {}); runs.push(failure); }
      throw error;
    }
  }
} finally {
  clearInterval(keepAlive);
  const quota = (provider) => Math.max(0, ...runs.map((run) => run.provider_usage?.quotas?.find((item) => item.provider === provider)?.daily_used ?? 0));
  const summary = { plan: path.relative(root, planPath).replaceAll("\\", "/"), live_calls: true, approved_run_count: 2, completed_run_count: runs.length, aggregate_elapsed_ms: Math.round(performance.now() - batchStarted), known_openai_cost_usd: Number(runs.reduce((sum, run) => sum + (Number.isFinite(run.estimated_cost_usd) ? run.estimated_cost_usd : 0), 0).toFixed(6)), maximum_approved_openai_cost_usd: .06, alpha_vantage_requests: quota("alpha_vantage"), maximum_approved_alpha_vantage_requests: 4, twelve_data_requests: quota("twelve_data"), maximum_approved_twelve_data_requests: 4, combined_optional_provider_attempts: runs.reduce((sum, run) => sum + (run.optional_provider_attempts ?? 0), 0), maximum_approved_combined_optional_provider_attempts: 8, runs };
  summary.approval_violation = runs.length > 2 || summary.known_openai_cost_usd > .06 || summary.alpha_vantage_requests > 4 || summary.twelve_data_requests > 4 || summary.combined_optional_provider_attempts > 8 || runs.some((run) => run.elapsed_ms > 20000) || summary.aggregate_elapsed_ms > 40000;
  await writeFile(path.join(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(summary, null, 2));
}
