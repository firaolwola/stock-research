export const RESEARCH_ERROR_CODES = Object.freeze({
  timeout: "UPSTREAM_TIMEOUT",
  rateLimit: "UPSTREAM_RATE_LIMIT",
  authentication: "UPSTREAM_AUTHENTICATION",
  temporary: "UPSTREAM_TEMPORARY_FAILURE",
  refused: "UPSTREAM_REFUSED",
  incomplete: "UPSTREAM_INCOMPLETE",
  invalid: "INVALID_RESEARCH_RESPONSE",
  unusable: "UPSTREAM_UNUSABLE"
});

export const FAST_RESEARCH_TIMEOUT_MS = 15_000;

export class ResearchResponseError extends Error {
  constructor(code) {
    super(code);
    this.name = "ResearchResponseError";
    this.code = code;
  }
}

const researchPrompt = (ticker) => `
Create a fast stock-research report for ticker "${ticker}" as of the current time.

Research every section required by the supplied stock-report schema:
- current security and issuer identity, listing context, and known prior identities;
- reverse splits in the last five years;
- major offerings and other material dilution in the last three years, including warrants or convertibles when found;
- current dividend status;
- major exchange-compliance, going-concern, SEC, and accounting warnings in the defined research window;
- decision-focused financial context; and
- the most important catalysts and news from the last 30 days.

Prefer SEC filings and official exchange notices, then official company sources, then reputable original reporting. Treat secondary evidence as lower confidence. Never treat missing evidence as proof of absence. Use the schema's explicit evidence states, null score values when evidence is not confirmed, concise explanations, dated claim/source links, and non-advisory wording. Do not give entries, exits, price targets, position sizing, or personalized investment advice.

For every material factual conclusion and every evidence-based score:
- create atomic claims and attach their IDs to the exact report section, item, identity record, or score they support;
- populate each source with a useful document title, direct HTTPS URL, publication or filing date, source type, confidence, retrieval time, and bidirectional supported claim IDs;
- use SEC filings and exchange notices before company sources, original news, or aggregators when available;
- never give secondary evidence high confidence; and
- when evidence is missing, malformed, or materially conflicting, use unknown or limited coverage and do not invent a claim, source, date, URL, or favorable score.
`;

function containsRefusal(output) {
  return Array.isArray(output) && output.some((item) =>
    item?.type === "message" && Array.isArray(item.content) &&
    item.content.some((content) => content?.type === "refusal")
  );
}

function classifyUpstreamError(error) {
  const name = error?.name;
  const status = error?.status;

  if (name === "APITimeoutError" || status === 408) return RESEARCH_ERROR_CODES.timeout;
  if (name === "RateLimitError" || status === 429) return RESEARCH_ERROR_CODES.rateLimit;
  if (name === "AuthenticationError" || status === 401 || status === 403) return RESEARCH_ERROR_CODES.authentication;
  if (name === "APIConnectionError" || status === 409 || (status >= 500 && status <= 599)) {
    return RESEARCH_ERROR_CODES.temporary;
  }
  return null;
}

export function createOpenAIResearchClient(openai, { schema } = {}) {
  if (!openai?.responses || typeof openai.responses.create !== "function") {
    throw new TypeError("A compatible OpenAI client is required");
  }
  if (!schema || typeof schema !== "object") {
    throw new TypeError("The stock-report JSON schema is required");
  }

  return {
    async researchTicker(ticker) {
      let response;
      try {
        response = await openai.responses.create({
          model: "gpt-5.1",
          reasoning: { effort: "none" },
          max_output_tokens: 5000,
          tools: [{ type: "web_search" }],
          include: ["web_search_call.action.sources"],
          text: {
            format: {
              type: "json_schema",
              name: "stock_report_v1",
              description: "A version 1.0.0 evidence-backed stock research report.",
              schema,
              strict: false
            }
          },
          input: researchPrompt(ticker)
        }, {
          timeout: FAST_RESEARCH_TIMEOUT_MS,
          maxRetries: 0
        });
      } catch (error) {
        const code = classifyUpstreamError(error);
        if (code) throw new ResearchResponseError(code);
        throw error;
      }

      if (containsRefusal(response.output)) {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.refused);
      }
      if (response.status === "incomplete") {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.incomplete);
      }
      if (response.status !== "completed") {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable);
      }
      if (typeof response.output_text !== "string" || response.output_text.trim() === "") {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.unusable);
      }

      try {
        return JSON.parse(response.output_text);
      } catch {
        throw new ResearchResponseError(RESEARCH_ERROR_CODES.invalid);
      }
    }
  };
}
