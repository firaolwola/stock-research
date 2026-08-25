import express from "express";
import { validateTicker } from "./ticker-validation.js";
import { getSafeUpstreamDiagnostics, RESEARCH_ERROR_CODES, ResearchResponseError } from "./openai-research-client.js";
import { calibrateReportScores } from "./lib/scoring.js";
import { parseResearchStage } from "./lib/research-budget.js";

const controlledResearchErrors = Object.freeze({
  [RESEARCH_ERROR_CODES.timeout]: Object.freeze({ status: 504, code: "RESEARCH_TIMEOUT", error: "Research took too long. Please try again." }),
  [RESEARCH_ERROR_CODES.rateLimit]: Object.freeze({ status: 503, code: "RESEARCH_RATE_LIMITED", error: "Research is temporarily rate limited. Please try again later." }),
  [RESEARCH_ERROR_CODES.authentication]: Object.freeze({ status: 502, code: "RESEARCH_CONFIGURATION_ERROR", error: "Research is temporarily unavailable." }),
  [RESEARCH_ERROR_CODES.temporary]: Object.freeze({ status: 503, code: "RESEARCH_SERVICE_UNAVAILABLE", error: "The research service is temporarily unavailable." }),
  [RESEARCH_ERROR_CODES.refused]: Object.freeze({ code: "RESEARCH_REFUSED", error: "The research request was refused." }),
  [RESEARCH_ERROR_CODES.incomplete]: Object.freeze({ code: "RESEARCH_INCOMPLETE", error: "The research response was incomplete." }),
  [RESEARCH_ERROR_CODES.invalid]: Object.freeze({ code: "INVALID_RESEARCH_RESPONSE", error: "The research provider returned an invalid report." }),
  [RESEARCH_ERROR_CODES.unusable]: Object.freeze({ code: "RESEARCH_UNUSABLE", error: "The research provider returned an unusable response." }),
  [RESEARCH_ERROR_CODES.badRequest]: Object.freeze({ code: "RESEARCH_REQUEST_REJECTED", error: "The research request configuration was rejected." }),
  [RESEARCH_ERROR_CODES.unexpected]: Object.freeze({ code: "RESEARCH_UNAVAILABLE", error: "Research is temporarily unavailable." })
});

function diagnosticSuffix(diagnostics = {}) {
  const fields = [
    ["stage", diagnostics.stage], ["phase", diagnostics.phase], ["elapsed_ms", diagnostics.elapsed_ms],
    ["constructor", diagnostics.error_constructor], ["type", diagnostics.error_type], ["status", diagnostics.status], ["provider_code", diagnostics.provider_code],
    ["cause_constructor", diagnostics.cause_constructor], ["cause_name", diagnostics.cause_name], ["cause_status", diagnostics.cause_status], ["cause_code", diagnostics.cause_code],
    ["response_received", diagnostics.response_received], ["response_status", diagnostics.response_status], ["incomplete_reason", diagnostics.incomplete_reason],
    ["input_tokens", diagnostics.input_tokens], ["output_tokens", diagnostics.output_tokens], ["total_tokens", diagnostics.total_tokens]
  ]
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  return fields.length ? `; ${fields.join("; ")}` : "";
}

export function createApp({ researchClient, reportValidator, logger = console, runtime = { mode: "live", demoTicker: null } } = {}) {
  if (!researchClient || typeof researchClient.researchTicker !== "function") {
    throw new TypeError("createApp requires a researchClient with researchTicker(ticker)");
  }
  if (typeof reportValidator !== "function") {
    throw new TypeError("createApp requires a reportValidator(report)");
  }

  const app = express();
  app.use(express.static("public"));

  app.get("/api/runtime", (_req, res) => {
    return res.json({ mode: runtime.mode, demoTicker: runtime.demoTicker, demoTickers: runtime.demoTickers });
  });

  app.get("/api/analyze", async (req, res) => {
    const validation = validateTicker(req.query.ticker);
    if (!validation.valid) {
      return res.status(400).json({ code: validation.error.code, error: validation.error.message });
    }
    const { ticker } = validation;
    const stageValidation = parseResearchStage(req.query.stage);
    if (!stageValidation.valid) return res.status(400).json({ code: "INVALID_RESEARCH_STAGE", error: "Research stage must be fast or deep." });
    const { stage } = stageValidation;
    const requestStartedAt = performance.now();

    try {
      const researchResult = await researchClient.researchTicker(ticker, { stage });
      const researchedReport = researchResult?.report ?? researchResult;
      const operations = researchResult?.report ? researchResult.operations : null;
      let report;
      try {
        report = calibrateReportScores(researchedReport);
      } catch (error) {
        logger.error(`Research provider returned an unscorable report for ${ticker} (INVALID_RESEARCH_RESPONSE${diagnosticSuffix({ stage, phase: "report_conversion", elapsed_ms: Math.round(performance.now() - requestStartedAt), error_constructor: error?.constructor?.name, error_type: error?.name, response_received: true, input_tokens: operations?.input_tokens, output_tokens: operations?.output_tokens, total_tokens: operations?.total_tokens })}).`);
        const controlledError = controlledResearchErrors[RESEARCH_ERROR_CODES.invalid];
        return res.status(502).json({ code: controlledError.code, error: controlledError.error });
      }
      const validationResult = reportValidator(report);
      if (!validationResult.valid) {
        logger.error(`Research provider returned an invalid report for ${ticker} (INVALID_RESEARCH_RESPONSE${diagnosticSuffix({ stage, phase: "report_validation", elapsed_ms: Math.round(performance.now() - requestStartedAt), response_received: true, input_tokens: operations?.input_tokens, output_tokens: operations?.output_tokens, total_tokens: operations?.total_tokens })}).`);
        const controlledError = controlledResearchErrors[RESEARCH_ERROR_CODES.invalid];
        return res.status(502).json({ code: controlledError.code, error: controlledError.error });
      }
      return res.json({ ticker, report, ...(operations ? { operations } : {}) });
    } catch (error) {
      if (error instanceof ResearchResponseError && controlledResearchErrors[error.code]) {
        logger.error(`Research provider response could not be used for ${ticker} (${error.code}${diagnosticSuffix(error.diagnostics)}).`);
        const controlledError = controlledResearchErrors[error.code];
        return res.status(controlledError.status ?? 502).json({ code: controlledError.code, error: controlledError.error });
      }
      logger.error(`Research request failed for ${ticker} (UNCLASSIFIED${diagnosticSuffix(getSafeUpstreamDiagnostics(error))}).`);
      return res.status(502).json({ code: "RESEARCH_UNAVAILABLE", error: "Research is temporarily unavailable." });
    }
  });

  return app;
}
