import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAIOutputSchema, findUnsupportedOpenAIKeywords } from "../lib/openai-output-schema.js";
import { loadReportSchema } from "../support/report-fixtures.js";

test("provider schema removes unsupported composition while server schema remains unchanged", async () => {
  const serverSchema = await loadReportSchema();
  const before = structuredClone(serverSchema);
  const unsupported = findUnsupportedOpenAIKeywords(serverSchema);
  assert.ok(unsupported.some((path) => path.endsWith(".allOf")));
  assert.ok(unsupported.some((path) => path.endsWith(".if")));
  assert.ok(unsupported.some((path) => path.endsWith(".then")));

  const providerSchema = createOpenAIOutputSchema(serverSchema);
  assert.deepEqual(findUnsupportedOpenAIKeywords(providerSchema), []);
  assert.equal("$schema" in providerSchema, false);
  assert.equal("$id" in providerSchema, false);
  assert.deepEqual(serverSchema, before);
});
