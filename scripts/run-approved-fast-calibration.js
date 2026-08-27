import dotenv from "dotenv";
import OpenAI from "openai";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidenceFirstResearchClient } from "../evidence-first-research-client.js";
import { createOpenAIResearchClient } from "../openai-research-client.js";
import { createSecEvidenceClient } from "../lib/sec-evidence.js";
import { createBoundedFastSourceClient } from "../lib/bounded-fast-sources.js";
import { createReportValidator } from "../lib/report-validation.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { loadRealAppConfig } from "../startup-config.js";

dotenv.config({ quiet: true });

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const planPath = path.join(root, "evaluation", "plans", "fast-reliability-2026-08-27.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const approvalToken = "issue-55-2026-08-27-approved-five-runs";
if (process.env.RUN_APPROVED_FAST_CALIBRATION !== approvalToken) {
  throw new Error(`Live calibration is locked. Set RUN_APPROVED_FAST_CALIBRATION=${approvalToken} only for the approved run.`);
}
if (plan.approval.maximum_runs !== 5 || plan.approval.runs_per_ticker !== 1 || plan.approval.automatic_retries !== false || plan.approval.difficult_budget_approved !== false) {
  throw new Error("The frozen approval does not match the bounded runner.");
}

const outputRoot = path.join(root, "evaluation", "live", plan.run_date);
const existingRaw = await readdir(path.join(outputRoot, "raw")).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
const existingRoot = await readdir(outputRoot).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
if (existingRaw.length || existingRoot.some((name) => !["raw", "review"].includes(name))) {
  throw new Error(`Refusing to rerun or overwrite existing live output at ${outputRoot}.`);
}
await mkdir(path.join(outputRoot, "raw"), { recursive: true });
await mkdir(path.join(outputRoot, "review"), { recursive: true });

const config = loadRealAppConfig();
if (!config.alphaVantageApiKey) throw new Error("ALPHA_VANTAGE_API_KEY is required for this approved calibration.");
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const reportValidator = createReportValidator(schema);
const openai = new OpenAI({ apiKey: config.apiKey });
const deepClient = createOpenAIResearchClient(openai, { schema });
const boundedSourceClient = createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey });
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
    const calibratedReport = calibrateReportScores(result.report);
    const validation = reportValidator(calibratedReport);
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
      operations: result.operations ?? null
    };
    await writeFile(path.join(outputRoot, "raw", `${scenario.ticker}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
    runs.push({
      case_id: scenario.id,
      ticker: scenario.ticker,
      result: validation.valid ? "report" : "invalid_report",
      elapsed_ms: record.elapsed_ms,
      estimated_cost_usd: result.operations?.estimated_cost_usd ?? result.operations?.budget?.cost_consumed_usd ?? null,
      input_tokens: result.operations?.input_tokens ?? null,
      output_tokens: result.operations?.output_tokens ?? null,
      alpha_vantage_requests_today: result.operations?.bounded_sources?.alpha_vantage_requests_today ?? null,
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
const summary = {
  plan: path.relative(root, planPath).replaceAll("\\", "/"),
  live_calls: true,
  approved_run_count: plan.approval.maximum_runs,
  completed_run_count: runs.length,
  known_openai_cost_usd: Number(totalKnownCost.toFixed(6)),
  maximum_approved_openai_cost_usd: plan.approval.maximum_openai_cost_usd,
  alpha_vantage_requests: maximumAlphaRequests,
  maximum_approved_alpha_vantage_requests: plan.approval.maximum_alpha_vantage_requests,
  runs
};
if (runs.length !== 5 || totalKnownCost > plan.approval.maximum_openai_cost_usd || maximumAlphaRequests > plan.approval.maximum_alpha_vantage_requests) {
  summary.approval_violation = true;
}
await writeFile(path.join(outputRoot, "run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
} finally {
  clearInterval(runnerKeepAlive);
}
