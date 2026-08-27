import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAIResearchClient,
  FAST_RESEARCH_TIMEOUT_MS,
  RESEARCH_ERROR_CODES,
  ResearchResponseError
} from "../openai-research-client.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";
import { createOpenAIOutputSchema, findUnsupportedOpenAIKeywords } from "../lib/openai-output-schema.js";
import { APIConnectionTimeoutError } from "openai";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";

const schema = await loadReportSchema();
const completeReport = await loadReportFixture("complete");
const partialReport = await loadReportFixture("partial");
const reportValidator = createReportValidator(schema);

function fragmentFor(domain, report = completeReport) {
  const common = { domain, identity: { ticker: report.security.ticker, issuer_legal_name: report.issuer.legal_name, cik: report.issuer.cik }, claims: report.claims, sources: report.sources };
  if (domain === "capital") Object.assign(common, { security: report.security, issuer: report.issuer });
  if (domain === "capital") return { ...common, reverse_splits: report.sections.reverse_splits, dilution: report.sections.dilution };
  if (domain === "financial") return { ...common, dividends: report.sections.dividends, financial_assessment: report.financial_assessment };
  const { historical_analogues, ...catalystAssessment } = report.catalyst_assessment;
  return { ...common, compliance_and_warnings: report.sections.compliance_and_warnings, catalyst_assessment: catalystAssessment };
}

function domainResponse(request) {
  const domain = request.text.format.name.match(/^fast_(.+)_evidence$/)?.[1];
  return { status: "completed", output: [{ type: "web_search_call" }], output_text: JSON.stringify(fragmentFor(domain)), usage: { input_tokens: 1000, output_tokens: 700, total_tokens: 1700 } };
}

function adapterFor(responseOrError, requests = [], options = [], clientOptions = {}) {
  const openai = {
    responses: {
      async create(request, requestOptions) {
        requests.push(request);
        options.push(requestOptions);
        const result = typeof responseOrError === "function" ? responseOrError(request, requestOptions) : responseOrError;
        if (result instanceof Error) throw result;
        return result;
      }
    }
  };
  return createOpenAIResearchClient(openai, { schema, enableLegacyFast: true, ...clientOptions });
}

test("OpenAI adapter requests JSON Schema output and parses a completed report", async () => {
  const requests = [];
  const options = [];
  const adapter = adapterFor(domainResponse, requests, options);
  const progress = [];

  const result = await adapter.researchTicker("ACME", { onProgress(value) { progress.push(value); } });
  assert.equal(result.report.metadata.stage, "fast");
  assert.equal(result.report.metadata.completion_status, "partial");
  assert.deepEqual(result.report.sections.dilution, completeReport.sections.dilution);
  assert.deepEqual(result.report.financial_assessment, completeReport.financial_assessment);
  const validation = reportValidator(calibrateReportScores(result.report));
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(result.operations.stage, "fast");
  assert.equal(result.operations.web_search_calls, 3);
  assert.equal(result.operations.domains.capital.input_tokens, 1000);
  assert.equal(result.operations.domains.capital.output_tokens, 700);
  assert.equal(result.operations.domains.capital.web_search_calls, 1);
  assert.equal(typeof result.operations.domains.capital.estimated_cost_usd, "number");
  assert.equal(progress.length, 3);
  assert.equal(progress.at(-1).final, true);
  assert.equal(requests.length, 3);
  assert.ok(options.every((option) => option.timeout === FAST_RESEARCH_TIMEOUT_MS && option.maxRetries === 0));
  assert.deepEqual(new Set(requests.map((request) => request.text.format.name)), new Set(["fast_capital_evidence", "fast_catalyst_evidence", "fast_financial_evidence"]));
  assert.ok(requests.every((request) => request.tools[0].search_context_size === "low" && /ACME/.test(request.input)));
  assert.deepEqual(requests.map((request) => request.max_tool_calls).sort(), [1, 2, 2]);
  assert.ok(requests.every((request) => findUnsupportedOpenAIKeywords(request.text.format.schema).length === 0));
  assert.ok("allOf" in schema.$defs.score, "the server schema must retain its stricter semantic constraint");
});

test("Fast launches three operations and reports failures as Pending instead of favorable evidence", async () => {
  const requests = [];
  const options = [];
  const result = await adapterFor(new APIConnectionTimeoutError(), requests, options).researchTicker("SWVL");
  assert.equal(requests.length, 3);
  assert.ok(options.every((option) => option.timeout === 20_000));
  assert.equal(result.report.metadata.completion_status, "pending");
  assert.equal(result.report.sections.dilution.state, "unknown");
  assert.equal(result.report.financial_assessment.state, "unknown");
  assert.equal(result.report.catalyst_assessment.current.state, "unknown");
  assert.ok(Object.values(result.operations.domains).every((domain) => domain.status === "pending" && domain.error_code === RESEARCH_ERROR_CODES.timeout));
});

