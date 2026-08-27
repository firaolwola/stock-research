import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceFirstResearchClient } from "../evidence-first-research-client.js";
import { loadReportFixture } from "../support/report-fixtures.js";
import { createFastBudgetController } from "../lib/fast-budget-controller.js";

const report = await loadReportFixture("partial"); report.metadata.stage = "fast";
const packet = { ticker: "ACME", identity: { ticker: "ACME", issuer_legal_name: "Example Corp.", cik: "0000123456" }, records: [{ id: "evidence-sec-identity", category: "security_and_listing", text: "SEC identity", source_id: "source-1" }] };
const deterministic = { report, operations: { stage: "fast", web_search_calls: 0 }, evidence_packet: packet, evidence_records: packet.records };

function setup(responseOrError) {
  const requests = []; const deepCalls = [];
  const secClient = { getPacket() { return packet; }, async researchTicker() { return structuredClone(deterministic); } };
  const openai = { responses: { async create(request, options) { requests.push({ request, options }); if (responseOrError instanceof Error) throw responseOrError; return responseOrError; } } };
  const deepClient = { async researchTicker(ticker, options) { deepCalls.push({ ticker, options }); return { report }; } };
  return { client: createEvidenceFirstResearchClient({ secClient, openai, deepClient }), requests, deepCalls };
}

test("Fast synthesis has no tools and references only supplied evidence IDs", async () => {
  const { client, requests } = setup({ status: "completed", output_text: JSON.stringify({ priority_evidence_ids: ["evidence-sec-identity"], category_assessments: [{ category: "security_and_listing", classification: "context", evidence_ids: ["evidence-sec-identity"] }] }), usage: { input_tokens: 500, output_tokens: 100, total_tokens: 600 } });
  const result = await client.researchTicker("ACME");
  assert.deepEqual(requests[0].request.tools, []); assert.equal(requests[0].request.tool_choice, "none"); assert.equal(requests[0].request.max_output_tokens, 900);
  assert.equal(result.synthesis.status, "completed"); assert.equal(result.operations.web_search_calls, 0); assert.equal(result.operations.input_tokens, 500);
});

test("failed or unsupported synthesis retains deterministic report", async () => {
  for (const response of [new Error("timeout"), { status: "completed", output_text: JSON.stringify({ priority_evidence_ids: ["invented"], category_assessments: [] }) }]) {
    const { client } = setup(response); const result = await client.researchTicker("ACME");
    assert.deepEqual(result.report, report); assert.equal(result.synthesis.status, "unavailable");
  }
});

test("Deep receives the completed Fast evidence packet as seed", async () => {
  const { client, deepCalls } = setup(null); await client.researchTicker("ACME", { stage: "deep" });
  assert.deepEqual(deepCalls[0].options.seedEvidence, packet);
});

test("Fast skips synthesis before a paid call would exceed the cost ceiling", async () => {
  const { client, requests } = setup({ status: "completed", output_text: "{}", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } });
  const budget = createFastBudgetController({ costLimitUsd: 0.005 });
  const result = await client.researchTicker("ACME", { budget });
  assert.equal(requests.length, 0);
  assert.deepEqual(result.report, report);
  assert.equal(result.synthesis.status, "skipped");
  assert.equal(result.operations.budget.termination_reason, "cost_ceiling");
  assert.equal(result.operations.budget.sources.openai_synthesis.status, "cost_blocked");
  budget.finish({ partial: true });
});

test("slow synthesis receives cancellation and retains deterministic evidence", async () => {
  let providerSignal;
  const secClient = { getPacket() { return packet; }, async researchTicker() { return structuredClone(deterministic); } };
  const openai = { responses: { async create(_request, options) {
    providerSignal = options.signal;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  } } };
  const deepClient = { async researchTicker() { return { report }; } };
  const client = createEvidenceFirstResearchClient({ secClient, openai, deepClient });
  const budget = createFastBudgetController({ elapsedLimitMs: 40, finalizationReserveMs: 10 });
  const result = await client.researchTicker("ACME", { budget });
  assert.equal(providerSignal.aborted, true);
  assert.deepEqual(result.report, report);
  assert.equal(result.synthesis.status, "unavailable");
  assert.equal(result.operations.budget.termination_reason, "time_ceiling");
  budget.finish({ partial: true });
});
