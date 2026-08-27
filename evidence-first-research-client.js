import { buildResearchOperations, estimateResearchCost, PRICING_SNAPSHOT } from "./lib/research-budget.js";
import { createFastBudgetController } from "./lib/fast-budget-controller.js";

const SYNTHESIS_TIMEOUT_MS = 8_000;
const SYNTHESIS_MAX_OUTPUT_TOKENS = 900;
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

function synthesisMaximumCost(request, pricing = PRICING_SNAPSHOT) {
  // JSON and English normally tokenize well below one token per two characters.
  // Using one token per two characters also covers the request schema and leaves
  // conservative headroom while keeping the reservation reproducible.
  const maximumInputTokens = Math.ceil(JSON.stringify(request).length / 2);
  return Number((maximumInputTokens * pricing.input_per_million_usd / 1_000_000 + SYNTHESIS_MAX_OUTPUT_TOKENS * pricing.output_per_million_usd / 1_000_000).toFixed(6));
}

export function createEvidenceFirstResearchClient({ secClient, boundedSourceClient, openai, deepClient, now = () => performance.now() } = {}) {
  if (!secClient || !deepClient) throw new TypeError("SEC and Deep research clients are required");
  const completedPackets = new Map();
  return {
    async researchTicker(ticker, { stage = "fast", onProgress, budget, budgetClass = "normal" } = {}) {
      if (stage === "deep") return deepClient.researchTicker(ticker, { stage, seedEvidence: completedPackets.get(ticker) ?? secClient.getPacket(ticker) });
      const ownedBudget = !budget;
      const fastBudget = budget ?? createFastBudgetController({ budgetClass, now });
      const started = now();
      const withBudget = (operations, final = false) => ({ ...operations, budget: fastBudget.telemetry({ final }) });
      const settle = (result, { partial = false } = {}) => {
        if (partial) fastBudget.markPartial();
        const budgetTelemetry = ownedBudget ? fastBudget.finish({ partial }) : fastBudget.telemetry({ final: true });
        return { ...result, operations: { ...result.operations, budget: budgetTelemetry } };
      };
      let deterministic = await secClient.researchTicker(ticker, {
        budget: fastBudget,
        onProgress: onProgress ? (progress) => onProgress({ ...progress, operations: { ...withBudget(progress.operations), synthesis: { status: "pending" } } }) : undefined
      });
      if (boundedSourceClient && !fastBudget.isStopped() && deterministic.evidence_packet) {
        deterministic = await boundedSourceClient.enrich(ticker, deterministic, { budget: fastBudget, onProgress });
        deterministic.evidence_packet = { ...deterministic.evidence_packet, records: structuredClone(deterministic.evidence_records), sources: structuredClone(deterministic.report.sources) };
      }
      const packet = deterministic.evidence_packet;
      if (packet) completedPackets.set(ticker, structuredClone(packet));
      if (!packet || !openai?.responses?.create || fastBudget.isStopped()) {
        const reason = fastBudget.telemetry().termination_reason;
        const status = reason === "time_ceiling" || reason === "cost_ceiling" ? "skipped" : "unavailable";
        fastBudget.recordSource("openai_synthesis", status === "skipped" ? "cancelled" : "unavailable", { reason });
        return settle({ ...deterministic, synthesis: { status, reason } }, { partial: true });
      }
      let response; const synthesisStarted = now();
      const request = { model: "gpt-5.1", reasoning: { effort: "none" }, tools: [], tool_choice: "none", max_output_tokens: SYNTHESIS_MAX_OUTPUT_TOKENS, text: { format: { type: "json_schema", name: "fast_evidence_synthesis", strict: true, schema: synthesisSchema } }, input: `Classify only the supplied evidence records. Do not add facts. Every classification must reference record IDs from this packet. Missing categories stay unresolved.\n${JSON.stringify(packet)}` };
      const reservation = fastBudget.reserveCost("openai_synthesis", synthesisMaximumCost(request));
      if (!reservation) return settle({ ...deterministic, synthesis: { status: "skipped", reason: fastBudget.telemetry().termination_reason } }, { partial: true });
      try {
        fastBudget.recordSource("openai_synthesis", "in_progress");
        const timeout = Math.min(SYNTHESIS_TIMEOUT_MS, fastBudget.remainingTimeMs());
        if (timeout <= 0) throw new DOMException("Fast work deadline reached", "TimeoutError");
        response = await openai.responses.create(request, { timeout, maxRetries: 0, signal: fastBudget.signal });
        const synthesis = JSON.parse(response.output_text); const allowed = new Set(packet.records.map((item) => item.id)); if (response.status !== "completed" || !validateSynthesis(synthesis, allowed)) throw new Error("Invalid synthesis");
        const actualCost = estimateResearchCost(response.usage, 0);
        if (actualCost === null) throw new Error("Synthesis usage unavailable");
        fastBudget.commitCost(reservation, actualCost);
        const totalLatency = now() - started;
        const operations = { ...deterministic.operations, latency_ms: Math.round(totalLatency), within_latency_target: totalLatency <= 20_000, input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null, total_tokens: response.usage?.total_tokens ?? null, estimated_cost_usd: actualCost, pricing_version: PRICING_SNAPSHOT.version, synthesis: { status: "completed", latency_ms: Math.round(now() - synthesisStarted), ...synthesis } };
        return settle({ ...deterministic, operations, synthesis: operations.synthesis });
      } catch (error) {
        fastBudget.releaseCost(reservation);
        const timedOut = fastBudget.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
        fastBudget.recordSource("openai_synthesis", timedOut ? "timed_out" : "unavailable");
        return settle({ ...deterministic, operations: { ...deterministic.operations, synthesis: { status: "unavailable" } }, synthesis: { status: "unavailable" } }, { partial: true });
      }
    }
  };
}
