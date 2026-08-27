import { buildResearchOperations, estimateResearchCost, PRICING_SNAPSHOT } from "./lib/research-budget.js";
import { createFastBudgetController } from "./lib/fast-budget-controller.js";
import { calibrateReportScores } from "./lib/scoring.js";
import { getSafeUpstreamDiagnostics, ResearchResponseError, RESEARCH_ERROR_CODES } from "./openai-research-client.js";
import { assessFastSnapshot, buildDeepPriorityPlan, countAvoidedRetrievals, createDeepSeed, hasSafeFastIdentity, mergeDeepWithFast } from "./lib/deep-fast-handoff.js";

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

export function createEvidenceFirstResearchClient({ secClient, boundedSourceClient, openai, deepClient, reportValidator, now = () => performance.now(), wallNow = () => Date.now() } = {}) {
  if (!secClient || !deepClient) throw new TypeError("SEC and Deep research clients are required");
  if (typeof reportValidator !== "function") throw new TypeError("A report validator is required for Fast-to-Deep handoff");
  const completedPackets = new Map();

  const cacheHits = (operations) => {
    const cache = operations?.retrieval?.cache ?? {};
    return Object.values(cache).flatMap((value) => Array.isArray(value) ? value.map((item) => item.state) : [value]).filter((value) => value === "hit").length;
  };
  const storeSnapshot = (ticker, result) => {
    if (!result?.evidence_packet || !result?.report) return null;
    const report = calibrateReportScores(result.report); const validation = reportValidator(report);
    if (!validation.valid || report.security?.ticker !== ticker) return null;
    const snapshot = { report, packet: structuredClone(result.evidence_packet), evidence_records: structuredClone(result.evidence_records ?? []), operations: structuredClone(result.operations ?? {}), synthesis: structuredClone(result.synthesis ?? null), captured_at_ms: now(), captured_at: new Date(wallNow()).toISOString() };
    completedPackets.set(ticker, snapshot); return snapshot;
  };

  async function researchFast(ticker, { onProgress, budget, budgetClass = "normal" } = {}) {
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
      if (!packet || !openai?.responses?.create || fastBudget.isStopped()) {
        const reason = fastBudget.telemetry().termination_reason;
        const status = reason === "time_ceiling" || reason === "cost_ceiling" ? "skipped" : "unavailable";
        fastBudget.recordSource("openai_synthesis", status === "skipped" ? "cancelled" : "unavailable", { reason });
        const result = settle({ ...deterministic, synthesis: { status, reason } }, { partial: true }); storeSnapshot(ticker, result); return result;
      }
      let response; const synthesisStarted = now();
      const request = { model: "gpt-5.1", reasoning: { effort: "none" }, tools: [], tool_choice: "none", max_output_tokens: SYNTHESIS_MAX_OUTPUT_TOKENS, text: { format: { type: "json_schema", name: "fast_evidence_synthesis", strict: true, schema: synthesisSchema } }, input: `Classify only the supplied evidence records. Do not add facts. Every classification must reference record IDs from this packet. Missing categories stay unresolved.\n${JSON.stringify(packet)}` };
      const reservation = fastBudget.reserveCost("openai_synthesis", synthesisMaximumCost(request));
      if (!reservation) { const result = settle({ ...deterministic, synthesis: { status: "skipped", reason: fastBudget.telemetry().termination_reason } }, { partial: true }); storeSnapshot(ticker, result); return result; }
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
        const result = settle({ ...deterministic, operations, synthesis: operations.synthesis }); storeSnapshot(ticker, result); return result;
      } catch (error) {
        fastBudget.releaseCost(reservation);
        const timedOut = fastBudget.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
        fastBudget.recordSource("openai_synthesis", timedOut ? "timed_out" : "unavailable");
        const result = settle({ ...deterministic, operations: { ...deterministic.operations, synthesis: { status: "unavailable" } }, synthesis: { status: "unavailable" } }, { partial: true }); storeSnapshot(ticker, result); return result;
      }
  }

  async function researchDeep(ticker, options) {
    const deepStarted = now();
    let snapshot = completedPackets.get(ticker) ?? null; let freshness = assessFastSnapshot(snapshot, ticker, now()); const refreshReason = freshness; let foundationResult = null; let mode = "reused";
    if (freshness.status !== "fresh") {
      mode = freshness.status === "missing" ? "built" : freshness.status === "partially_stale" ? "refreshed_fast_moving" : "rebuilt";
      try {
        foundationResult = await researchFast(ticker, { budgetClass: options.budgetClass ?? "normal" });
      } catch (error) {
        if (error instanceof ResearchResponseError) throw error;
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unexpected, getSafeUpstreamDiagnostics(error, { stage: "deep", phase: "fast_foundation", startedAt: deepStarted, response: null, now }));
      }
      snapshot = completedPackets.get(ticker) ?? null;
      freshness = assessFastSnapshot(snapshot, ticker, now());
    }
    const handoffBase = { mode, packet_age_ms: freshness.age_ms, freshness_status: freshness.status, stale_components: mode === "reused" ? freshness.stale_components : refreshReason.stale_components, freshness_policy_ms: { fast_moving: 120_000, core: 300_000 }, reused_fast_evidence_count: snapshot?.packet?.records?.length ?? 0, duplicate_retrieval_avoided: mode === "reused" ? countAvoidedRetrievals(snapshot?.operations) : cacheHits(foundationResult?.operations), fast_operations: snapshot?.operations ?? foundationResult?.operations ?? null };
    if (!snapshot || !hasSafeFastIdentity(snapshot.report, snapshot.packet, ticker)) {
      const fallback = structuredClone(snapshot?.report ?? foundationResult?.report);
      if (!fallback) throw new ResearchResponseError(RESEARCH_ERROR_CODES.invalid, { stage: "deep", phase: "fast_foundation", response_received: false });
      fallback.metadata.stage = "deep"; fallback.metadata.completion_status = "partial";
      fallback.metadata.coverage_limitations = [...fallback.metadata.coverage_limitations, { code: "deep_identity_blocked", explanation: "Deep stopped because the automatic Fast foundation did not establish an identity-safe issuer packet.", affected_sections: ["issuer", "security"] }];
      return { report: fallback, operations: { stage: "deep", latency_ms: foundationResult?.operations?.latency_ms ?? 0, fast_foundation: { ...handoffBase, status: "blocked_identity", unresolved_components_targeted: [] }, evidence_lineage: { reused_fast_claim_ids: fallback.claims?.map((claim) => claim.id) ?? [], new_deep_claim_ids: [], revisions: [] } } };
    }
    const priorityPlan = buildDeepPriorityPlan(snapshot.report); const seedEvidence = createDeepSeed(snapshot, priorityPlan);
    const deepResult = await deepClient.researchTicker(ticker, { stage: "deep", seedEvidence, priorityPlan });
    const deepReport = deepResult?.report ?? deepResult;
    const securityTypeDisagrees = snapshot.report.security?.evidence_state === "confirmed" && deepReport?.security?.evidence_state === "confirmed" && snapshot.report.security.security_type !== deepReport.security.security_type;
    if (deepReport?.security?.ticker !== ticker || securityTypeDisagrees || (snapshot.report.issuer.cik && deepReport?.issuer?.cik && snapshot.report.issuer.cik !== deepReport.issuer.cik)) throw new ResearchResponseError(RESEARCH_ERROR_CODES.invalid, { stage: "deep", phase: "deep_identity_validation", response_received: true });
    const merged = mergeDeepWithFast(snapshot.report, deepReport);
    const calibratedMerged = calibrateReportScores(merged.report);
    const scoreRevisions = Object.entries(snapshot.report.scores).flatMap(([key, prior]) => {
      const next = calibratedMerged.scores[key];
      return next && (prior.state !== next.state || prior.value !== next.value) ? [{ kind: "score_revision", component: key, fast_state: prior.state, fast_value: prior.value, deep_state: next.state, deep_value: next.value }] : [];
    });
    merged.lineage.revisions.push(...scoreRevisions);
    const mergedValidation = reportValidator(calibratedMerged);
    if (!mergedValidation.valid) throw new ResearchResponseError(RESEARCH_ERROR_CODES.invalid, { stage: "deep", phase: "deep_merge_validation", response_received: true });
    const operations = { ...(deepResult?.operations ?? {}), stage: "deep", latency_ms: Math.round(now() - deepStarted), fast_foundation: { ...handoffBase, status: "extended", unresolved_components_targeted: priorityPlan.components }, evidence_lineage: merged.lineage };
    const fastCost = snapshot.operations?.estimated_cost_usd; const deepCost = deepResult?.operations?.estimated_cost_usd;
    operations.fast_foundation.fast_estimated_cost_usd = Number.isFinite(fastCost) ? fastCost : null;
    operations.fast_foundation.deep_estimated_cost_usd = Number.isFinite(deepCost) ? deepCost : null;
    operations.estimated_cost_usd = Number.isFinite(fastCost) && Number.isFinite(deepCost) ? Number((fastCost + deepCost).toFixed(6)) : null;
    operations.fast_foundation.new_deep_evidence_count = merged.lineage.new_deep_claim_ids.length;
    return { ...deepResult, report: calibratedMerged, operations };
  }

  return {
    getFastSnapshot(ticker) { return completedPackets.get(ticker) ? structuredClone(completedPackets.get(ticker)) : null; },
    async researchTicker(ticker, { stage = "fast", ...options } = {}) {
      if (stage === "deep") return researchDeep(ticker, options);
      return researchFast(ticker, options);
    }
  };
}