test("Fast starts every domain before waiting and preserves successful domains", async () => {
  const pending = [];
  const openai = { responses: { create(request) { return new Promise((resolve) => pending.push({ request, resolve })); } } };
  const research = createOpenAIResearchClient(openai, { schema, enableLegacyFast: true }).researchTicker("ACME");
  await Promise.resolve();
  assert.equal(pending.length, 3);
  for (const item of pending) {
    const domain = item.request.text.format.name.match(/^fast_(.+)_evidence$/)[1];
    if (domain === "financial") item.resolve({ status: "failed", output: [], output_text: "" });
    else item.resolve(domainResponse(item.request));
  }
  const result = await research;
  assert.equal(result.operations.domains.capital.status, "completed");
  assert.equal(result.operations.domains.catalyst.status, "completed");
  assert.equal(result.operations.domains.financial.status, "pending");
  assert.deepEqual(result.report.sections.dilution, completeReport.sections.dilution);
  assert.equal(result.report.financial_assessment.state, "unknown");
});

test("a truncated Fast domain stays Pending and retains its usage telemetry", async () => {
  const adapter = adapterFor((request) => {
    const domain = request.text.format.name.match(/^fast_(.+)_evidence$/)[1];
    if (domain !== "capital") return domainResponse(request);
    return { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "web_search_call" }], output_text: "{\"domain\":", usage: { input_tokens: 11846, output_tokens: 1200, total_tokens: 13046 } };
  });
  const result = await adapter.researchTicker("ACME");
  assert.equal(result.operations.domains.capital.status, "pending");
  assert.equal(result.operations.domains.capital.error_code, RESEARCH_ERROR_CODES.incomplete);
  assert.equal(result.operations.domains.capital.output_tokens, 1200);
  assert.equal(result.operations.domains.capital.web_search_calls, 1);
  assert.equal(result.operations.input_tokens, 13846);
  assert.equal(result.report.sections.dilution.state, "unknown");
  assert.equal(result.report.financial_assessment.state, completeReport.financial_assessment.state);
});

test("one timed-out Fast domain does not discard completed domain evidence", async () => {
  const adapter = adapterFor((request) => request.text.format.name.includes("catalyst") ? new APIConnectionTimeoutError() : domainResponse(request));
  const result = await adapter.researchTicker("ACME");
  assert.equal(result.operations.domains.catalyst.status, "pending");
  assert.equal(result.operations.domains.catalyst.error_code, RESEARCH_ERROR_CODES.timeout);
  assert.equal(result.operations.domains.capital.status, "completed");
  assert.deepEqual(result.report.sections.dilution, completeReport.sections.dilution);
  assert.deepEqual(result.report.financial_assessment, completeReport.financial_assessment);
  assert.equal(result.report.catalyst_assessment.current.state, "unknown");
});

test("Deep retains a separate larger search budget", async () => {
  const requests = [];
  await adapterFor({ status: "completed", output: [], output_text: JSON.stringify(partialReport) }, requests)
    .researchTicker("XYZ", { stage: "deep" });
  assert.equal(requests[0].max_tool_calls, 10);
  assert.deepEqual(requests[0].tools, [{ type: "web_search", search_context_size: "medium" }]);
});

test("Deep prompt receives completed Fast evidence as authoritative seed", async () => {
  const requests = []; const seed = { identity: { ticker: "XYZ", cik: "0000000001" }, records: [{ id: "evidence-1", text: "SEC fact" }] };
  await adapterFor({ status: "completed", output: [], output_text: JSON.stringify(partialReport) }, requests).researchTicker("XYZ", { stage: "deep", seedEvidence: seed });
  assert.match(requests[0].input, /evidence-1/); assert.match(requests[0].input, /Search only the explicit priority_plan gaps/);
});

