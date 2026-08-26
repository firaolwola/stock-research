import { assembleFastReport, FAST_DOMAINS } from "./fast-research.js";
import { buildResearchOperations } from "./research-budget.js";

const SEC_BASE = "https://data.sec.gov";
const TICKER_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const DEFAULT_USER_AGENT = "StockResearch/1.0 github.com/firaolwola/stock-research";
const CACHE_TTL_MS = Object.freeze({ tickers: 6 * 60 * 60 * 1000, issuer: 5 * 60 * 1000 });
const OFFERING_FORMS = /^(S-1|S-3|F-1|F-3|424B|POS AM)/;
const CATALYST_FORMS = new Set(["8-K", "6-K"]);

class SecRetrievalError extends Error {
  constructor(message, details, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "SecRetrievalError";
    Object.assign(this, details);
  }
}

const safeValue = (value) => typeof value === "string" || typeof value === "number" ? value : null;

export function getSafeSecDiagnostics(error, fallback = {}) {
  const primary = error instanceof SecRetrievalError && error.cause ? error.cause : error;
  const nested = primary?.cause;
  return {
    phase: error?.phase ?? fallback.phase ?? "sec_request",
    endpoint_category: error?.endpointCategory ?? fallback.endpointCategory ?? "unknown",
    elapsed_ms: safeValue(error?.elapsedMs) ?? safeValue(fallback.elapsedMs),
    status: safeValue(error?.status),
    constructor: primary?.constructor?.name ?? null,
    name: primary?.name ?? null,
    code: safeValue(primary?.code),
    cause_constructor: nested?.constructor?.name ?? null,
    cause_name: nested?.name ?? null,
    cause_code: safeValue(nested?.code),
    response_received: error?.responseReceived === true,
    cache_state: error?.cacheState ?? fallback.cacheState ?? "miss",
    request_count: safeValue(error?.requestCount) ?? safeValue(fallback.requestCount) ?? 0
  };
}

const unknownSection = (summary, note) => ({ state: "limited_coverage", summary, coverage_notes: [note], items: [], claim_ids: [] });
const unknownMetric = (label) => ({ state: "unknown", label, value: null, unit: null, period_start: null, period_end: null, trend: "unknown", comparison_period_start: null, comparison_period_end: null, summary: `${label} was not established by the available SEC Company Facts.`, claim_ids: [] });
const factor = (label) => ({ rating: "unknown", explanation: `${label} requires synthesis or broader research.`, claim_ids: [] });
const normalizeSecDate = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 10) : null;

