import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAIResearchClient } from "../openai-research-client.js";

test("OpenAI adapter uses only the injected SDK client", async () => {
  const requests = [];
  const adapter = createOpenAIResearchClient({
    responses: { async create(request) { requests.push(request); return { output_text: "Mock output" }; } }
  });

  assert.equal(await adapter.researchTicker("ACME"), "Mock output");
  assert.equal(requests.length, 1);
  assert.match(requests[0].input, /ACME/);
  assert.deepEqual(requests[0].tools, [{ type: "web_search" }]);
});

test("OpenAI adapter exposes injected client failures to the app boundary", async () => {
  const upstreamError = new Error("mock failure");
  const adapter = createOpenAIResearchClient({ responses: { async create() { throw upstreamError; } } });
  await assert.rejects(adapter.researchTicker("ACME"), upstreamError);
});
