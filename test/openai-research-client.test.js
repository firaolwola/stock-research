import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAIResearchClient,
  FAST_RESEARCH_TIMEOUT_MS,
  RESEARCH_ERROR_CODES,
  ResearchResponseError
} from "../openai-research-client.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema();
const completeReport = await loadReportFixture("complete");

function adapterFor(responseOrError, requests = [], options = []) {
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
  return createOpenAIResearchClient(openai, { schema });
}

test("OpenAI adapter requests JSON Schema output and parses a completed report", async () => {
  const requests = [];
  const options = [];
  const adapter = adapterFor({
    status: "completed",
    output: [],
    output_text: JSON.stringify(completeReport)
  }, requests, options);

  assert.deepEqual(await adapter.researchTicker("ACME"), completeReport);
  assert.equal(requests.length, 1);
  assert.deepEqual(options, [{ timeout: FAST_RESEARCH_TIMEOUT_MS, maxRetries: 0 }]);
  assert.match(requests[0].input, /ACME/);
  assert.deepEqual(requests[0].tools, [{ type: "web_search" }]);
  assert.deepEqual(requests[0].include, ["web_search_call.action.sources"]);
  assert.match(requests[0].input, /SEC filings and exchange notices before company sources/);
  assert.match(requests[0].input, /never give secondary evidence high confidence/);
  assert.match(requests[0].input, /materially conflicting, use unknown or limited coverage/);
  assert.deepEqual(requests[0].text.format, {
    type: "json_schema",
    name: "stock_report_v1",
    description: "A version 1.0.0 evidence-backed stock research report.",
    schema,
    strict: false
  });
});

test("OpenAI adapter classifies refusal, incomplete, invalid, and unusable output", async () => {
  const cases = [
    {
      response: { status: "completed", output_text: "", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] },
      code: RESEARCH_ERROR_CODES.refused
    },
    { response: { status: "incomplete", output: [], output_text: "{}" }, code: RESEARCH_ERROR_CODES.incomplete },
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

test("OpenAI adapter classifies representative SDK and HTTP failures", async () => {
  const cases = [
    { error: Object.assign(new Error("timeout detail"), { name: "APITimeoutError" }), code: RESEARCH_ERROR_CODES.timeout },
    { error: Object.assign(new Error("rate detail"), { status: 429 }), code: RESEARCH_ERROR_CODES.rateLimit },
    { error: Object.assign(new Error("auth detail"), { name: "AuthenticationError" }), code: RESEARCH_ERROR_CODES.authentication },
    { error: Object.assign(new Error("service detail"), { status: 503 }), code: RESEARCH_ERROR_CODES.temporary },
    { error: Object.assign(new Error("network detail"), { name: "APIConnectionError" }), code: RESEARCH_ERROR_CODES.temporary }
  ];

  for (const { error, code } of cases) {
    await assert.rejects(
      adapterFor(error).researchTicker("ACME"),
      (actual) => actual instanceof ResearchResponseError && actual.code === code && !actual.message.includes("detail")
    );
  }
});

test("OpenAI adapter exposes unclassified SDK failures to the app boundary", async () => {
  const upstreamError = new Error("mock failure");
  await assert.rejects(adapterFor(upstreamError).researchTicker("ACME"), upstreamError);
});