function accessionUrl(cik, accession, document) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${document}`;
}

function filingRows(submissions) {
  const recent = submissions?.filings?.recent ?? {};
  return (recent.accessionNumber ?? []).map((accession, index) => ({
    accession, form: recent.form?.[index], filed: recent.filingDate?.[index], reportDate: recent.reportDate?.[index] || null,
    document: recent.primaryDocument?.[index], items: recent.items?.[index] || ""
  })).filter((row) => row.accession && row.form && row.filed && row.document);
}

function sourceForFiling(row, cik, claimIds, retrievedAt) {
  return { id: `source-sec-${row.accession.replaceAll("-", "")}`, title: `${row.form} filed ${row.filed}`, url: accessionUrl(cik, row.accession, row.document), published_date: row.filed, source_type: "sec_filing", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: claimIds };
}

function evidenceRecord({ id, category, state = "confirmed", date, text, sourceId, cik, ticker }) {
  return { id, category, state, event_date: date, text, source_id: sourceId, issuer_cik: cik, security_ticker: ticker, confidence: state === "confirmed" ? "high" : "medium" };
}

function latestFact(companyFacts, tags) {
  for (const [taxonomy, tag, label] of tags) {
    const concept = companyFacts?.facts?.[taxonomy]?.[tag];
    if (!concept) continue;
    for (const [unit, facts] of Object.entries(concept.units ?? {})) {
      const usable = facts.filter((fact) => Number.isFinite(fact.val) && fact.filed && fact.end && fact.accn).sort((a, b) => `${b.filed}:${b.end}`.localeCompare(`${a.filed}:${a.end}`));
      if (usable[0]) return { ...usable[0], unit, label: concept.label || label };
    }
  }
  return null;
}

function identityFragment(ticker, match, submissions, retrievedAt, records) {
  const cik = String(match.cik).padStart(10, "0");
  const claimId = "claim-sec-identity";
  const sourceId = "source-sec-ticker-map";
  const lineageClaims = [];
  const priorIdentities = (submissions.formerNames ?? []).map((item) => ({ ...item, from: normalizeSecDate(item.from), to: normalizeSecDate(item.to) })).filter((item) => item.name && item.from && item.to).slice(0, 3).map((item, index) => {
    const id = `claim-sec-lineage-${index + 1}`; const text = `SEC submissions metadata identifies ${item.name} as a former name of CIK ${cik} from ${item.from} through ${item.to}.`;
    lineageClaims.push({ id, text, materiality: "medium", state: "confirmed", as_of: retrievedAt, source_ids: ["source-sec-submissions"] });
    records.push(evidenceRecord({ id: `evidence-sec-lineage-${index + 1}`, category: "issuer_lineage", date: item.to, text, sourceId: "source-sec-submissions", cik, ticker }));
    return { name: item.name, ticker: null, effective_from: item.from, effective_to: item.to, linkage_state: "confirmed", linkage_confidence: "high", claim_ids: [id] };
  });
  records.push(evidenceRecord({ id: "evidence-sec-identity", category: "security_and_listing", date: retrievedAt.slice(0, 10), text: `SEC associates ${ticker} with ${submissions.name || match.name} (CIK ${cik}) on ${match.exchange || "an exchange not identified in the map"}.`, sourceId, cik, ticker }));
  return {
    domain: "capital", identity: { ticker, issuer_legal_name: submissions.name || match.name, cik },
    security: { ticker, name: submissions.name || match.name, security_type: "unknown", listing_venue: match.exchange || "Unknown", listing_status: "unknown", evidence_state: "confirmed", claim_ids: [claimId] },
    issuer: { legal_name: submissions.name || match.name, cik, identity_state: "confirmed", identity_confidence: "high", prior_identities: priorIdentities, claim_ids: [claimId, ...lineageClaims.map((claim) => claim.id)] },
    reverse_splits: unknownSection("SEC filing discovery completed, but split terms were not extracted in this bounded phase.", "Filing-text and exchange corporate-action parsing remain deferred."),
    dilution: unknownSection("SEC filing discovery is still pending.", "Potential financing forms have not yet been classified."),
    claims: [{ id: claimId, text: records.find((item) => item.id === "evidence-sec-identity").text, materiality: "high", state: "confirmed", as_of: retrievedAt, source_ids: [sourceId] }, ...lineageClaims],
    sources: [
      { id: sourceId, title: "SEC ticker, CIK, and exchange associations", url: TICKER_URL, published_date: retrievedAt.slice(0, 10), source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId] },
      ...(lineageClaims.length ? [{ id: "source-sec-submissions", title: "SEC submissions metadata", url: `${SEC_BASE}/submissions/CIK${cik}.json`, published_date: retrievedAt.slice(0, 10), source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: lineageClaims.map((claim) => claim.id) }] : [])
    ]
  };
}

function capitalFromFilings(base, rows, retrievedAt, records) {
  const cutoff = new Date(retrievedAt); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
  const candidates = rows.filter((row) => OFFERING_FORMS.test(row.form) && new Date(row.filed) >= cutoff).slice(0, 4);
  const claims = [...base.claims]; const sources = [...base.sources]; const items = [];
  for (const row of candidates) {
    const id = `claim-capital-${row.accession.replaceAll("-", "")}`; const sourceId = `source-sec-${row.accession.replaceAll("-", "")}`;
    const text = `${base.issuer.legal_name} filed Form ${row.form} on ${row.filed}; this filing is a financing candidate requiring document-level review.`;
    claims.push({ id, text, materiality: "medium", state: "limited_coverage", as_of: `${row.filed}T00:00:00Z`, source_ids: [sourceId] });
    sources.push(sourceForFiling(row, base.issuer.cik, [id], retrievedAt));
    items.push({ id: `capital-${row.accession}`, kind: "offering", title: `Form ${row.form} financing candidate`, state: "limited_coverage", summary: text, event_date: row.filed, claim_ids: [id] });
    records.push(evidenceRecord({ id: `evidence-capital-${row.accession}`, category: "dilution_offerings", state: "limited_coverage", date: row.filed, text, sourceId, cik: base.issuer.cik, ticker: base.security.ticker }));
  }
  return { ...base, dilution: { state: "limited_coverage", summary: candidates.length ? "Recent SEC financing-form candidates were found; issuance terms remain unclassified." : "No conclusion is drawn from filing metadata alone.", coverage_notes: ["Document-level offering, warrant, and convertible extraction is deferred."], items, claim_ids: items.flatMap((item) => item.claim_ids) }, claims, sources };
}

function catalystFragment(identity, rows, retrievedAt, records) {
  const cutoff = new Date(retrievedAt); cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const candidates = rows.filter((row) => CATALYST_FORMS.has(row.form) && new Date(row.filed) >= cutoff).slice(0, 3);
  const claims = []; const sources = [];
  for (const row of candidates) {
    const id = `claim-catalyst-${row.accession.replaceAll("-", "")}`; const sourceId = `source-sec-${row.accession.replaceAll("-", "")}`;
    const text = `${identity.issuer_legal_name} filed Form ${row.form} on ${row.filed}; filing metadata alone does not establish the catalyst's substance.`;
    claims.push({ id, text, materiality: "medium", state: "limited_coverage", as_of: `${row.filed}T00:00:00Z`, source_ids: [sourceId] }); sources.push(sourceForFiling(row, identity.cik, [id], retrievedAt));
    records.push(evidenceRecord({ id: `evidence-catalyst-${row.accession}`, category: "catalysts_news", state: "limited_coverage", date: row.filed, text, sourceId, cik: identity.cik, ticker: identity.ticker }));
  }
  const current = candidates[0]; const currentClaim = claims[0]?.id ? [claims[0].id] : [];
  return { domain: "catalyst", identity,
    compliance_and_warnings: unknownSection("SEC filing metadata does not safely establish current compliance or accounting warnings.", "Item-level filing extraction and exchange lists remain deferred."),
    catalyst_assessment: {
      current: { state: "limited_coverage", classification: "unknown", title: current ? `Recent Form ${current.form} filing` : "Current catalyst not established", event_date: current?.filed ?? null, summary: current ? claims[0].text : "No current catalyst can be established from SEC filing metadata alone.", confidence: "unknown", claim_ids: currentClaim, factors: Object.fromEntries(["recency", "specificity", "credibility", "novelty", "potential_significance"].map((key) => [key, factor(key.replaceAll("_", " "))])) },
      favorable_evidence_claim_ids: [], unfavorable_evidence_claim_ids: [], uncertainty: ["Filing contents and non-SEC news were not retrieved in this bounded phase."], near_term_implication: { state: "unknown", direction: "unknown", summary: "No near-term implication is inferred from filing metadata.", confidence: "unknown", claim_ids: [] }
    }, claims, sources };
}

