import { buildResearchOperations, estimateResearchCost, PRICING_SNAPSHOT } from "./lib/research-budget.js";

const SYNTHESIS_TIMEOUT_MS = 8_000;
const synthesisSchema = {
  type: "object", additionalProperties: false, required: ["priority_evidence_ids", "category_assessments"],
  properties: {
    priority_evidence_ids: { type: "array", maxItems: 8, items: { type: "string" } },
    category_assessments: { type: "array", maxItems: 9, items: { type: "object", additionalProperties: false, required: ["category", "classification", "evidence_ids"], properties: { category: { enum: ["security_and_listing", "issuer_lineage", "reverse_splits", "dilution_offerings", "warrants_convertibles", "compliance", "going_concern_accounting", "financial_context", "catalysts_news"] }, classification: { enum: ["material_risk", "context", "unresolved"] }, evidence_ids: { type: "array", items: { type: "string" } } } } }
  }
};

function validateSynthesis(value, allowed) {
  const ids = [...(value?.priority_evidence_ids ?? []), ...(value?.category_assessments ?? []).flatMap((item) => item.evidence_ids ?? [])];
  return ids.every((id) => allowed.has(id)) && Array.isArray(value?.category_assessments);
}

export function createEvidenceFirstResearchClient({ secClient, openai, deepClient, now = () => performance.now() } = {}) {
  if (!secClient || !deepClient) throw new TypeError("SEC and Deep research clients are required");
  return {
    async researchTicker(ticker, { stage = "fast", onProgress } = {}) {
      if (stage === "deep") return deepClient.researchTicker(ticker, { stage, seedEvidence: secClient.getPacket(ticker) });
      const started = now(); const deterministic = await secClient.researchTicker(ticker, { onProgress: onProgress ? (progress) => onProgress({ ...progress, operations: { ...progress.operations, synthesis: { status: "pending" } } }) : undefined });
      const packet = deterministic.evidence_packet; if (!packet || !openai?.responses?.create) return { ...deterministic, synthesis: { status: "unavailable" } };
      let response; const synthesisStarted = now();
      try {
        response = await openai.responses.create({ model: "gpt-5.1", reasoning: { effort: "none" }, tools: [], tool_choice: "none", max_output_tokens: 900, text: { format: { type: "json_schema", name: "fast_evidence_synthesis", strict: true, schema: synthesisSchema } }, input: `Classify only the supplied evidence records. Do not add facts. Every classification must reference record IDs from this packet. Missing categories stay unresolved.\n${JSON.stringify(packet)}` }, { timeout: SYNTHESIS_TIMEOUT_MS, maxRetries: 0 });
        const synthesis = JSON.parse(response.output_text); const allowed = new Set(packet.records.map((item) => item.id)); if (response.status !== "completed" || !validateSynthesis(synthesis, allowed)) throw new Error("Invalid synthesis");
        const totalLatency = now() - started;
        const operations = { ...deterministic.operations, latency_ms: Math.round(totalLatency), within_latency_target: totalLatency <= 20_000, input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null, total_tokens: response.usage?.total_tokens ?? null, estimated_cost_usd: estimateResearchCost(response.usage, 0), pricing_version: response.usage ? PRICING_SNAPSHOT.version : null, synthesis: { status: "completed", latency_ms: Math.round(now() - synthesisStarted), ...synthesis } };
        return { ...deterministic, operations, synthesis: operations.synthesis };
      } catch {
        return { ...deterministic, operations: { ...deterministic.operations, synthesis: { status: "unavailable" } }, synthesis: { status: "unavailable" } };
      }
    }
  };
}
