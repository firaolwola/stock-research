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

const schema = await loadReportSchema();
const completeReport = await loadReportFixture("complete");
const partialReport = await loadReportFixture("partial");

function adapterFor(responseOrError, requests = [], options = [], clientOptions = {}) {
  const openai = {
    responses: {
      async create(request, requestOptions) {
        requests.push(request);
        options.push(requestOptions);
        if (responseOrError instanceof Error) throw responseOrError;
        return responseOrError;
      }
    }
  };
  return createOpenAIResearchClient(openai, { schema, ...clientOptions });
}

test("OpenAI adapter requests JSON Schema output and parses a completed report", async () => {
  const requests = [];
  const options = [];
  const adapter = adapterFor({
    status: "completed",
    output: [{ type: "web_search_call" }, { type: "web_search_call" }],
    output_text: JSON.stringify(completeReport),
    usage: { input_tokens: 10000, output_tokens: 4000, total_tokens: 14000, input_tokens_details: { cached_tokens: 2000 } }
  }, requests, options);

  const result = await adapter.researchTicker("ACME");
  assert.deepEqual(result.report, completeReport);
  assert.equal(result.operations.stage, "fast");
  assert.equal(result.operations.estimated_cost_usd, 0.07025);
  assert.equal(result.operations.web_search_calls, 2);
  assert.equal(requests.length, 1);
  assert.deepEqual(options, [{ timeout: FAST_RESEARCH_TIMEOUT_MS, maxRetries: 0 }]);
  assert.match(requests[0].input, /ACME/);
  assert.equal(requests[0].max_tool_calls, 4);
  assert.deepEqual(requests[0].tools, [{ type: "web_search", search_context_size: "low" }]);
  assert.deepEqual(requests[0].include, ["web_search_call.action.sources"]);
  assert.match(requests[0].input, /SEC filings and exchange notices before company sources/);
  assert.match(requests[0].input, /never give secondary evidence high confidence/);
  assert.match(requests[0].input, /materially conflicting, use unknown or limited coverage/);
  assert.match(requests[0].input, /not_found means a documented, bounded search/);
  assert.match(requests[0].input, /not_applicable means the check does not apply/);
  assert.match(requests[0].input, /A safe partial report is preferable to guessing/);
  assert.match(requests[0].input, /Resolve identity before researching history/);
  assert.match(requests[0].input, /Add the relevant lineage claim ID/);
  assert.match(requests[0].input, /Never carry an event through an unknown or limited-coverage predecessor relationship/);
  assert.match(requests[0].input, /add a structured issuer coverage limitation/);
  assert.match(requests[0].input, /Keep all wording non-advisory/);
  assert.match(requests[0].input, /Do not emit scores/);
  assert.match(requests[0].input, /do not research or emit historical catalyst analogue items/);
  assert.match(requests[0].input, /use at most four focused web-search calls/);
  assert.match(requests[0].input, /defer exhaustive prior-identity discovery/);
  assert.deepEqual(requests[0].text.format, {
    type: "json_schema",
    name: "stock_report_v4",
    description: "A version 4.0.0 evidence-backed stock research report; server-side scoring replaces provider score values.",
    schema: createOpenAIOutputSchema(schema),
    strict: false
  });
  assert.ok(findUnsupportedOpenAIKeywords(schema).length > 0);
  assert.deepEqual(findUnsupportedOpenAIKeywords(requests[0].text.format.schema), []);
  assert.ok("allOf" in schema.$defs.score, "the server schema must retain its stricter semantic constraint");
});

test("Fast operations distinguish within-target and over-target usable responses", async () => {
  for (const [latencyMs, expected] of [[8_000, true], [18_000, false]]) {
    const ticks = [0, latencyMs];
    const adapter = adapterFor({
      status: "completed",
      output: [{ type: "web_search_call" }],
      output_text: JSON.stringify(completeReport),
      usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 }
    }, [], [], { now: () => ticks.shift() });
    const result = await adapter.researchTicker("ACME");
    assert.equal(result.operations.latency_ms, latencyMs);
    assert.equal(result.operations.within_latency_target, expected);
  }
});

test("Fast hard timeout is bounded and reports that no response was received", async () => {
  const requests = [];
  const options = [];
  const ticks = [0, 30_001];
  const adapter = adapterFor(new APIConnectionTimeoutError(), requests, options, { now: () => ticks.shift() });
  await assert.rejects(adapter.researchTicker("SWVL"), (error) => {
    assert.equal(error.code, RESEARCH_ERROR_CODES.timeout);
    assert.equal(error.diagnostics.phase, "openai_request");
    assert.equal(error.diagnostics.elapsed_ms, 30_001);
    assert.equal(error.diagnostics.response_received, false);
    return true;
  });
  assert.deepEqual(options, [{ timeout: 30_000, maxRetries: 0 }]);
});

test("Deep retains a separate larger search budget", async () => {
  const requests = [];
  await adapterFor({ status: "completed", output: [], output_text: JSON.stringify(partialReport) }, requests)
    .researchTicker("XYZ", { stage: "deep" });
  assert.equal(requests[0].max_tool_calls, 10);
  assert.deepEqual(requests[0].tools, [{ type: "web_search", search_context_size: "medium" }]);
});

test("OpenAI adapter classifies refusal, incomplete, invalid, and unusable output", async () => {
  const cases = [
    {
      response: { status: "completed", output_text: "", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] },
      code: RESEARCH_ERROR_CODES.refused
    },
    { response: { status: "incomplete", output: [], output_text: "" }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "incomplete", output: [], output_text: "not json" }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "incomplete", output: [], output_text: JSON.stringify(completeReport) }, code: RESEARCH_ERROR_CODES.incomplete },
    { response: { status: "completed", output: [], output_text: "not json" }, code: RESEARCH_ERROR_CODES.invalid },
    { response: { status: "failed", output: [], output_text: "{}" }, code: RESEARCH_ERROR_CODES.unusable },
    { response: { status: "completed", output: [], output_text: "" }, code: RESEARCH_ERROR_CODES.unusable }
  ];

  for (const { response, code } of cases) {
    await assert.rejects(
      adapterFor(response).researchTicker("ACME"),
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
  await assert.rejects(adapter.researchTicker("SWVL"), (error) => {
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
  await assert.rejects(adapterFor(response).researchTicker("ACME"), (error) => {
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
      adapterFor(error).researchTicker("ACME"),
      (actual) => actual instanceof ResearchResponseError && actual.code === code && !actual.message.includes("detail")
    );
  }
});

test("OpenAI adapter wraps unclassified SDK failures with safe lifecycle diagnostics", async () => {
  const upstreamError = new Error("mock failure");
  await assert.rejects(adapterFor(upstreamError).researchTicker("ACME"), (error) => error instanceof ResearchResponseError && error.code === RESEARCH_ERROR_CODES.unexpected && error.diagnostics.phase === "openai_request");
});
