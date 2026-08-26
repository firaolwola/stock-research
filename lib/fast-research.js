import { projectOpenAISchema } from "./openai-output-schema.js";

export const FAST_DOMAINS = Object.freeze({
  capital: Object.freeze({ max_output_tokens: 1_200, max_tool_calls: 2 }),
  catalyst: Object.freeze({ max_output_tokens: 1_000, max_tool_calls: 1 }),
  financial: Object.freeze({ max_output_tokens: 1_200, max_tool_calls: 2 })
});

const domainProperties = Object.freeze({
  capital: Object.freeze({ reverse_splits: "reportSection", dilution: "reportSection" }),
  catalyst: Object.freeze({ compliance_and_warnings: "reportSection", catalysts_and_news: "reportSection", catalyst_assessment: "catalystAssessment" }),
  financial: Object.freeze({ dividends: "reportSection", financial_context: "reportSection", financial_assessment: "financialAssessment" })
});

function pruneDefinitions(schema) {
  const referenced = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/$defs/")) referenced.add(value.$ref.slice(8));
    for (const [key, child] of Object.entries(value)) if (key !== "$defs") visit(child);
  };
  visit(schema);
  const defs = {};
  const pending = [...referenced];
  while (pending.length) {
    const name = pending.pop();
    if (defs[name] || !schema.$defs[name]) continue;
    defs[name] = schema.$defs[name];
    const before = new Set(referenced);
    visit(defs[name]);
    for (const dependency of referenced) if (!before.has(dependency)) pending.push(dependency);
  }
  schema.$defs = defs;
  return schema;
}

export function createFastDomainSchema(schema, domain) {
  if (!FAST_DOMAINS[domain]) throw new TypeError(`Unsupported Fast domain: ${domain}`);
  const properties = {
    domain: { const: domain },
    security: { $ref: "#/$defs/security" },
    issuer: { $ref: "#/$defs/issuer" },
    ...Object.fromEntries(Object.entries(domainProperties[domain]).map(([key, definition]) => [key, { $ref: `#/$defs/${definition}` }])),
    claims: { type: "array", maxItems: 12, items: { $ref: "#/$defs/claim" }, uniqueItems: true },
    sources: { type: "array", maxItems: 6, items: { $ref: "#/$defs/source" }, uniqueItems: true }
  };
  const projected = projectOpenAISchema({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    $defs: structuredClone(schema.$defs)
  });
  if (domain === "catalyst") {
    projected.$defs.catalystAssessment.properties.historical_analogues = {
      type: "object", additionalProperties: false,
      required: ["state", "summary", "coverage_notes", "items", "claim_ids"],
      properties: {
        state: { enum: ["unknown", "limited_coverage", "not_applicable"] },
        summary: { $ref: "#/$defs/nonEmptyString" },
        coverage_notes: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } },
        items: { type: "array", maxItems: 0 },
        claim_ids: { $ref: "#/$defs/claimIds" }
      }
    };
  }
  const output = pruneDefinitions(projected);
  output.$defs.nonEmptyString.maxLength = 240;
  output.$defs.issuer.properties.prior_identities.maxItems = domain === "capital" ? 3 : 0;
  output.$defs.reportSection.properties.items.maxItems = 4;
  if (output.$defs.financialAssessment) output.$defs.financialAssessment.properties.material_warnings.maxItems = 4;
  if (output.$defs.historicalAnalogueAssessment) output.$defs.historicalAnalogueAssessment.properties.items.maxItems = 0;
  if (output.$defs.historicalAnalogue) output.$defs.historicalAnalogue.properties.reaction_windows.maxItems = 0;
  return output;
}

const sharedPrompt = (ticker, domain) => `
Return only the compact ${domain} Fast evidence fragment for ticker "${ticker}".
Confirm current ticker, security type, issuer legal name, and ten-digit SEC CIK when available in every fragment. Identity must be based on primary evidence; use unknown rather than guessing. Prefix claim/source/item IDs with the domain name.
Prefer SEC filings and exchange notices, then official company sources. Include only material facts and the strongest direct source for each. Keep prose terse. Missing evidence is unknown or limited_coverage, never favorable or proof of absence. Keep wording non-advisory.
`;

export function fastDomainPrompt(ticker, domain) {
  const instructions = {
    capital: `Check five-year reverse-split history and three-year material offerings, dilution, warrants, and convertibles. Resolve only lineage necessary to avoid a false clean history; defer exhaustive lineage discovery.`,
    catalyst: `Check the most material catalyst in the last 30 days plus current listing status, exchange compliance, and major recent SEC/accounting warnings. Assess catalyst factors and qualitative implication. Historical analogues and reaction windows are Deep-only and must be unknown/limited with no items.`,
    financial: `Use the latest relevant primary filing for immediate material risk: cash, burn, revenue, profitability, free cash flow, debt, going concern, accounting warnings, and current dividend applicability/status. Detailed multi-period history is Deep-only.`
  };
  return `${sharedPrompt(ticker, domain)}\n${instructions[domain]}`;
}