function financialFragment(identity, companyFacts, retrievedAt, records) {
  const definitions = {
    cash: [["us-gaap", "CashAndCashEquivalentsAtCarryingValue", "Cash"], ["ifrs-full", "CashAndCashEquivalents", "Cash"]],
    revenue: [["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenue"], ["ifrs-full", "Revenue", "Revenue"]],
    profitability: [["us-gaap", "NetIncomeLoss", "Net income or loss"], ["ifrs-full", "ProfitLoss", "Profit or loss"]],
    free_cash_flow: [["us-gaap", "NetCashProvidedByUsedInOperatingActivities", "Operating cash flow"]],
    debt: [["us-gaap", "LongTermDebtCurrent", "Current long-term debt"], ["us-gaap", "LongTermDebtNoncurrent", "Long-term debt"]]
  };
  const claims = []; const metrics = {}; const sources = [];
  for (const key of ["cash", "cash_burn", "revenue", "profitability", "free_cash_flow", "debt"]) {
    const fact = definitions[key] ? latestFact(companyFacts, definitions[key]) : null;
    if (!fact) { metrics[key] = unknownMetric(key.replaceAll("_", " ")); continue; }
    const claimId = `claim-financial-${key}`; const sourceId = `source-sec-companyfacts-${key}`;
    const text = `SEC Company Facts reports ${fact.label} of ${fact.val} ${fact.unit} for the period ending ${fact.end}, filed ${fact.filed}.`;
    claims.push({ id: claimId, text, materiality: key === "cash" || key === "debt" ? "high" : "medium", state: "confirmed", as_of: `${fact.filed}T00:00:00Z`, source_ids: [sourceId] });
    sources.push({ id: sourceId, title: `SEC Company Facts — ${fact.label}`, url: `${SEC_BASE}/api/xbrl/companyfacts/CIK${identity.cik}.json`, published_date: fact.filed, source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId] });
    metrics[key] = { state: "confirmed", label: fact.label, value: fact.val, unit: fact.unit, period_start: fact.start || fact.end, period_end: fact.end, trend: "unknown", comparison_period_start: null, comparison_period_end: null, summary: text, claim_ids: [claimId] };
    records.push(evidenceRecord({ id: `evidence-financial-${key}`, category: "financial_context", date: fact.filed, text, sourceId, cik: identity.cik, ticker: identity.ticker }));
  }
  return { domain: "financial", identity, dividends: unknownSection("Dividend status was not established from Company Facts.", "Dividend and security-specific applicability retrieval remains deferred."), financial_assessment: { state: "limited_coverage", as_of: retrievedAt.slice(0, 10), reporting_currency: null, summary: "Latest standardized SEC facts are shown; document-level liquidity and accounting interpretation remains limited.", coverage_notes: ["Custom XBRL tags, comparable periods, going concern, and filing-note extraction remain deferred."], metrics, going_concern: { state: "unknown", as_of: null, summary: "Going-concern language was not extracted in this phase.", claim_ids: [] }, material_warnings: [] }, claims, sources };
}

