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
  assert.equal(providerSchema.required.includes("scores"), false);
  assert.equal("scores" in providerSchema.properties, false);
  assert.equal(providerSchema.$defs.historicalAnalogueAssessment.properties.items.maxItems, 0);
  assert.deepEqual(providerSchema.$defs.metadata.properties.stage, { const: "fast" });
  assert.deepEqual(providerSchema.$defs.metadata.properties.completion_status, { enum: ["partial", "pending"] });

  const deepSchema = createOpenAIOutputSchema(serverSchema, { stage: "deep" });
  assert.equal(deepSchema.required.includes("scores"), false);
  assert.equal(deepSchema.$defs.historicalAnalogueAssessment.properties.items.maxItems, 3);
  assert.deepEqual(deepSchema.$defs.metadata.properties.stage, { const: "deep" });
  assert.ok(deepSchema.properties.claims.maxItems > providerSchema.properties.claims.maxItems);
});