const unknownSection = (summary) => ({ state: "unknown", summary, coverage_notes: ["This Fast domain did not complete."], items: [], claim_ids: [] });
const unknownMetric = (label) => ({ state: "unknown", label, value: null, unit: null, period_start: null, period_end: null, trend: "unknown", comparison_period_start: null, comparison_period_end: null, summary: `${label} was not established by completed Fast evidence.`, claim_ids: [] });
const unknownFinancial = () => ({
  state: "unknown", as_of: null, reporting_currency: null, summary: "Immediate financial-risk research is pending.", coverage_notes: ["The financial Fast domain did not complete."],
  metrics: Object.fromEntries(["cash", "cash_burn", "revenue", "profitability", "free_cash_flow", "debt"].map((key) => [key, unknownMetric(key.replaceAll("_", " "))])),
  going_concern: { state: "unknown", as_of: null, summary: "Going-concern evidence is pending.", claim_ids: [] }, material_warnings: []
});
const unknownFactor = (label) => ({ rating: "unknown", explanation: `${label} is pending completed catalyst evidence.`, claim_ids: [] });
const unknownCatalyst = () => ({
  current: { state: "unknown", classification: "unknown", title: "Current catalyst pending", event_date: null, summary: "The catalyst Fast domain did not complete.", confidence: "unknown", claim_ids: [], factors: Object.fromEntries(["recency", "specificity", "credibility", "novelty", "potential_significance"].map((key) => [key, unknownFactor(key.replaceAll("_", " "))])) },
  historical_analogues: { state: "limited_coverage", summary: "Historical catalyst analogues are deferred to Deep.", coverage_notes: ["Fast does not research reaction analogues."], items: [], claim_ids: [] },
  favorable_evidence_claim_ids: [], unfavorable_evidence_claim_ids: [], uncertainty: ["Current catalyst evidence is pending."],
  near_term_implication: { state: "unknown", direction: "unknown", summary: "No near-term implication is inferred without completed catalyst evidence.", confidence: "unknown", claim_ids: [] }
});

function identitySignature(fragment) {
  const clean = (value) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parts = [clean(fragment.security?.ticker), clean(fragment.issuer?.legal_name), clean(fragment.issuer?.cik)];
  return parts.every(Boolean) ? parts.join("|") : null;
}

function mergeUnique(items, key) {
  const merged = new Map();
  for (const item of items.flat()) {
    const previous = merged.get(item[key]);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new Error(`Conflicting ${key}`);
    merged.set(item[key], item);
  }
  return [...merged.values()];
}

export function assembleFastReport(ticker, domainResults, { generatedAt = new Date().toISOString() } = {}) {
  const completed = Object.entries(domainResults).filter(([, result]) => result?.fragment).map(([domain, result]) => ({ domain, ...result }));
  const signatures = new Set(completed.map(({ fragment }) => identitySignature(fragment)));
  const identityAgrees = signatures.size <= 1 && !signatures.has(null);
  const usable = identityAgrees ? completed : [];
  const byDomain = Object.fromEntries(usable.map((entry) => [entry.domain, entry.fragment]));
  const identity = usable[0]?.fragment;
  const limitations = [];
  for (const domain of Object.keys(FAST_DOMAINS)) {
    if (!byDomain[domain]) limitations.push({ code: `fast-${domain}-${identityAgrees ? "pending" : "identity-mismatch"}`, explanation: identityAgrees ? `The ${domain} Fast domain did not complete and remains pending.` : "Domain evidence was not merged because issuer/security identity did not agree.", affected_sections: domain === "capital" ? ["issuer", "reverse_splits", "dilution"] : domain === "catalyst" ? ["compliance_and_warnings", "catalysts_and_news", "catalyst_assessment"] : ["dividends", "financial_context", "financial_assessment"] });
  }
  limitations.push({ code: "fast-deep-enrichment-deferred", explanation: "Exhaustive lineage, detailed financial history, secondary corroboration, catalyst analogues, reaction windows, and conflict resolution are deferred to Deep.", affected_sections: ["issuer", "financial_context", "catalyst_assessment"] });
  let claims = [];
  let sources = [];
  try {
    claims = mergeUnique(usable.map(({ fragment }) => fragment.claims || []), "id");
    sources = mergeUnique(usable.map(({ fragment }) => fragment.sources || []), "id");
  } catch {
    return assembleFastReport(ticker, {}, { generatedAt });
  }
  const day = generatedAt.slice(0, 10);
  const capital = byDomain.capital;
  const catalyst = byDomain.catalyst;
  const financial = byDomain.financial;
  return {
    schema_version: "4.0.0",
    report_id: `fast-${ticker}-${generatedAt}`,
    metadata: { as_of: generatedAt, generated_at: generatedAt, stage: "fast", completion_status: usable.length === 3 ? "partial" : "pending", research_windows: [{ topic: "fast_material_risk", start: `${Number(day.slice(0, 4)) - 5}${day.slice(4)}`, end: day }], coverage_limitations: limitations },
    security: identity?.security ?? { ticker, name: `${ticker} security identity pending`, security_type: "unknown", listing_venue: "Unknown", listing_status: "unknown", evidence_state: "unknown", claim_ids: [] },
    issuer: capital?.issuer ?? identity?.issuer ?? { legal_name: "Issuer identity pending", cik: null, identity_state: "unknown", identity_confidence: "unknown", prior_identities: [], claim_ids: [] },
    sections: {
      reverse_splits: capital?.reverse_splits ?? unknownSection("Reverse-split research is pending."),
      dilution: capital?.dilution ?? unknownSection("Dilution and offering research is pending."),
      dividends: financial?.dividends ?? unknownSection("Dividend applicability and status are pending."),
      compliance_and_warnings: catalyst?.compliance_and_warnings ?? unknownSection("Compliance and accounting-warning research is pending."),
      financial_context: financial?.financial_context ?? unknownSection("Immediate financial-risk context is pending."),
      catalysts_and_news: catalyst?.catalysts_and_news ?? unknownSection("Current catalyst research is pending.")
    },
    financial_assessment: financial?.financial_assessment ?? unknownFinancial(),
    catalyst_assessment: catalyst?.catalyst_assessment ?? unknownCatalyst(),
    claims,
    sources
  };
}
