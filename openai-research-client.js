export const RESEARCH_ERROR_CODES = Object.freeze({
  timeout: "UPSTREAM_TIMEOUT",
  rateLimit: "UPSTREAM_RATE_LIMIT",
  authentication: "UPSTREAM_AUTHENTICATION",
  temporary: "UPSTREAM_TEMPORARY_FAILURE",
  refused: "UPSTREAM_REFUSED",
  incomplete: "UPSTREAM_INCOMPLETE",
  invalid: "INVALID_RESEARCH_RESPONSE",
  unusable: "UPSTREAM_UNUSABLE",
  badRequest: "UPSTREAM_BAD_REQUEST",
  unexpected: "UPSTREAM_UNEXPECTED"
});

import { buildResearchOperations, estimateResearchCost, PRICING_SNAPSHOT, RESEARCH_STAGES } from "./lib/research-budget.js";
import { createOpenAIOutputSchema } from "./lib/openai-output-schema.js";
import { assembleFastReport, createFastDomainSchema, fastDomainPrompt, FAST_DOMAINS } from "./lib/fast-research.js";

export const FAST_RESEARCH_TIMEOUT_MS = RESEARCH_STAGES.fast.timeout_ms;

export class ResearchResponseError extends Error {
  constructor(code, diagnostics = {}) {
    super(code);
    this.name = "ResearchResponseError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

const stageInstructions = Object.freeze({
  fast: `Fast-stage constraints:
- use at most four focused web-search calls, combining related checks and preferring primary sources;
- establish current identity/listing and the current 30-day catalyst;
- use SEC and exchange records to check material three-year dilution, five-year reverse splits, compliance, accounting, and going-concern risks together;
- use only the latest relevant financial filing for decision-focused cash, burn, revenue, profitability, free-cash-flow, and debt context;
- defer exhaustive prior-identity discovery, secondary-source corroboration, detailed financial history, and all historical catalyst analogues to Deep; identify every deferred check in coverage limitations;
- do not research or emit historical catalyst analogue items or reaction windows; mark that deep-stage check limited_coverage and name it in coverage limitations;
- include only material claims and the strongest direct source for each claim; reuse claim/source IDs instead of duplicating facts;
- keep every title, summary, explanation, and coverage note concise; and
- return partial or pending rather than expanding research beyond these bounds.`,
  deep: `Deep-stage constraints:
- expand named fast-stage gaps, including up to three reliable issuer-specific catalyst analogues and four reaction windows per analogue;
- include only evidence that changes or supports a material conclusion; reuse claim/source IDs instead of duplicating facts; and
- keep prose concise even when coverage expands.`
});

const researchPrompt = (ticker, stage) => `
Create a ${stage} stock-research report for ticker "${ticker}" as of the current time.
The report metadata stage must be "${stage}". In fast mode, prioritize the required material-risk checks and explicitly mark unfinished or deferred checks partial/pending with structured coverage limitations. In deep mode, deliberately expand those named gaps; never imply that deep research guarantees completeness.

${stageInstructions[stage]}

Populate every section required by the supplied stock-report schema, using
explicit unknown, limited_coverage, or pending states for work that the selected
stage deliberately defers. Research these required evidence domains within the
stage constraints:
- current security and issuer identity, listing context, and known prior identities;
- reverse splits in the last five years;
- major offerings and other material dilution in the last three years, including warrants or convertibles when found;
- current dividend status;
- major exchange-compliance, going-concern, SEC, and accounting warnings in the defined research window;
- decision-focused financial context; and
- the most important catalysts and news from the last 30 days.

For the current material catalyst, classify it and assess recency, specificity,
credibility, novelty, and potential significance separately. Find prior events
from this issuer only in deep mode and only when they are reliably comparable. For each analogue,
state why it is comparable, where the comparison is weak, and any sourced stock
reaction using explicit dates and windows. If no reliable analogue is found,
return an unknown historical-analogue assessment with no invented event or
reaction. Present favorable evidence, unfavorable evidence, uncertainty, and a
qualitative near-term implication with evidence confidence. Avoid numerical
probabilities and do not imply a guaranteed stock reaction.

For financial context, separately report cash, cash burn, revenue,
profitability, free cash flow, and debt, plus going-concern evidence. Preserve
each value's unit and statement period, and use explicit comparison periods for
every claimed trend. Rank material liquidity, debt, cash-burn, profitability,
accounting, and going-concern warnings. Use not_applicable for security types
such as an ETF when issuer operating-company financials do not apply. Use
unknown or limited_coverage with null values when current comparable statements
are unavailable; never turn missing data into a favorable financial conclusion.

Resolve identity before researching history. Confirm the current security type, issuer legal name and CIK when available, listing venue, and listing status from SEC and exchange records. Search official filings for former legal names and exchange records for prior tickers, including renames and rebrands. For each confirmed prior identity, provide both effective_from and effective_to, high or medium linkage confidence, and sourced confirmed linkage claims. Add the relevant lineage claim ID to every reverse split, offering, dilution, compliance, or warning item whose event date falls in that prior-identity period so issuer history follows the issuer rather than only the current ticker. Never carry an event through an unknown or limited-coverage predecessor relationship; keep the issuer and affected history sections unknown or limited_coverage, add a structured issuer coverage limitation, and explain the gap instead.

Prefer SEC filings and official exchange notices, then official company sources, then reputable original reporting. Treat secondary evidence as lower confidence. Never treat missing evidence as proof of absence. Use the schema's explicit evidence states, null score values when evidence is not confirmed, concise explanations, dated claim/source links, and non-advisory wording. Do not give entries, exits, price targets, position sizing, or personalized investment advice.

For every material factual conclusion and every evidence-based score:
- create atomic claims and attach their IDs to the exact report section, item, identity record, or score they support;
- populate each source with a useful document title, direct HTTPS URL, publication or filing date, source type, confidence, retrieval time, and bidirectional supported claim IDs;
- use SEC filings and exchange notices before company sources, original news, or aggregators when available;
- never give secondary evidence high confidence; and
- when evidence is missing, malformed, or materially conflicting, use unknown or limited coverage and do not invent a claim, source, date, URL, or favorable score.

Apply evidence states consistently:
- confirmed means sufficient evidence supports the specific conclusion;
- not_found means a documented, bounded search found no evidence, never that the event is proven absent;
- unknown means evidence is unavailable, inadequate, conflicting, or unresolved;
- not_applicable means the check does not apply to this security or context, with no items, claims, sources, or score value invented for it;
- limited_coverage means some relevant research completed but named gaps prevent a complete conclusion.
Use partial or pending completion with structured coverage limitations when required checks are incomplete. A safe partial report is preferable to guessing. Only confirmed scores may have numbers, and they must not rely on unknown, limited, or inapplicable claims. Keep all wording non-advisory.
Do not emit scores. The server derives every score and component using
deterministic methodology 1.0.0 after receiving the evidence report.
`;

function containsRefusal(output) {
  return Array.isArray(output) && output.some((item) =>
    item?.type === "message" && Array.isArray(item.content) &&
    item.content.some((content) => content?.type === "refusal")
  );
}

function classifyUpstreamError(error) {
  const name = error?.name;
  const constructorName = error?.constructor?.name;
  const causeName = error?.cause?.name;
  const causeConstructorName = error?.cause?.constructor?.name;
  const status = error?.status;

  const types = new Set([name, constructorName, causeName, causeConstructorName]);
  if (types.has("BadRequestError") || status === 400 || status === 422) return RESEARCH_ERROR_CODES.badRequest;
  if (["APITimeoutError", "APIConnectionTimeoutError", "TimeoutError"].some((type) => types.has(type)) || status === 408) return RESEARCH_ERROR_CODES.timeout;
  if (types.has("RateLimitError") || status === 429) return RESEARCH_ERROR_CODES.rateLimit;
  if (types.has("AuthenticationError") || status === 401 || status === 403) return RESEARCH_ERROR_CODES.authentication;
  if (types.has("APIConnectionError") || status === 409 || (status >= 500 && status <= 599)) {
    return RESEARCH_ERROR_CODES.temporary;
  }
  return null;
}

function safeDiagnosticValue(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;
}

export function getSafeUpstreamDiagnostics(error, { stage = null, phase = null, startedAt = null, response = null, now = () => performance.now() } = {}) {
  const usage = response?.usage;
  return {
    stage: safeDiagnosticValue(stage),
    phase: safeDiagnosticValue(phase),
    elapsed_ms: Number.isFinite(startedAt) ? Math.max(0, Math.round(now() - startedAt)) : null,
    error_constructor: safeDiagnosticValue(error?.constructor?.name),
    status: Number.isInteger(error?.status) ? error.status : null,
    provider_code: safeDiagnosticValue(error?.code),
    error_type: safeDiagnosticValue(error?.name),
    cause_constructor: safeDiagnosticValue(error?.cause?.constructor?.name),
    cause_name: safeDiagnosticValue(error?.cause?.name),
    cause_status: Number.isInteger(error?.cause?.status) ? error.cause.status : null,
    cause_code: safeDiagnosticValue(error?.cause?.code),
    response_received: response !== null,
    response_status: safeDiagnosticValue(response?.status),
    incomplete_reason: safeDiagnosticValue(response?.incomplete_details?.reason),
    input_tokens: Number.isFinite(usage?.input_tokens) ? usage.input_tokens : null,
    output_tokens: Number.isFinite(usage?.output_tokens) ? usage.output_tokens : null,
    total_tokens: Number.isFinite(usage?.total_tokens) ? usage.total_tokens : null
  };
}

export function createOpenAIResearchClient(openai, { schema, now = () => performance.now(), enableLegacyFast = false } = {}) {
  if (!openai?.responses || typeof openai.responses.create !== "function") {
    throw new TypeError("A compatible OpenAI client is required");
  }
  if (!schema || typeof schema !== "object") {
    throw new TypeError("The stock-report JSON schema is required");
  }

  async function requestFastDomain(ticker, domain, startedAt) {
    const domainStartedAt = now();
    const config = FAST_DOMAINS[domain];
    let response;
    try {
      response = await openai.responses.create({
        model: "gpt-5.1",
        reasoning: { effort: "none" },
        max_output_tokens: config.max_output_tokens,
        max_tool_calls: config.max_tool_calls,
        tools: [{ type: "web_search", search_context_size: "low" }],
        include: ["web_search_call.action.sources"],
        text: { format: { type: "json_schema", name: `fast_${domain}_evidence`, description: `Compact ${domain} evidence for server-side Fast report assembly.`, schema: createFastDomainSchema(schema, domain), strict: false } },
        input: fastDomainPrompt(ticker, domain)
      }, { timeout: RESEARCH_STAGES.fast.timeout_ms, maxRetries: 0 });
    } catch (error) {
      return { domain, fragment: null, elapsed_ms: Math.max(0, Math.round(now() - domainStartedAt)), error_code: classifyUpstreamError(error) ?? RESEARCH_ERROR_CODES.unexpected, diagnostics: getSafeUpstreamDiagnostics(error, { stage: "fast", phase: `fast_${domain}_request`, startedAt, response: null, now }) };
    }
    const elapsed_ms = Math.max(0, Math.round(now() - domainStartedAt));
    try {
      if (!["completed", "incomplete"].includes(response.status) || typeof response.output_text !== "string" || !response.output_text.trim()) throw new Error("Unusable domain response");
      const fragment = JSON.parse(response.output_text);
      if (fragment.domain !== domain || fragment.identity?.ticker !== ticker) throw new Error("Domain identity boundary failed");
      const webSearchCalls = Array.isArray(response.output) ? response.output.filter((item) => item?.type === "web_search_call").length : 0;
      return { domain, fragment, elapsed_ms, error_code: null, usage: response.usage ?? null, web_search_calls: webSearchCalls, response_status: response.status };
    } catch (error) {
      const webSearchCalls = Array.isArray(response.output) ? response.output.filter((item) => item?.type === "web_search_call").length : 0;
      return { domain, fragment: null, elapsed_ms, error_code: response.status === "incomplete" ? RESEARCH_ERROR_CODES.incomplete : RESEARCH_ERROR_CODES.invalid, usage: response.usage ?? null, web_search_calls: webSearchCalls, response_status: response.status, diagnostics: getSafeUpstreamDiagnostics(error, { stage: "fast", phase: `fast_${domain}_parse`, startedAt, response, now }) };
    }
  }

  async function researchFast(ticker, { onProgress } = {}) {
    const startedAt = now();
    const results = {};
    let firstUsefulLatencyMs = null;
    const publish = async (result) => {
      results[result.domain] = result;
      if (result.fragment && firstUsefulLatencyMs === null) firstUsefulLatencyMs = Math.max(0, now() - startedAt);
      if (typeof onProgress === "function" && result.fragment) {
        const report = assembleFastReport(ticker, results);
        await onProgress({ report, operations: fastOperations(results, startedAt, firstUsefulLatencyMs), final: Object.keys(results).length === Object.keys(FAST_DOMAINS).length });
      }
      return result;
    };
    await Promise.all(Object.keys(FAST_DOMAINS).map((domain) => requestFastDomain(ticker, domain, startedAt).then(publish)));
    return {
      report: assembleFastReport(ticker, results),
      operations: fastOperations(results, startedAt, firstUsefulLatencyMs),
      diagnostics: Object.values(results).filter((result) => result.diagnostics).map((result) => result.diagnostics)
    };
  }

  function fastOperations(results, startedAt, firstUsefulLatencyMs) {
    const values = Object.values(results);
    const usageValues = values.map((result) => result.usage).filter(Boolean);
    const usage = usageValues.length ? {
      input_tokens: usageValues.reduce((sum, item) => sum + (item.input_tokens || 0), 0),
      output_tokens: usageValues.reduce((sum, item) => sum + (item.output_tokens || 0), 0),
      total_tokens: usageValues.reduce((sum, item) => sum + (item.total_tokens || 0), 0)
    } : null;
    const domains = Object.fromEntries(Object.keys(FAST_DOMAINS).map((domain) => {
      const result = results[domain];
      return [domain, result ? {
        status: result.fragment ? "completed" : "pending", latency_ms: result.elapsed_ms, error_code: result.error_code,
        input_tokens: result.usage?.input_tokens ?? null, output_tokens: result.usage?.output_tokens ?? null, total_tokens: result.usage?.total_tokens ?? null,
        web_search_calls: result.web_search_calls ?? 0, estimated_cost_usd: estimateResearchCost(result.usage, result.web_search_calls ?? 0), pricing_version: result.usage ? PRICING_SNAPSHOT.version : null
      } : { status: "pending", latency_ms: null, error_code: null, input_tokens: null, output_tokens: null, total_tokens: null, web_search_calls: 0, estimated_cost_usd: null, pricing_version: null }];
    }));
    return buildResearchOperations({ stage: "fast", latencyMs: now() - startedAt, firstUsefulLatencyMs, usage, webSearchCalls: values.reduce((sum, result) => sum + (result.web_search_calls || 0), 0), domains });
  }

  return {
    async researchTicker(ticker, { stage = "fast", onProgress, seedEvidence = null } = {}) {
      const budget = RESEARCH_STAGES[stage];
      if (!budget) throw new TypeError(`Unsupported research stage: ${stage}`);
      if (stage === "fast") {
        if (!enableLegacyFast) throw new TypeError("Hosted-web-search Fast is disabled; use the evidence-first client");
        return researchFast(ticker, { onProgress });
      }
      const startedAt = now();
      let outputSchema;
      try {
        outputSchema = createOpenAIOutputSchema(schema, { stage });
      } catch (error) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unexpected, getSafeUpstreamDiagnostics(error, { stage, phase: "request_preparation", startedAt, response: null, now }));
      }
      let response;
      try {
        response = await openai.responses.create({
          model: "gpt-5.1",
          reasoning: { effort: "none" },
          max_output_tokens: budget.max_output_tokens,
          max_tool_calls: budget.max_tool_calls,
          tools: [{ type: "web_search", search_context_size: budget.search_context_size }],
          include: ["web_search_call.action.sources"],
          text: {
            format: {
              type: "json_schema",
              name: "stock_report_v4",
              description: "A version 4.0.0 evidence-backed stock research report; server-side scoring replaces provider score values.",
              schema: outputSchema,
              strict: false
            }
          },
          input: `${researchPrompt(ticker, stage)}${seedEvidence ? `\nFast evidence already collected by the server follows. Use it as authoritative seed evidence, cite its source URLs, and search only to expand named gaps or conflicts rather than repeating completed retrieval.\n${JSON.stringify(seedEvidence)}` : ""}`
        }, {
          timeout: budget.timeout_ms,
          maxRetries: 0
        });
      } catch (error) {
        const code = classifyUpstreamError(error);
        const diagnostics = getSafeUpstreamDiagnostics(error, { stage, phase: "openai_request", startedAt, response: null, now });
        if (code) throw new ResearchResponseError(code, diagnostics);
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unexpected, diagnostics);
      }

      let responseOutput;
      try {
        responseOutput = response.output;
      } catch (error) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable, getSafeUpstreamDiagnostics(error, { stage, phase: "response_output_read", startedAt, response, now }));
      }
      if (containsRefusal(responseOutput)) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.refused, getSafeUpstreamDiagnostics(null, { stage, phase: "response_inspection", startedAt, response, now }));
      }
      const upstreamIncomplete = response.status === "incomplete";
      if (response.status !== "completed" && !upstreamIncomplete) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable, getSafeUpstreamDiagnostics(null, { stage, phase: "response_status", startedAt, response, now }));
      }
      let outputText;
      try {
        outputText = response.output_text;
      } catch (error) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable, getSafeUpstreamDiagnostics(error, { stage, phase: "output_text_read", startedAt, response, now }));
      }
      if (typeof outputText !== "string" || outputText.trim() === "") {
        throw new ResearchResponseError(
          upstreamIncomplete ? RESEARCH_ERROR_CODES.incomplete : RESEARCH_ERROR_CODES.unusable,
          getSafeUpstreamDiagnostics(null, { stage, phase: upstreamIncomplete ? "incomplete_response" : "output_text_read", startedAt, response, now })
        );
      }

      let report;
      try {
        report = JSON.parse(outputText);
      } catch (error) {
        throw new ResearchResponseError(upstreamIncomplete ? RESEARCH_ERROR_CODES.incomplete : RESEARCH_ERROR_CODES.invalid, getSafeUpstreamDiagnostics(error, { stage, phase: "json_parse", startedAt, response, now }));
      }
      if (report?.metadata?.stage !== stage) throw new ResearchResponseError(RESEARCH_ERROR_CODES.invalid, getSafeUpstreamDiagnostics(null, { stage, phase: "report_conversion", startedAt, response, now }));
      if (upstreamIncomplete && !["partial", "pending"].includes(report?.metadata?.completion_status)) throw new ResearchResponseError(RESEARCH_ERROR_CODES.incomplete, getSafeUpstreamDiagnostics(null, { stage, phase: "incomplete_response", startedAt, response, now }));
      try {
        const webSearchCalls = Array.isArray(responseOutput) ? responseOutput.filter((item) => item?.type === "web_search_call").length : 0;
        return { report, operations: buildResearchOperations({ stage, latencyMs: now() - startedAt, usage: response.usage, webSearchCalls }) };
      } catch (error) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable, getSafeUpstreamDiagnostics(error, { stage, phase: "operations_measurement", startedAt, response, now }));
      }
    }
  };
}