export function createSecEvidenceClient({ fetchImpl = globalThis.fetch, now = () => Date.now(), userAgent = DEFAULT_USER_AGENT, minRequestIntervalMs = 125, logger = console } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  const cache = new Map(); const inFlight = new Map(); let nextRequestAt = 0; let requestQueue = Promise.resolve(); const packets = new Map();
  const cachedJson = async (key, url, ttl, { phase, endpointCategory, requestCounter }) => {
    const hit = cache.get(key); if (hit && hit.expiresAt > now()) return { data: hit.data, cache: "hit" };
    if (inFlight.has(key)) return { data: await inFlight.get(key), cache: "shared" };
    const request = requestQueue.then(async () => {
      const wait = Math.max(0, nextRequestAt - now()); if (wait) await new Promise((resolve) => setTimeout(resolve, wait)); nextRequestAt = now() + minRequestIntervalMs;
      const requestStarted = now(); requestCounter.count += 1; let response;
      try {
        response = await fetchImpl(url, { headers: { "User-Agent": userAgent, Accept: "application/json", "Accept-Encoding": "gzip, deflate" } });
        if (!response.ok) throw new SecRetrievalError("SEC returned an unsuccessful status", { status: response.status, responseReceived: true });
        const data = await response.json(); cache.set(key, { data, expiresAt: now() + ttl }); return data;
      } catch (error) {
        if (error instanceof SecRetrievalError) {
          Object.assign(error, { phase, endpointCategory, elapsedMs: now() - requestStarted, cacheState: "miss", requestCount: requestCounter.count });
          throw error;
        }
        throw new SecRetrievalError("SEC request could not be completed", { phase, endpointCategory, elapsedMs: now() - requestStarted, responseReceived: Boolean(response), cacheState: "miss", requestCount: requestCounter.count }, error);
      }
    });
    requestQueue = request.catch(() => undefined);
    inFlight.set(key, request); try { return { data: await request, cache: "miss" }; } finally { inFlight.delete(key); }
  };
  return {
    getPacket(ticker) { return packets.get(ticker) ?? null; },
    async researchTicker(ticker, { onProgress } = {}) {
      const started = now(); const retrievedAt = new Date(now()).toISOString(); const records = []; const cacheStatus = {}; const requestCounter = { count: 0 }; const failures = []; let firstUseful = null; const results = {};
      const retrieve = async (key, url, ttl, phase, endpointCategory) => {
        try { return await cachedJson(key, url, ttl, { phase, endpointCategory, requestCounter }); }
        catch (error) { const diagnostic = getSafeSecDiagnostics(error, { phase, endpointCategory, elapsedMs: now() - started, requestCount: requestCounter.count }); failures.push(diagnostic); logger.error(`SEC retrieval failed for ${ticker} ${JSON.stringify(diagnostic)}`); return null; }
      };
      const tickerResult = await retrieve("tickers", TICKER_URL, CACHE_TTL_MS.tickers, "sec_ticker_map_request", "ticker_map");
      if (!tickerResult) return { report: assembleFastReport(ticker, {}), operations: { ...buildResearchOperations({ stage: "fast", latencyMs: now() - started, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: "pending" }])) }), retrieval: { status: "unavailable", sec_request_count: requestCounter.count, cache: { tickers: "miss" }, failures } }, evidence_records: [], synthesis: { status: "unavailable" } };
      cacheStatus.tickers = tickerResult.cache;
      const fields = tickerResult.data.fields ?? ["cik", "name", "ticker", "exchange"]; const entries = (tickerResult.data.data ?? Object.values(tickerResult.data)).map((row) => Array.isArray(row) ? Object.fromEntries(fields.map((field, index) => [field, row[index]])) : row);
      const match = entries.find((entry) => String(entry.ticker).toUpperCase() === ticker);
      if (!match) return { report: assembleFastReport(ticker, {}), operations: buildResearchOperations({ stage: "fast", latencyMs: now() - started, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: "pending" }])) }), evidence_records: [], synthesis: { status: "unavailable" } };
      const cik = String(match.cik ?? match.cik_str).padStart(10, "0");
      const submissionResult = await retrieve(`submissions:${cik}`, `${SEC_BASE}/submissions/CIK${cik}.json`, CACHE_TTL_MS.issuer, "sec_submissions_request", "submissions"); if (submissionResult) cacheStatus.submissions = submissionResult.cache;
      const submissions = submissionResult?.data ?? { name: match.name, filings: { recent: {} } };
      const capitalBase = identityFragment(ticker, { ...match, cik }, submissions, retrievedAt, records); results.capital = { fragment: capitalBase }; firstUseful = now() - started;
      const publish = async (final = false) => { if (onProgress) await onProgress({ report: assembleFastReport(ticker, results, { generatedAt: retrievedAt }), operations: operations(final), evidence_records: structuredClone(records), final }); };
      const operations = () => ({ ...buildResearchOperations({ stage: "fast", latencyMs: now() - started, firstUsefulLatencyMs: firstUseful, usage: null, webSearchCalls: 0, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: results[key]?.fragment ? "completed" : "pending" }] )) }), retrieval: { status: "in_progress", sec_request_count: requestCounter.count, cache: cacheStatus, failures } });
      await publish(false);
      const factsPromise = retrieve(`facts:${cik}`, `${SEC_BASE}/api/xbrl/companyfacts/CIK${cik}.json`, CACHE_TTL_MS.issuer, "sec_companyfacts_request", "companyfacts");
      const rows = filingRows(submissions); results.capital = { fragment: capitalFromFilings(capitalBase, rows, retrievedAt, records) }; results.catalyst = { fragment: catalystFragment(capitalBase.identity, rows, retrievedAt, records) }; await publish(false);
      const factsResult = await factsPromise; if (factsResult) { cacheStatus.companyfacts = factsResult.cache; results.financial = { fragment: financialFragment(capitalBase.identity, factsResult.data, retrievedAt, records) }; }
      const packetSources = [...new Map(Object.values(results).flatMap((result) => result.fragment?.sources ?? []).map((source) => [source.id, source])).values()];
      const packet = { ticker, identity: capitalBase.identity, retrieved_at: retrievedAt, records: structuredClone(records), sources: packetSources, cache: cacheStatus, sec_request_count: Object.values(cacheStatus).filter((value) => value === "miss").length }; packets.set(ticker, packet);
      return { report: assembleFastReport(ticker, results, { generatedAt: retrievedAt }), operations: { ...operations(true), retrieval: { status: failures.length ? "limited" : "completed", sec_request_count: requestCounter.count, cache: cacheStatus, failures } }, evidence_records: records, evidence_packet: packet, synthesis: { status: "pending" } };
    }
  };
}
