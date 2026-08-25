import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenAIResearchClient,
  RESEARCH_ERROR_CODES,
  ResearchResponseError
} from "../openai-research-client.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema();
const completeReport = await loadReportFixture("complete");

function adapterFor(responseOrError, requests = []) {
  const openai = {
    responses: {
      async create(request) {
        requests.push(request);
        if (responseOrError instanceof Error) throw responseOrError;
        return responseOrError;
      }
    }
  };
  return createOpenAIResearchClient(openai, { schema });
}

test("OpenAI adapter requests JSON Schema output and parses a completed report", async () => {
  const requests = [];
  const adapter = adapterFor({
    status: "completed",
    output: [],
    output_text: JSON.stringify(completeReport)
  }, requests);

  assert.deepEqual(await adapter.researchTicker("ACME"), completeReport);
  assert.equal(requests.length, 1);
  assert.match(requests[0].input, /ACME/);
  assert.deepEqual(requests[0].tools, [{ type: "web_search" }]);
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

test("OpenAI adapter exposes injected SDK failures to the app boundary", async () => {
  const upstreamError = new Error("mock failure");
  await assert.rejects(adapterFor(upstreamError).researchTicker("ACME"), upstreamError);
});