test("OpenAI adapter classifies refusal, incomplete, invalid, and unusable output", async () => {
  const cases = [
    {
      response: { status: "completed", output_text: "", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] },
      code: RESEARCH_ERROR_CODES.refused
    },
    { response: { status: "incomplete", output: [], output_text: "" }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "incomplete", output: [], output_text: "not json" }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "incomplete", output: [], output_text: JSON.stringify({ ...completeReport, metadata: { ...completeReport.metadata, stage: "deep" } }) }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "completed", output: [], output_text: "not json" }, code: RESEARCH_ERROR_CODES.invalid },
    { response: { status: "failed", output: [], output_text: "{}" }, code: RESEARCH_ERROR_CODES.unusable },
    { response: { status: "completed", output: [], output_text: "" }, code: RESEARCH_ERROR_CODES.unusable }
  ];

  for (const { response, code } of cases) {
    await assert.rejects(
      adapterFor(response).researchTicker("ACME", { stage: "deep" }),
      (error) => error instanceof ResearchResponseError && error.code === code
    );
  }
});

test("OpenAI adapter preserves parseable structured output from an incomplete response", async () => {
  const adapter = adapterFor({
    status: "incomplete",
    output: [],
    output_text: JSON.stringify(partialReport)
  });

  assert.deepEqual((await adapter.researchTicker("XYZ", { stage: "deep" })).report, partialReport);
});

test("max-output exhaustion retains response phase, reason, and token usage", async () => {
  const adapter = adapterFor({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    output: [],
    output_text: "{\"truncated\":",
    usage: { input_tokens: 23000, output_tokens: 5000, total_tokens: 28000 }
  });
  await assert.rejects(adapter.researchTicker("SWVL", { stage: "deep" }), (error) => {
    assert.equal(error.code, RESEARCH_ERROR_CODES.incomplete);
    assert.equal(error.diagnostics.phase, "json_parse");
    assert.equal(error.diagnostics.response_received, true);
    assert.equal(error.diagnostics.response_status, "incomplete");
    assert.equal(error.diagnostics.incomplete_reason, "max_output_tokens");
    assert.equal(error.diagnostics.output_tokens, 5000);
    return true;
  });
});

test("installed SDK timeout is classified by constructor even though its name is Error", async () => {
  const sdkTimeout = new APIConnectionTimeoutError();
  assert.equal(sdkTimeout.name, "Error");
  await assert.rejects(adapterFor(sdkTimeout).researchTicker("SWVL", { stage: "deep" }), (error) => {
    assert.equal(error.code, RESEARCH_ERROR_CODES.timeout);
    assert.equal(error.diagnostics.stage, "deep");
    assert.equal(error.diagnostics.phase, "openai_request");
    assert.equal(error.diagnostics.error_constructor, "APIConnectionTimeoutError");
    assert.equal(error.diagnostics.response_received, false);
    return true;
  });
});

test("response output access failures retain the post-response lifecycle phase", async () => {
  const response = { status: "completed", output_text: JSON.stringify(completeReport), usage: null };
  Object.defineProperty(response, "output", { get() { throw new Error("hidden output failure"); } });
  await assert.rejects(adapterFor(response).researchTicker("ACME", { stage: "deep" }), (error) => {
    assert.equal(error.code, RESEARCH_ERROR_CODES.unusable);
    assert.equal(error.diagnostics.phase, "response_output_read");
    assert.equal(error.diagnostics.response_received, true);
    return true;
  });
});

test("OpenAI adapter classifies representative SDK and HTTP failures", async () => {
  const cases = [
    { error: Object.assign(new Error("timeout detail"), { name: "APITimeoutError" }), code: RESEARCH_ERROR_CODES.timeout },
    { error: Object.assign(new Error("rate detail"), { status: 429 }), code: RESEARCH_ERROR_CODES.rateLimit },
    { error: Object.assign(new Error("auth detail"), { name: "AuthenticationError" }), code: RESEARCH_ERROR_CODES.authentication },
    { error: Object.assign(new Error("service detail"), { status: 503 }), code: RESEARCH_ERROR_CODES.temporary },
    { error: Object.assign(new Error("network detail"), { name: "APIConnectionError" }), code: RESEARCH_ERROR_CODES.temporary },
    { error: Object.assign(new Error("schema detail"), { name: "BadRequestError", status: 400, code: "invalid_json_schema" }), code: RESEARCH_ERROR_CODES.badRequest }
  ];

  for (const { error, code } of cases) {
    await assert.rejects(
      adapterFor(error).researchTicker("ACME", { stage: "deep" }),
      (actual) => actual instanceof ResearchResponseError && actual.code === code && !actual.message.includes("detail")
    );
  }
});

test("OpenAI adapter wraps unclassified SDK failures with safe lifecycle diagnostics", async () => {
  const upstreamError = new Error("mock failure");
  await assert.rejects(adapterFor(upstreamError).researchTicker("ACME", { stage: "deep" }), (error) => error instanceof ResearchResponseError && error.code === RESEARCH_ERROR_CODES.unexpected && error.diagnostics.phase === "openai_request");
});
