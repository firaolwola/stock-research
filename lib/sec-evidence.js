import { assembleFastReport, FAST_DOMAINS } from "./fast-research.js";
import { buildResearchOperations } from "./research-budget.js";
import { extractSecFilingEvidenceWithDiagnostics, filingHtmlToText, findMaterialExhibitUrl, normalizeCatalystClassification } from "./sec-filing-extraction.js";
import { resolveBoundedHistoricalIdentity } from "./sec-historical-identities.js";

const SEC_BASE = "https://data.sec.gov";
const TICKER_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const DEFAULT_USER_AGENT = "StockResearch/1.0 github.com/firaolwola/stock-research";
const CACHE_TTL_MS = Object.freeze({ tickers: 6 * 60 * 60 * 1000, issuer: 5 * 60 * 1000 });
const OFFERING_FORMS = /^(S-1|S-3|F-1|F-3|424B|POS AM)/;
const CATALYST_FORMS = new Set(["8-K", "6-K"]);
const FOREIGN_PROFIT_ALIASES_BY_CIK = Object.freeze({
  "0001736541": Object.freeze([
    ["nio", "NetLossAttributableToOrdinaryShareholdersOfNioInc", "Net loss attributable to NIO Inc. ordinary shareholders"],
    ["nio", "NetLossAttributableToNioIncsOrdinaryShareholders", "Net loss attributable to NIO Inc. ordinary shareholders"],
    ["nio", "NetLossAttributableToOrdinaryShareholders", "Net loss attributable to ordinary shareholders"]
  ])
});

function issuerScopedProfitAliases(companyFacts, cik) {
  if (cik !== "0001736541") return [];
  const verifiedLabel = /^net loss attributable to (?:ordinary shareholders of )?nio inc\.?$/i;
  return Object.entries(companyFacts?.facts ?? {}).flatMap(([taxonomy, concepts]) => Object.entries(concepts ?? {}).filter(([, concept]) => verifiedLabel.test(String(concept?.label ?? "").trim()) && Array.isArray(concept?.units?.CNY)).map(([tag, concept]) => [taxonomy, tag, concept.label]));
}

function cadenceForFact(fact) {
  if (!fact?.start || !fact?.end) return "point_in_time";
  const days = Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000);
  if (days >= 330 && days <= 400) return "annual";
  if (days >= 75 && days <= 110) return "quarter";
  if (days > 110 && days < 330) return "year_to_date";
  return "other";
}

export function classifyProfitConceptSemantics({ tag, label }) {
  const text = `${tag ?? ""} ${label ?? ""}`;
  if (/comprehensive income/i.test(text)) return "comprehensive_income_not_net_income";
  if (/including portion attributable to noncontrolling interest/i.test(text)) return "consolidated_profit_loss_including_noncontrolling_interest";
  if (/attributable to noncontrolling interest/i.test(text)) return "noncontrolling_interest_only";
  if (/attributable to (?:ordinary shareholders of )?nio inc/i.test(text)) return "attributable_to_ordinary_shareholders";
  return "non_equivalent_or_unestablished";
}

function rejectedProfitConceptDiagnostics(companyFacts, identity, acceptedDefinitions) {
  const accepted = new Set(acceptedDefinitions.map(([taxonomy, tag]) => `${taxonomy}:${tag}`));
  const likelyProfit = /(?:profit|loss|income)/i; const diagnostics = [];
  for (const [taxonomy, concepts] of Object.entries(companyFacts?.facts ?? {})) {
    for (const [tag, concept] of Object.entries(concepts ?? {})) {
      if (accepted.has(`${taxonomy}:${tag}`) || !likelyProfit.test(`${tag} ${concept?.label ?? ""}`)) continue;
      for (const [unit, facts] of Object.entries(concept?.units ?? {})) {
        for (const fact of [...(facts ?? [])].filter((item) => item?.end).slice(-4)) {
          const cadence = cadenceForFact(fact);
          const semanticMatch = /^net loss attributable to (?:ordinary shareholders of )?nio inc\.?$/i.test(String(concept?.label ?? "").trim());
          const reason = identity.cik === "0001736541" && unit !== "CNY" ? "unsupported_currency"
            : identity.cik === "0001736541" && !semanticMatch ? "attributable_profit_loss_semantics_not_established"
              : cadence !== "annual" ? "non_annual_or_noncomparable_period" : "concept_not_in_accepted_financial_taxonomy";
          diagnostics.push({ taxonomy_namespace: String(taxonomy).slice(0, 80), concept_tag: String(tag).slice(0, 160), label: String(concept?.label ?? "").slice(0, 200), semantic_category: classifyProfitConceptSemantics({ tag, label: concept?.label }), unit: String(unit).slice(0, 40), currency: /^[A-Z]{3}$/.test(unit) ? unit : null, start_date: normalizeSecDate(fact.start), end_date: normalizeSecDate(fact.end), duration_days: fact.start ? Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000) : null, cadence, accession: String(fact.accn ?? "").slice(0, 30) || null, form: String(fact.form ?? "").slice(0, 20) || null, rejection_reason: reason, issuer_cik: identity.cik });
        }
      }
    }
  }
  return diagnostics.sort((a, b) => {
    const priority = (item) => (/attributable/i.test(`${item.concept_tag} ${item.label}`) ? 4 : 0) + (!/^(?:us-gaap|ifrs-full)$/.test(item.taxonomy_namespace) ? 2 : 0) + (item.cadence === "annual" ? 1 : 0);
    return priority(b) - priority(a) || String(b.end_date).localeCompare(String(a.end_date));
  }).slice(0, 24);
}

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
const unknownMetric = (label) => ({ state: "unknown", label, value: null, unit: null, period_start: null, period_end: null, trend: "unknown", comparison_period_start: null, comparison_period_end: null, observations: [], annual_observations: [], summary: `${label} was not established by the available SEC Company Facts.`, claim_ids: [] });
const factor = (label) => ({ rating: "unknown", explanation: `${label} requires synthesis or broader research.`, claim_ids: [] });
const normalizeSecDate = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 10) : null;

function abortableDelay(milliseconds, signal) {
  if (milliseconds <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => { clearTimeout(timer); reject(signal.reason ?? new DOMException("Aborted", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    timer.unref?.();
  });
}

function awaitWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function accessionUrl(cik, accession, document) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${document}`;
}

function filingRows(submissions) {
  const recent = submissions?.filings?.recent ?? {};
  return (recent.accessionNumber ?? []).map((accession, index) => ({
    accession, form: recent.form?.[index], filed: recent.filingDate?.[index], reportDate: recent.reportDate?.[index] || null,
    document: recent.primaryDocument?.[index], items: recent.items?.[index] || "", description: recent.primaryDocDescription?.[index] || ""
  })).filter((row) => row.accession && row.form && row.filed && row.document);
}

const NT_EXPECTED_FORM = { "NT 10-K": "10-K", "NT 20-F": "20-F", "NT 40-F": "40-F", "NT 10-Q": "10-Q" };

export function selectRelevantNtFiling(rows, retrievedAt) {
  const annualRegime = rows.filter((row) => /^(10-K|20-F|40-F)$/.test(row.form)).sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0]?.form ?? null;
  const candidates = rows.filter((row) => NT_EXPECTED_FORM[row.form]).sort((a, b) => String(b.filed).localeCompare(String(a.filed)));
  const diagnostics = candidates.map((row) => {
    const expectedForm = NT_EXPECTED_FORM[row.form]; const isAnnual = expectedForm !== "10-Q";
    const superseding = rows.find((candidate) => candidate.form === expectedForm && candidate.reportDate === row.reportDate && candidate.filed > row.filed);
    const latestExpectedPeriod = rows.filter((candidate) => candidate.form === expectedForm && candidate.reportDate).map((candidate) => candidate.reportDate).sort().at(-1) ?? null;
    const ageDays = Math.floor((new Date(retrievedAt) - new Date(`${row.filed}T00:00:00Z`)) / 86_400_000);
    const regimeMismatch = isAnnual && annualRegime && annualRegime !== expectedForm;
    const withinWindow = ageDays >= 0 && ageDays <= (isAnnual ? 550 : 275);
    const explainsFreshnessGap = Boolean(row.reportDate && (!latestExpectedPeriod || row.reportDate > latestExpectedPeriod));
    const activeDelay = !superseding && !regimeMismatch && withinWindow && explainsFreshnessGap;
    const exclusionReason = activeDelay ? null : superseding ? "superseded_by_expected_periodic_filing" : regimeMismatch ? "not_current_filer_regime" : !withinWindow ? "outside_fast_relevance_window" : !explainsFreshnessGap ? "does_not_explain_current_freshness_gap" : "not_current_delay";
    return { accession: row.accession, form: row.form, report_period: row.reportDate ?? null, filing_date: row.filed, expected_periodic_form: expectedForm, superseding_filing_detected: Boolean(superseding), superseding_accession: superseding?.accession ?? null, active_delay: activeDelay, selected: false, exclusion_reason: exclusionReason, row };
  });
  const selected = diagnostics.find((item) => item.active_delay) ?? null;
  if (selected) selected.selected = true;
  return { row: selected?.row ?? null, diagnostics: diagnostics.map(({ row, ...item }) => item) };
}

export function boundedDocumentRows(rows, retrievedAt) {
  const now = new Date(retrievedAt); const recent = new Date(now); recent.setUTCDate(recent.getUTCDate() - 45); const capital = new Date(now); capital.setUTCFullYear(capital.getUTCFullYear() - 3); const history = new Date(now); history.setUTCFullYear(history.getUTCFullYear() - 5);
  const groups = [
    rows.filter((row) => CATALYST_FORMS.has(row.form) && new Date(row.filed) >= recent).slice(0, 1),
    rows.filter((row) => OFFERING_FORMS.test(row.form) && new Date(row.filed) >= capital).slice(0, 1),
    rows.filter((row) => /^(10-Q|6-K)$/.test(row.form)).slice(0, 1),
    rows.filter((row) => /^(10-K|20-F|40-F)$/.test(row.form)).slice(0, 1),
    [selectRelevantNtFiling(rows, retrievedAt).row].filter(Boolean),
    rows.filter((row) => new Date(row.filed) >= history && /4\.02/.test(row.items)).slice(0, 2),
    rows.filter((row) => new Date(row.filed) >= history && /5\.03/.test(row.items)).slice(0, 4),
    rows.filter((row) => new Date(row.filed) >= history && /3\.01/.test(row.items)).slice(0, 2),
    rows.filter((row) => new Date(row.filed) >= history && /bankruptcy|chapter 11|going concern|delist/i.test(row.description)).slice(0, 3),
    rows.filter((row) => new Date(row.filed) >= capital && /offering|warrant|convertible|financing/i.test(row.description)).slice(0, 3),
    rows.filter((row) => new Date(row.filed) >= history && /split|non-reliance|restatement|internal control|material weakness/i.test(row.description)).slice(0, 3)
  ];
  return [...new Map(groups.flat().map((row) => [row.accession, row])).values()].slice(0, 12);
}

function historicalSubmissionFiles(submissions, retrievedAt) {
  const cutoff = new Date(retrievedAt); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
  return (submissions?.filings?.files ?? []).filter((file) => file?.name && (!file.filingTo || new Date(file.filingTo) >= cutoff)).slice(0, 2);
}

function compactFindings(findings) {
  const limits = { reverse_split: 20, offering: 2, warrant: 2, convertible: 2, exchange_compliance: 3 }; const counts = new Map(); const seen = new Set();
  return findings.filter((finding) => {
    const signature = `${finding.kind}:${finding.statement.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180)}`; if (finding.kind !== "reverse_split" && seen.has(signature)) return false;
    const count = counts.get(finding.kind) ?? 0; if (count >= (limits[finding.kind] ?? 1)) return false;
    if (finding.kind !== "reverse_split") seen.add(signature); counts.set(finding.kind, count + 1); return true;
  });
}

function sourceForFiling(row, cik, claimIds, retrievedAt) {
  return { id: `source-sec-${row.accession.replaceAll("-", "")}`, title: `${row.form} filed ${row.filed}`, url: accessionUrl(cik, row.accession, row.document), published_date: row.filed, source_type: "sec_filing", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: claimIds };
}

function evidenceRecord({ id, category, state = "confirmed", date, text, sourceId, cik, ticker }) {
  return { id, category, state, event_date: date, text, source_id: sourceId, issuer_cik: cik, security_ticker: ticker, confidence: state === "confirmed" ? "high" : "medium" };
}

function factCandidates(companyFacts, tags) {
  return tags.flatMap(([taxonomy, tag, label]) => {
    const concept = companyFacts?.facts?.[taxonomy]?.[tag];
    if (!concept) return [];
    return Object.entries(concept.units ?? {}).flatMap(([unit, facts]) => facts
      .filter((fact) => Number.isFinite(fact.val) && fact.filed && fact.end && fact.accn)
      .map((fact) => ({ ...fact, unit, label: concept.label || label, taxonomy, tag })));
  }).sort((a, b) => `${b.end}:${b.filed}`.localeCompare(`${a.end}:${a.filed}`));
}

function selectUnambiguousFact(companyFacts, tags) {
  const duration = (fact) => fact.start ? Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000) : 0;
  const selections = []; const conflicts = [];
  for (const [priority, definition] of tags.entries()) {
    const candidates = factCandidates(companyFacts, [definition]); if (!candidates.length) continue;
    const newestEnd = candidates[0].end;
    const newestFiled = candidates.filter((fact) => fact.end === newestEnd).map((fact) => fact.filed).sort().at(-1);
    const peers = candidates.filter((fact) => fact.end === newestEnd && fact.filed === newestFiled);
    const periods = new Map();
    for (const fact of peers) {
      const key = `${fact.start ?? fact.end}:${fact.end}`;
      if (!periods.has(key)) periods.set(key, fact);
      else {
        const existing = periods.get(key);
        if (!existing || existing.unit !== fact.unit || existing.val !== fact.val) periods.set(key, null);
      }
    }
    const valid = [...periods.values()].filter(Boolean);
    if (!valid.length) { conflicts.push(...peers); continue; }
    // A quarter and a YTD fact ending on the same date are distinct valid
    // periods. Prefer the shortest current duration within one authoritative
    // concept, then compare concept freshness without treating aliases as
    // contradictory facts.
    valid.sort((a, b) => duration(a) - duration(b) || String(b.frame ?? "").localeCompare(String(a.frame ?? "")));
    selections.push({ fact: valid[0], priority });
  }
  if (!selections.length) return { fact: null, reason: conflicts.length ? "conflicting" : "missing", candidates: conflicts };
  selections.sort((a, b) => `${b.fact.end}:${b.fact.filed}`.localeCompare(`${a.fact.end}:${a.fact.filed}`) || a.priority - b.priority);
  return { fact: selections[0].fact, reason: null };
}

function distinctPointFacts(companyFacts, tags) {
  const byPeriod = new Map();
  for (const fact of factCandidates(companyFacts, tags).filter((item) => !item.start)) {
    const key = fact.end;
    if (!byPeriod.has(key) || (byPeriod.get(key) && fact.filed > byPeriod.get(key).filed)) byPeriod.set(key, fact);
    else {
      const existing = byPeriod.get(key);
      if (!existing || (fact.filed === existing.filed && (fact.unit !== existing.unit || fact.val !== existing.val))) byPeriod.set(key, null);
    }
  }
  return [...byPeriod.values()].filter(Boolean).sort((a, b) => a.end.localeCompare(b.end));
}

function comparableFacts(companyFacts, tags) {
  const { fact: current } = selectUnambiguousFact(companyFacts, tags);
  if (!current) return [];
  const duration = current.start ? Math.round((new Date(current.end) - new Date(current.start)) / 86_400_000) : null;
  const candidates = factCandidates(companyFacts, tags).filter((fact) => fact.taxonomy === current.taxonomy && fact.tag === current.tag && fact.unit === current.unit && fact.end < current.end && (duration === null ? !fact.start : fact.start && Math.abs(Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000) - duration) <= 3));
  const periods = new Map();
  for (const fact of candidates) {
    const key = `${fact.start ?? fact.end}:${fact.end}`; const existing = periods.get(key);
    if (!existing) periods.set(key, fact);
    else if (existing.val !== fact.val) periods.set(key, null);
    else if (fact.filed > existing.filed) periods.set(key, fact);
  }
  const unambiguous = [...periods.values()].filter(Boolean);
  const prior = duration === null
    ? unambiguous.sort((a, b) => b.end.localeCompare(a.end))[0]
    : unambiguous.sort((a, b) => Math.abs(365 - (new Date(current.end) - new Date(a.end)) / 86_400_000) - Math.abs(365 - (new Date(current.end) - new Date(b.end)) / 86_400_000))[0];
  return [prior, current].filter(Boolean).sort((a, b) => `${a.end}:${a.start ?? ""}`.localeCompare(`${b.end}:${b.start ?? ""}`));
}

function annualFacts(companyFacts, tags) {
  const candidates = factCandidates(companyFacts, tags).filter((fact) => ["10-K", "20-F", "40-F"].includes(fact.form) && (!fact.start || Math.abs(Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000) - 365) <= 35));
  const newest = candidates[0]; if (!newest) return [];
  const periods = new Map();
  for (const fact of candidates.filter((item) => item.taxonomy === newest.taxonomy && item.tag === newest.tag && item.unit === newest.unit)) {
    const key = fact.end; const existing = periods.get(key);
    if (!existing) periods.set(key, fact);
    else if (existing.val !== fact.val) periods.set(key, null);
    else if (fact.filed > existing.filed) periods.set(key, fact);
  }
  return [...periods.values()].filter(Boolean).sort((a, b) => a.end.localeCompare(b.end)).slice(-4);
}

function alignDerivedPeriods(leftFacts, rightFacts, derive) {
  const uniqueByPeriod = (facts) => {
    const periods = new Map();
    for (const fact of facts) {
      const key = `${fact.unit}:${fact.start ?? fact.end}:${fact.end}`; const existing = periods.get(key);
      if (!existing) periods.set(key, fact);
      else if (existing.val !== fact.val) periods.set(key, null);
      else if (fact.filed > existing.filed) periods.set(key, fact);
    }
    return [...periods.values()].filter(Boolean);
  };
  const rightByPeriod = new Map(uniqueByPeriod(rightFacts).map((fact) => [`${fact.unit}:${fact.start ?? fact.end}:${fact.end}`, fact]));
  const aligned = uniqueByPeriod(leftFacts).flatMap((left) => {
    const right = rightByPeriod.get(`${left.unit}:${left.start ?? left.end}:${left.end}`);
    return right ? [derive(left, right)] : [];
  }).sort((a, b) => b.end.localeCompare(a.end));
  if (!aligned.length) return [];
  const current = aligned[0]; const duration = current.start ? Math.round((new Date(current.end) - new Date(current.start)) / 86_400_000) : null;
  const prior = aligned.slice(1).filter((fact) => duration === null ? !fact.start : fact.start && Math.abs(Math.round((new Date(fact.end) - new Date(fact.start)) / 86_400_000) - duration) <= 3).sort((a, b) => duration === null ? b.end.localeCompare(a.end) : Math.abs(365 - (new Date(current.end) - new Date(a.end)) / 86_400_000) - Math.abs(365 - (new Date(current.end) - new Date(b.end)) / 86_400_000))[0];
  return [prior, current].filter(Boolean).sort((a, b) => a.end.localeCompare(b.end));
}

function alignAnnualPeriods(leftFacts, rightFacts, derive) {
  const rightByPeriod = new Map(rightFacts.map((fact) => [`${fact.unit}:${fact.start ?? fact.end}:${fact.end}`, fact]));
  return leftFacts.flatMap((left) => {
    const right = rightByPeriod.get(`${left.unit}:${left.start ?? left.end}:${left.end}`);
    return right ? [derive(left, right)] : [];
  }).sort((a, b) => a.end.localeCompare(b.end)).slice(-4);
}

function normalizedIdentityName(value) {
  return String(value ?? "").toUpperCase().replace(/\b(?:INCORPORATED|INC|CORPORATION|CORP|LIMITED|LTD|PLC)\b/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
}

function assertIssuerIdentity(expectedCik, submissions, companyFacts) {
  const cik = String(expectedCik).padStart(10, "0");
  for (const [source, value] of [["submissions", submissions?.cik], ["company_facts", companyFacts?.cik]]) {
    if (value !== undefined && value !== null && String(value).padStart(10, "0") !== cik) {
      const error = new Error(`SEC ${source} identity does not match the requested issuer.`);
      error.name = "SecIdentityMismatchError"; error.code = "SEC_IDENTITY_MISMATCH"; throw error;
    }
  }
  const current = normalizedIdentityName(submissions?.name);
  const factsName = normalizedIdentityName(companyFacts?.entityName);
  if (current && factsName && current !== factsName) {
    const former = (submissions?.formerNames ?? []).some((item) => normalizedIdentityName(item.name) === factsName);
    if (!former) { const error = new Error("SEC Company Facts issuer name conflicts with submissions identity."); error.name = "SecIdentityMismatchError"; error.code = "SEC_IDENTITY_MISMATCH"; throw error; }
  }
}

function identityFragment(ticker, match, submissions, retrievedAt, records, historicalIdentity = null) {
  const cik = String(match.cik).padStart(10, "0");
  const claimId = "claim-sec-identity";
  const sourceId = historicalIdentity ? "source-sec-historical-identity" : "source-sec-ticker-map";
  const lineageClaims = [];
  const priorIdentities = (submissions.formerNames ?? []).map((item) => ({ ...item, from: normalizeSecDate(item.from), to: normalizeSecDate(item.to) })).filter((item) => item.name && item.from && item.to).slice(0, 3).map((item, index) => {
    const id = `claim-sec-lineage-${index + 1}`; const text = `SEC submissions metadata identifies ${item.name} as a former name of CIK ${cik} from ${item.from} through ${item.to}.`;
    lineageClaims.push({ id, text, materiality: "medium", state: "confirmed", as_of: retrievedAt, source_ids: ["source-sec-submissions"] });
    records.push(evidenceRecord({ id: `evidence-sec-lineage-${index + 1}`, category: "issuer_lineage", date: item.to, text, sourceId: "source-sec-submissions", cik, ticker }));
    return { name: item.name, ticker: null, effective_from: item.from, effective_to: item.to, linkage_state: "confirmed", linkage_confidence: "high", claim_ids: [id] };
  });
  const submissionsLineageClaimIds = lineageClaims.map((claim) => claim.id);
  if (historicalIdentity) {
    for (const prior of historicalIdentity.prior_tickers ?? []) {
      if (priorIdentities.some((item) => item.ticker === prior.ticker)) continue;
      const index = priorIdentities.length + 1; const id = `claim-sec-lineage-${index}`;
      const text = `An SEC filing links historical ticker ${prior.ticker} to ${historicalIdentity.legal_name}, current ticker ${historicalIdentity.current_ticker}, under CIK ${cik}.`;
      lineageClaims.push({ id, text, materiality: "high", state: "confirmed", as_of: `${historicalIdentity.source_date}T00:00:00Z`, source_ids: ["source-sec-historical-identity"] });
      records.push(evidenceRecord({ id: `evidence-sec-lineage-${index}`, category: "issuer_lineage", date: historicalIdentity.source_date, text, sourceId: "source-sec-historical-identity", cik, ticker }));
      priorIdentities.push({ name: prior.name ?? null, ticker: prior.ticker, effective_from: prior.effective_from ?? null, effective_to: prior.effective_to ?? historicalIdentity.source_date, linkage_state: prior.effective_from ? "confirmed" : "limited_coverage", linkage_confidence: prior.effective_from ? "high" : "unknown", claim_ids: [id] });
    }
  }
  const identityText = historicalIdentity
    ? `SEC-backed historical identity resolution associates requested ticker ${ticker} with ${submissions.name || historicalIdentity.legal_name} (CIK ${cik}); current ticker is ${historicalIdentity.current_ticker} and venue context is ${historicalIdentity.listing_venue}.`
    : `SEC associates ${ticker} with ${submissions.name || match.name} (CIK ${cik}) on ${match.exchange || "an exchange not identified in the map"}.`;
  records.push(evidenceRecord({ id: "evidence-sec-identity", category: "security_and_listing", date: historicalIdentity?.source_date ?? retrievedAt.slice(0, 10), text: identityText, sourceId, cik, ticker }));
  return {
    domain: "capital", identity: { ticker, issuer_legal_name: submissions.name || match.name, cik },
    security: { ticker, name: submissions.name || match.name, security_type: historicalIdentity?.security_type ?? "unknown", listing_venue: historicalIdentity?.listing_venue ?? match.exchange ?? "Unknown", listing_status: historicalIdentity?.listing_status ?? "unknown", ...(historicalIdentity ? { security_structure: historicalIdentity.security_type === "adr" ? "ads" : historicalIdentity.security_type === "foreign_ordinary_share" ? "direct_share" : "unknown", depositary_ratio: null, additional_listing_venues: [] } : {}), evidence_state: historicalIdentity ? "confirmed" : "limited_coverage", claim_ids: [claimId, ...lineageClaims.map((claim) => claim.id)] },
    issuer: { legal_name: submissions.name || match.name, cik, identity_state: "confirmed", identity_confidence: "high", ...(historicalIdentity ? { jurisdiction: historicalIdentity.filer_jurisdiction ?? null, foreign_private_issuer: historicalIdentity.filer_regime === "foreign_private_issuer" ? true : null, filing_regime: historicalIdentity.filer_regime === "foreign_private_issuer" ? "foreign_20-F_6-K" : "unknown", accounting_basis: historicalIdentity.accounting_standard ?? "unknown", accounting_authority: historicalIdentity.accounting_standard === "IFRS" ? "IASB" : null, presentation_currency: null } : {}), prior_identities: priorIdentities, claim_ids: [claimId, ...lineageClaims.map((claim) => claim.id)] },
    reverse_splits: unknownSection("SEC filing discovery completed, but split terms were not extracted in this bounded phase.", "Filing-text and exchange corporate-action parsing remain deferred."),
    dilution: unknownSection("SEC filing discovery is still pending.", "Potential financing forms have not yet been classified."),
    claims: [{ id: claimId, text: identityText, materiality: "high", state: "confirmed", as_of: historicalIdentity ? `${historicalIdentity.source_date}T00:00:00Z` : retrievedAt, source_ids: [sourceId] }, ...lineageClaims],
    sources: [
      { id: sourceId, title: historicalIdentity ? "SEC-filed ticker and listing lineage" : "SEC ticker, CIK, and exchange associations", url: historicalIdentity?.source_url ?? TICKER_URL, published_date: historicalIdentity?.source_date ?? retrievedAt.slice(0, 10), source_type: historicalIdentity ? "sec_filing" : "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId, ...(historicalIdentity ? lineageClaims.map((claim) => claim.id).filter((id) => !submissionsLineageClaimIds.includes(id)) : [])] },
      ...(submissionsLineageClaimIds.length ? [{ id: "source-sec-submissions", title: "SEC submissions metadata", url: `${SEC_BASE}/submissions/CIK${cik}.json`, published_date: retrievedAt.slice(0, 10), source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: submissionsLineageClaimIds }] : [])
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
    revenue: [["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenue"], ["us-gaap", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenue"], ["us-gaap", "Revenues", "Revenue"], ["us-gaap", "SalesRevenueNet", "Revenue"], ["ifrs-full", "Revenue", "Revenue"]],
    profitability: [["us-gaap", "NetIncomeLoss", "Net income or loss"], ["ifrs-full", "ProfitLoss", "Profit or loss"], ["ifrs-full", "ProfitLossAttributableToOwnersOfParent", "Profit or loss attributable to owners"], ["ifrs-full", "ProfitLossFromContinuingOperations", "Profit or loss from continuing operations"], ...(FOREIGN_PROFIT_ALIASES_BY_CIK[identity.cik] ?? []), ...issuerScopedProfitAliases(companyFacts, identity.cik)]
  };
  const normalizationDiagnostics = rejectedProfitConceptDiagnostics(companyFacts, identity, definitions.profitability);
  const claims = []; const metrics = {}; const sources = [];
  const addFact = (key, fact, { label = fact?.label, value = fact?.val, state = "confirmed", summary, comparable = [fact], annual = [] } = {}) => {
    const claimId = `claim-financial-${key}`; const sourceId = `source-sec-companyfacts-${key}`;
    const text = summary ?? `SEC Company Facts reports ${label} of ${value} ${fact.unit} for the period ending ${fact.end}, filed ${fact.filed}.`;
    claims.push({ id: claimId, text, materiality: key === "cash" || key === "debt" ? "high" : "medium", state, as_of: `${fact.filed}T00:00:00Z`, source_ids: [sourceId] });
    sources.push({ id: sourceId, title: `SEC Company Facts — ${label}`, url: `${SEC_BASE}/api/xbrl/companyfacts/CIK${identity.cik}.json`, published_date: fact.filed, source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId] });
    const buildObservations = (items, suffix) => state === "confirmed" ? items.map((item, index) => {
      if (item === fact || (item.start === fact.start && item.end === fact.end && item.val === fact.val)) return { value, unit: fact.unit, period_start: fact.start || fact.end, period_end: fact.end, claim_ids: [claimId] };
      const observationClaimId = `${claimId}-${suffix}-${index + 1}`; const observationSourceId = `${sourceId}-${suffix}-${index + 1}`;
      const observationText = `SEC Company Facts reports ${label} of ${item.val} ${item.unit} for the comparable period ending ${item.end}, filed ${item.filed}.`;
      claims.push({ id: observationClaimId, text: observationText, materiality: "medium", state: "confirmed", as_of: `${item.filed}T00:00:00Z`, source_ids: [observationSourceId] });
      sources.push({ id: observationSourceId, title: `SEC Company Facts — ${label} comparable period`, url: `${SEC_BASE}/api/xbrl/companyfacts/CIK${identity.cik}.json`, published_date: item.filed, source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [observationClaimId] });
      return { value: item.val, unit: item.unit, period_start: item.start || item.end, period_end: item.end, claim_ids: [observationClaimId] };
    }) : [];
    const observations = buildObservations(comparable, "observation");
    const annualObservations = buildObservations(annual, "annual");
    const comparison = observations.length > 1 ? observations.at(-2) : null;
    metrics[key] = state === "confirmed"
      ? { state, label, value, unit: fact.unit, period_start: fact.start || fact.end, period_end: fact.end, trend: "unknown", comparison_period_start: comparison?.period_start ?? null, comparison_period_end: comparison?.period_end ?? null, observations, annual_observations: annualObservations, summary: text, claim_ids: [...new Set([...observations, ...annualObservations].flatMap((item) => item.claim_ids))] }
      : { ...unknownMetric(label), state, summary: text, claim_ids: [claimId] };
    records.push(evidenceRecord({ id: `evidence-financial-${key}`, category: "financial_context", state, date: fact.filed, text, sourceId, cik: identity.cik, ticker: identity.ticker }));
    return claimId;
  };
  for (const key of ["cash", "revenue", "profitability"]) {
    const annual = annualFacts(companyFacts, definitions[key]);
    const selected = selectUnambiguousFact(companyFacts, definitions[key]);
    // Keep the visible summary and score series on one authoritative concept.
    // A newer comparable annual IFRS/GAAP series outranks a stale custom fact.
    const fact = annual.length >= 2 && (!selected.fact || annual.at(-1).end >= selected.fact.end) ? annual.at(-1) : selected.fact;
    if (!fact) { metrics[key] = unknownMetric(key.replaceAll("_", " ")); continue; }
    const comparable = annual.length >= 2 && fact === annual.at(-1) ? annual.slice(-2) : comparableFacts(companyFacts, [[fact.taxonomy, fact.tag, fact.label]]);
    addFact(key, fact, { comparable, annual });
  }
  if (identity.cik === "0001736541" && metrics.revenue?.state === "confirmed" && metrics.profitability?.state === "unknown") metrics.profitability.summary = "SEC revenue history was usable, but attributable annual net-loss normalization remained unavailable.";
  const sharesTags = [["dei", "EntityCommonStockSharesOutstanding", "Common shares outstanding"]];
  const allShareFacts = distinctPointFacts(companyFacts, sharesTags);
  const shareFacts = allShareFacts.length <= 4 ? allShareFacts : [...allShareFacts.slice(0, -1).filter((fact, index, values) => index === values.length - 1 || fact.end.slice(0, 4) !== values[index + 1].end.slice(0, 4)).slice(-3), allShareFacts.at(-1)];
  let sharesOutstanding = { state: "unknown", summary: "Comparable reported shares outstanding were not established by SEC Company Facts.", observations: [], annual_observations: [], claim_ids: [] };
  if (shareFacts.length) {
    const observations = shareFacts.map((fact, index) => {
      const claimId = `claim-shares-outstanding-${index + 1}`; const sourceId = `source-sec-companyfacts-shares-outstanding-${index + 1}`;
      const text = `SEC Company Facts reports ${fact.val} common shares outstanding at ${fact.end}, filed ${fact.filed}.`;
      claims.push({ id: claimId, text, materiality: "high", state: "confirmed", as_of: `${fact.filed}T00:00:00Z`, source_ids: [sourceId] });
      sources.push({ id: sourceId, title: "SEC Company Facts — common shares outstanding", url: `${SEC_BASE}/api/xbrl/companyfacts/CIK${identity.cik}.json`, published_date: fact.filed, source_type: "other_primary", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId] });
      records.push(evidenceRecord({ id: `evidence-shares-outstanding-${index + 1}`, category: "dilution_offerings", date: fact.filed, text, sourceId, cik: identity.cik, ticker: identity.ticker }));
      return { value: fact.val, unit: "shares", period_start: fact.end, period_end: fact.end, claim_ids: [claimId] };
    });
    const first = observations[0]; const latest = observations.at(-1); const change = observations.length > 1 && first.value > 0 ? (latest.value - first.value) / first.value * 100 : null;
    sharesOutstanding = { state: "confirmed", summary: change === null ? `SEC reports ${latest.value} shares outstanding at ${latest.period_end}; one observation does not establish a trend.` : `Reported shares outstanding ${change >= 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(1)}% over the displayed period from ${first.period_end} to ${latest.period_end}.`, observations, annual_observations: annualFacts(companyFacts, sharesTags).length ? observations : [], claim_ids: observations.flatMap((item) => item.claim_ids) };
  }
  const ocfTags = [["us-gaap", "NetCashProvidedByUsedInOperatingActivities", "Operating cash flow"], ["ifrs-full", "CashFlowsFromUsedInOperatingActivities", "Operating cash flow"]];
  const capexTags = [["us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment", "Capital expenditures"], ["ifrs-full", "PurchaseOfPropertyPlantAndEquipment", "Capital expenditures"]];
  const ocf = selectUnambiguousFact(companyFacts, ocfTags).fact;
  const capex = selectUnambiguousFact(companyFacts, capexTags).fact;
  if (ocf) addFact("operating_cash_flow", ocf, { label: "Operating cash flow", comparable: comparableFacts(companyFacts, ocfTags), annual: annualFacts(companyFacts, ocfTags) });
  else metrics.operating_cash_flow = unknownMetric("Operating cash flow");
  if (ocf && capex && ocf.unit === capex.unit && ocf.start === capex.start && ocf.end === capex.end) {
    const fcf = { ...ocf, val: ocf.val - Math.abs(capex.val), label: "Free cash flow" };
    const comparableFcf = alignDerivedPeriods(factCandidates(companyFacts, ocfTags), factCandidates(companyFacts, capexTags), (left, right) => ({ ...left, val: left.val - Math.abs(right.val), label: "Free cash flow" }));
    const summary = `Free cash flow of ${fcf.val} ${fcf.unit} is calculated as operating cash flow ${ocf.val} less capital expenditures ${Math.abs(capex.val)} for ${fcf.start || fcf.end} through ${fcf.end}.`;
    const annualFcf = alignAnnualPeriods(annualFacts(companyFacts, ocfTags), annualFacts(companyFacts, capexTags), (left, right) => ({ ...left, val: left.val - Math.abs(right.val), label: "Free cash flow" }));
    addFact("free_cash_flow", fcf, { summary, comparable: comparableFcf, annual: annualFcf });
    addFact("cash_burn", { ...fcf, val: Math.max(0, -fcf.val), label: "Cash burn based on free cash flow" }, { comparable: comparableFcf.map((item) => ({ ...item, val: Math.max(0, -item.val), label: "Cash burn based on free cash flow" })) });
  } else {
    metrics.free_cash_flow = unknownMetric("Free cash flow");
    metrics.free_cash_flow.summary = ocf ? "Operating cash flow is available, but aligned capital expenditures are not; free cash flow is not inferred." : "Free cash flow was not established by the available SEC Company Facts.";
    metrics.cash_burn = unknownMetric("Cash burn");
    metrics.cash_burn.summary = "Cash burn and runway remain unknown without a valid aligned cash-flow measure.";
  }
  const currentDebt = selectUnambiguousFact(companyFacts, [["us-gaap", "LongTermDebtCurrent", "Current long-term debt"], ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsCurrent", "Current debt and finance leases"], ["us-gaap", "ShortTermBorrowings", "Short-term borrowings"]]).fact;
  const noncurrentDebt = selectUnambiguousFact(companyFacts, [["us-gaap", "LongTermDebtNoncurrent", "Non-current long-term debt"], ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsNoncurrent", "Non-current debt and finance leases"]]).fact;
  if (currentDebt && noncurrentDebt && currentDebt.unit === noncurrentDebt.unit && currentDebt.end === noncurrentDebt.end) {
    const debt = { ...noncurrentDebt, start: noncurrentDebt.end, val: currentDebt.val + noncurrentDebt.val, label: "Total debt (current plus non-current components)" };
    const currentDebtTags = [["us-gaap", "LongTermDebtCurrent", "Current long-term debt"], ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsCurrent", "Current debt and finance leases"], ["us-gaap", "ShortTermBorrowings", "Short-term borrowings"]];
    const noncurrentDebtTags = [["us-gaap", "LongTermDebtNoncurrent", "Non-current long-term debt"], ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsNoncurrent", "Non-current debt and finance leases"]];
    const comparableDebt = alignDerivedPeriods(factCandidates(companyFacts, currentDebtTags), factCandidates(companyFacts, noncurrentDebtTags), (left, right) => ({ ...right, start: right.end, val: left.val + right.val, label: "Total debt (current plus non-current components)" }));
    const annualDebt = alignAnnualPeriods(annualFacts(companyFacts, currentDebtTags), annualFacts(companyFacts, noncurrentDebtTags), (left, right) => ({ ...right, start: right.end, val: left.val + right.val, label: "Total debt (current plus non-current components)" }));
    addFact("debt", debt, { summary: `Total debt of ${debt.val} ${debt.unit} is calculated from current debt ${currentDebt.val} plus non-current debt ${noncurrentDebt.val} at ${debt.end}.`, comparable: comparableDebt, annual: annualDebt });
  } else {
    const component = currentDebt ?? noncurrentDebt;
    metrics.debt = unknownMetric("Total debt");
    if (component) {
      addFact("debt", component, { label: "Total debt", state: "limited_coverage", summary: `${component.label} of ${component.val} ${component.unit} is available at ${component.end}, but total debt cannot be established without aligned current and non-current components.` });
    } else metrics.debt.summary = "Neither an aligned total nor sufficient current and non-current debt components were established.";
  }
  const newestPeriod = Object.values(metrics).filter((metric) => metric.state === "confirmed").map((metric) => metric.period_end).sort().at(-1) ?? null;
  const ageDays = newestPeriod ? Math.floor((new Date(retrievedAt) - new Date(`${newestPeriod}T00:00:00Z`)) / 86_400_000) : null;
  const warnings = []; const coverageNotes = ["Custom XBRL tags, comparable periods, and filing-note extraction remain bounded."];
  if (ageDays !== null && ageDays > 180) {
    const claimId = "claim-financial-stale"; const sourceIds = [...new Set(Object.values(metrics).filter((metric) => metric.period_end === newestPeriod).flatMap((metric) => metric.claim_ids).flatMap((id) => claims.find((claim) => claim.id === id)?.source_ids ?? []))];
    const text = `The newest standardized SEC financial period ended ${newestPeriod}, ${ageDays} days before this Fast report.`;
    claims.push({ id: claimId, text, materiality: "high", state: "confirmed", as_of: retrievedAt, source_ids: sourceIds });
    for (const source of sources) if (sourceIds.includes(source.id)) source.supported_claim_ids.push(claimId);
    warnings.push({ id: "financial-stale-period", kind: "other", state: "confirmed", severity: "high", title: "Financial evidence is stale", as_of: newestPeriod, summary: text, claim_ids: [claimId] }); coverageNotes.push(text);
    records.push(evidenceRecord({ id: "evidence-financial-stale", category: "financial_context", date: newestPeriod, text, sourceId: sourceIds[0], cik: identity.cik, ticker: identity.ticker }));
  }
  for (const key of ["cash", "debt", "free_cash_flow", "cash_burn"]) {
    const metric = metrics[key]; if (metric.state !== "confirmed" || !metric.period_end) continue;
    const metricAge = Math.floor((new Date(retrievedAt) - new Date(`${metric.period_end}T00:00:00Z`)) / 86_400_000);
    if (metricAge <= 180) continue;
    metric.state = "limited_coverage"; metric.value = null; metric.unit = null; metric.trend = "unknown"; metric.observations = []; metric.annual_observations = [];
    metric.summary = `${metric.label} is ${metricAge} days old and is not used as current decision evidence.`;
  }
  const confirmedCurrencies = new Set(Object.values(metrics).filter((metric) => metric.state === "confirmed" && /^[A-Z]{3}$/.test(metric.unit ?? "")).map((metric) => metric.unit));
  const reportingCurrency = confirmedCurrencies.size === 1 ? [...confirmedCurrencies][0] : null;
  if (confirmedCurrencies.size > 1) coverageNotes.push("Financial facts use conflicting currencies; cross-metric calculations and runway remain unresolved.");
  if (!metrics.cash || metrics.cash.state !== "confirmed" || !metrics.cash_burn || metrics.cash_burn.state !== "confirmed" || metrics.cash_burn.value <= 0 || metrics.cash.unit !== metrics.cash_burn.unit) coverageNotes.push("Runway is not calculated because current, comparable cash and positive burn inputs are not both available.");
  return { domain: "financial", identity, normalization_diagnostics: normalizationDiagnostics, dividends: unknownSection("Dividend status was not established from Company Facts.", "Dividend and security-specific applicability retrieval remains deferred."), financial_assessment: { state: "limited_coverage", as_of: retrievedAt.slice(0, 10), reporting_currency: reportingCurrency, summary: newestPeriod ? `Latest standardized SEC facts are shown through ${newestPeriod}; partial, stale, or conflicting facts remain unresolved.` : "No standardized current SEC financial period was established.", coverage_notes: coverageNotes, metrics, shares_outstanding: sharesOutstanding, going_concern: { state: "unknown", as_of: null, summary: "Going-concern language was not established from bounded filing extraction.", claim_ids: [] }, material_warnings: warnings }, claims, sources };
}

function promoteIssuerReportingProperties(capital, documents, retrievedAt, records) {
  if (!capital || !documents.length) return [];
  const forms = new Set(documents.map(({ row }) => row.form));
  const annual = documents.find(({ row }) => ["40-F", "20-F", "10-K"].includes(row.form));
  const texts = documents.map((item) => ({ ...item, text: filingHtmlToText(item.html) }));
  const combined = texts.map(({ text }) => text).join(" ");
  const foreign40 = forms.has("40-F"); const foreign20 = forms.has("20-F");
  const explicitForeign = /\bforeign private issuer\b/i.test(combined);
  const foreign = foreign40 || foreign20 || explicitForeign;
  const filingRegime = foreign40 ? "foreign_40-F_6-K" : foreign20 ? "foreign_20-F_6-K" : forms.has("10-K") ? "domestic_10-K_10-Q_8-K" : "unknown";
  const ifrs = /IFRS Accounting Standards as issued by (?:the )?International Accounting Standards Board|International Financial Reporting Standards as issued by (?:the )?IASB/i.test(combined);
  const usGaap = /(?:prepared|presented) in accordance with (?:United States|U\.S\.) generally accepted accounting principles|\bU\.S\. GAAP\b/i.test(combined);
  const jurisdiction = /\b(?:corporation|company) (?:organized|incorporated|continued) under the laws of Canada\b|\bCanadian (?:corporation|company|issuer)\b/i.test(combined) || foreign40 ? "Canada" : null;
  const directShares = /\bcommon shares\b/i.test(combined) && /\b(?:NYSE|New York Stock Exchange)\b/i.test(combined) && /\b(?:TSX|Toronto Stock Exchange)\b/i.test(combined);
  const ads = /\b(?:American Depositary Shares?|ADSs?)\b/i.test(combined);
  const venues = directShares ? ["TSX"] : [];
  const currency = /\bCanadian dollars?\b|\bCAD\b/i.test(combined) ? "CAD" : capital.issuer.presentation_currency ?? null;
  const source = annual ?? texts.find(({ row }) => row.form === "6-K");
  if (!source || !(foreign || ifrs || usGaap || directShares || ads)) return [];
  const claimId = "claim-sec-reporting-identity"; const sourceId = "source-sec-reporting-identity";
  const facts = [foreign ? `filing regime ${filingRegime}` : null, ifrs ? "IFRS as issued by the IASB" : usGaap ? "U.S. GAAP" : null, directShares ? "direct common shares on NYSE and TSX" : ads ? "American Depositary Shares" : null].filter(Boolean);
  const text = `SEC-filed authoritative evidence identifies ${capital.issuer.legal_name} with ${facts.join(", ")}.`;
  capital.claims.push({ id: claimId, text, materiality: "high", state: "confirmed", as_of: `${source.row.filed}T00:00:00Z`, source_ids: [sourceId] });
  capital.sources.push({ id: sourceId, title: `${source.row.form} filed ${source.row.filed} — reporting and security identity`, url: source.url, published_date: source.row.filed, source_type: "sec_filing", confidence: "high", retrieved_at: retrievedAt, supported_claim_ids: [claimId] });
  capital.issuer = { ...capital.issuer, jurisdiction: jurisdiction ?? capital.issuer.jurisdiction ?? null, foreign_private_issuer: foreign ? true : filingRegime.startsWith("domestic") ? false : capital.issuer.foreign_private_issuer ?? null, filing_regime: filingRegime !== "unknown" ? filingRegime : capital.issuer.filing_regime ?? "unknown", accounting_basis: ifrs ? "IFRS" : usGaap ? "US_GAAP" : capital.issuer.accounting_basis ?? "unknown", accounting_authority: ifrs ? "IASB" : usGaap ? "FASB/SEC U.S. GAAP" : capital.issuer.accounting_authority ?? null, presentation_currency: currency, claim_ids: [...new Set([...capital.issuer.claim_ids, claimId])] };
  capital.security = { ...capital.security, security_structure: directShares ? "direct_share" : ads ? "ads" : "unknown", depositary_ratio: null, additional_listing_venues: venues, security_type: directShares && capital.security.security_type === "unknown" ? "foreign_ordinary_share" : capital.security.security_type, claim_ids: [...new Set([...capital.security.claim_ids, claimId])] };
  records.push(evidenceRecord({ id: "evidence-sec-reporting-identity", category: "security_and_listing", date: source.row.filed, text, sourceId, cik: capital.issuer.cik, ticker: capital.security.ticker }));
  const sourceText = texts.find((item) => item.row.accession === source.row.accession)?.text ?? "";
  const frameworkMatch = /IFRS Accounting Standards as issued by (?:the )?International Accounting Standards Board|International Financial Reporting Standards as issued by (?:the )?IASB|(?:prepared|presented) in accordance with (?:United States|U\.S\.) generally accepted accounting principles|\bU\.S\. GAAP\b/i.exec(sourceText);
  return [{ foreign_filer_source: foreign ? source.row.accession : null, filing_regime_source: filingRegime !== "unknown" ? source.row.accession : null, accounting_framework_source: ifrs || usGaap ? source.row.accession : null, accounting_framework_text_range: frameworkMatch ? { start: frameworkMatch.index, end: frameworkMatch.index + frameworkMatch[0].length } : null, accounting_framework: capital.issuer.accounting_basis, security_structure_source: directShares || ads ? source.row.accession : null, primary_venue: capital.security.listing_venue, additional_venues: venues, promoted_properties: { foreign_private_issuer: capital.issuer.foreign_private_issuer, filing_regime: filingRegime, accounting_basis: capital.issuer.accounting_basis, accounting_authority: capital.issuer.accounting_authority, presentation_currency: currency, security_structure: capital.security.security_structure, depositary_ratio: null } }];
}

function complianceRule(item) {
  if (/5550\s*\(a\)\s*\(2\)|minimum bid/i.test(item.statement)) return "nasdaq_5550_a_2_minimum_bid";
  if (/5550\s*\(b\)\s*\(1\)|stockholders['’]? equity/i.test(item.statement)) return "nasdaq_5550_b_1_stockholders_equity";
  return `other:${item.accession}`;
}

function applyExtractedFindings(fragments, findings, retrievedAt, records, corporateActionDiagnostics = [], listingComplianceDiagnostics = []) {
  const byDomain = { capital: [], catalyst: [], financial: [] };
  for (const finding of findings) {
    const domain = ["reverse_splits", "dilution_offerings", "warrants_convertibles"].includes(finding.category) ? "capital" : finding.category === "catalysts_news" || finding.category === "compliance" ? "catalyst" : "financial";
    byDomain[domain].push(finding);
  }
  for (const [domain, domainFindings] of Object.entries(byDomain)) {
    const fragment = fragments[domain]; if (!fragment || domainFindings.length === 0) continue;
    const grouped = new Map();
    domainFindings.forEach((finding, index) => {
      const key = `${finding.accession}:${finding.document}`; const claimId = `claim-extracted-${finding.accession.replaceAll("-", "")}-${finding.kind}-${index + 1}`; const sourceId = `source-sec-document-${domain}-${finding.accession.replaceAll("-", "")}-${String(finding.document).replace(/[^a-z0-9]/gi, "").slice(-20)}`;
      finding.claimId = claimId; finding.sourceId = sourceId;
      const findingDate = finding.event_date ?? finding.source_filing_date;
      fragment.claims.push({ id: claimId, text: finding.statement, materiality: ["reverse_split", "going_concern", "accounting_warning", "non_reliance", "exchange_compliance", "working_capital_deficit", "debt_maturity"].includes(finding.kind) ? "high" : "medium", state: finding.evidence_state, as_of: `${findingDate}T00:00:00Z`, source_ids: [sourceId] });
      if (!grouped.has(key)) grouped.set(key, { finding, sourceId, claimIds: [] }); grouped.get(key).claimIds.push(claimId);
      records.push(evidenceRecord({ id: `evidence-extracted-${finding.accession}-${finding.kind}-${index + 1}`, category: finding.category, state: finding.evidence_state, date: findingDate, text: finding.statement, sourceId, cik: fragment.identity.cik, ticker: fragment.identity.ticker }));
    });
    for (const { finding, sourceId, claimIds } of grouped.values()) fragment.sources.push({ id: sourceId, title: finding.source_title, url: finding.source_url, published_date: finding.source_filing_date ?? finding.event_date, source_type: "sec_filing", confidence: finding.confidence, retrieved_at: retrievedAt, supported_claim_ids: claimIds });
  }
  const capital = fragments.capital; const reverseCandidates = byDomain.capital.filter((item) => item.kind === "reverse_split");
  const filingSupport = reverseCandidates.filter((item) => item.canonical_support_only === true && item.date_role === "filing_date" && item.filing_reference_date);
  const diagnosticFor = (finding) => corporateActionDiagnostics.find((candidate) => candidate.occurrence_id && candidate.occurrence_id === finding?.occurrence_id)
    ?? corporateActionDiagnostics.find((candidate) => candidate.source_accession === finding?.accession && candidate.local_text_span_id === finding?.local_text_span_id);
  // Extraction is the first acceptance gate; canonicalization independently
  // enforces the same invariant so a diagnostic-only ambiguity can never be
  // promoted into user-facing completed history.
  const reverse = reverseCandidates.filter((item) => {
    if (item.canonical_support_only === true) return false;
    const diagnostic = diagnosticFor(item);
    if (diagnostic?.canonical_acceptance_invariant_passed === true && diagnostic?.issuer_identity_match === true) return true;
    if (diagnostic) { diagnostic.disposition = "withheld"; diagnostic.canonical_event_id = null; diagnostic.reason = diagnostic.canonical_validation_reason ?? "canonical_acceptance_invariant_failed"; }
    return false;
  });
  const dilution = byDomain.capital.filter((item) => ["offering", "warrant", "convertible"].includes(item.kind));
  const lineageClaimsAt = (date) => capital?.issuer?.prior_identities?.filter((identity) => identity.linkage_state === "confirmed" && identity.effective_from <= date && date <= identity.effective_to).flatMap((identity) => identity.claim_ids) ?? [];
  const datedSplitGroups = new Map(); const undatedSplits = [];
  for (const item of reverse) {
    const actionDate = item.effective_date ?? item.completed_date ?? item.event_date;
    if (!item.ratio || !actionDate) { undatedSplits.push(item); continue; }
    const key = `${item.ratio}:${actionDate}`;
    if (!datedSplitGroups.has(key)) datedSplitGroups.set(key, []); datedSplitGroups.get(key).push(item);
  }
  // Attach undated lifecycle/corroboration only when one dated event of that
  // ratio exists. Ambiguous undated mentions remain packet diagnostics and are
  // not promoted to user-facing corporate actions.
  const keysByRatio = new Map();
  for (const key of datedSplitGroups.keys()) { const ratio = key.split(":")[0]; if (!keysByRatio.has(ratio)) keysByRatio.set(ratio, []); keysByRatio.get(ratio).push(key); }

  // A certificate/amendment filing date is provenance, not a completed action
  // date. Reconcile it only to one same-ratio effective/completion event inside
  // a tightly bounded window; otherwise retain it as diagnostic-only evidence.
  // This avoids both the Verification-5 duplicate and over-merging MULN's
  // genuinely separate, repeated-ratio actions.
  const calendarDistance = (left, right) => Math.abs(new Date(`${left}T00:00:00Z`) - new Date(`${right}T00:00:00Z`)) / 86_400_000;
  for (const item of filingSupport) {
    const diagnostic = diagnosticFor(item);
    const matches = (keysByRatio.get(item.ratio) ?? []).filter((key) => {
      const actionDate = key.slice(key.indexOf(":") + 1);
      const group = datedSplitGroups.get(key) ?? [];
      const hasEventDateRole = group.some((candidate) => ["effective_date", "completion_date", "trading_effective_date", "scheduled_effective_date"].includes(candidate.date_role));
      return hasEventDateRole && calendarDistance(item.filing_reference_date, actionDate) <= 7;
    });
    if (matches.length !== 1) {
      if (diagnostic) {
        diagnostic.disposition = "withheld";
        diagnostic.reason = matches.length === 0 ? "filing_reference_has_no_nearby_effective_event" : "filing_reference_matches_multiple_effective_events";
        diagnostic.merge_reason = diagnostic.reason;
        diagnostic.filing_vs_effective_reconciliation = matches.length === 0 ? "no_effective_match" : "ambiguous_effective_match";
      }
      continue;
    }
    const targetKey = matches[0]; const targetDate = targetKey.slice(targetKey.indexOf(":") + 1);
    datedSplitGroups.get(targetKey).push(item);
    if (diagnostic) {
      diagnostic.disposition = "merged";
      diagnostic.canonical_chosen_event_date = targetDate;
      diagnostic.merge_target = targetKey;
      diagnostic.merge_reason = "same_ratio_filing_reference_reconciled_to_effective_event";
      diagnostic.filing_vs_effective_reconciliation = "merged_to_effective_event";
      diagnostic.reason = diagnostic.merge_reason;
    }
  }
  for (const item of undatedSplits) {
    const matches = keysByRatio.get(item.ratio) ?? [];
    if (matches.length === 1) datedSplitGroups.get(matches[0]).push(item);
  }
  // An undated occurrence cannot establish a user-facing corporate action on
  // its own. It may corroborate one unambiguous dated event of the same ratio;
  // otherwise it remains diagnostic-only.
  const splitGroups = [...datedSplitGroups.values()];
  const normalizedSplits = splitGroups.map((group) => {
    const preferred = [...group].sort((a, b) => ({ completed: 5, cancelled: 4, scheduled: 3, authorized: 2, proposed: 1, unknown: 0 }[b.action_state] ?? 0) - ({ completed: 5, cancelled: 4, scheduled: 3, authorized: 2, proposed: 1, unknown: 0 }[a.action_state] ?? 0))[0];
    const dated = group.find((item) => item.effective_date || item.completed_date || item.event_date);
    return { ...preferred, effective_date: dated?.effective_date ?? dated?.completed_date ?? dated?.event_date ?? null, completed_date: dated?.completed_date ?? null, event_date: dated?.effective_date ?? dated?.completed_date ?? dated?.event_date ?? null, lifecycle_states: [...new Set(group.map((item) => item.action_state))], claimIds: [...new Set(group.map((item) => item.claimId))] };
  }).sort((a, b) => String(a.effective_date ?? a.completed_date ?? a.source_filing_date).localeCompare(String(b.effective_date ?? b.completed_date ?? b.source_filing_date)));
  normalizedSplits.forEach((item, index) => {
    const canonicalEventId = `reverse-split-${index + 1}`;
    for (const claimId of item.claimIds) {
      const finding = reverseCandidates.find((candidate) => candidate.claimId === claimId);
      const diagnostic = diagnosticFor(finding);
      if (!diagnostic) continue;
      diagnostic.canonical_event_id = canonicalEventId;
      diagnostic.canonical_chosen_event_date = item.event_date;
      diagnostic.merge_target = canonicalEventId;
      if (finding?.canonical_support_only === true) {
        diagnostic.disposition = "merged";
        diagnostic.merge_reason = "same_ratio_filing_reference_reconciled_to_effective_event";
        diagnostic.filing_vs_effective_reconciliation = "merged_to_effective_event";
        diagnostic.reason = diagnostic.merge_reason;
      } else {
        diagnostic.disposition = item.claimIds[0] === claimId ? "accepted" : "merged";
        diagnostic.reason = item.claimIds[0] === claimId ? "canonical_event_created" : "corroborating_occurrence_merged";
      }
    }
  });
  for (const diagnostic of corporateActionDiagnostics.filter((item) => item.disposition === "accepted" && !item.canonical_event_id)) {
    diagnostic.disposition = "withheld"; diagnostic.reason = "undated_or_ambiguous_occurrence_not_promoted";
  }
  if (capital && normalizedSplits.length) capital.reverse_splits = { state: "limited_coverage", summary: `Canonical filing evidence identifies ${normalizedSplits.length} distinct reverse-split action${normalizedSplits.length === 1 ? "" : "s"} in the bounded reviewed window; repeated disclosures are linked as lifecycle or corroborating evidence.`, coverage_notes: ["Fast opens a bounded set of corporate-action filings and does not prove a complete five-year history.", ...(undatedSplits.length ? [`${undatedSplits.length} undated raw split mention(s) were reconciled or withheld rather than presented as additional completed events.`] : [])], items: normalizedSplits.map((item, index) => { const eventDate = item.effective_date ?? item.completed_date ?? null; return ({ id: `reverse-split-${index + 1}`, kind: "reverse_split", title: item.title, state: "confirmed", summary: item.statement, event_date: eventDate, source_filing_date: item.source_filing_date, announced_date: item.announced_date, effective_date: item.effective_date, completed_date: item.completed_date, corporate_action_state: item.action_state, claim_ids: [...item.claimIds, ...lineageClaimsAt(eventDate ?? item.source_filing_date)] }); }), claim_ids: [...new Set(normalizedSplits.flatMap((item) => [...item.claimIds, ...lineageClaimsAt(item.effective_date ?? item.completed_date ?? item.source_filing_date)]))] };
  if (capital && dilution.length) capital.dilution = { state: "limited_coverage", summary: "Bounded filing text identified financing instruments or capacity; only explicit completed or agreed issuances are labeled actual.", coverage_notes: ["Unopened filings and unextracted share-count terms remain outside Fast coverage."], items: dilution.map((item, index) => ({ id: `dilution-extracted-${index + 1}`, kind: item.kind, title: item.title, state: item.evidence_state, summary: item.statement, event_date: item.event_date, ...(item.value !== null && item.value !== undefined ? { value: item.value, unit: item.unit } : {}), claim_ids: [item.claimId, ...lineageClaimsAt(item.event_date)] })), claim_ids: [...new Set(dilution.flatMap((item) => [item.claimId, ...lineageClaimsAt(item.event_date)]))] };
  if (capital && capital.security.security_type === "unknown") {
    const securityTypeEvidence = byDomain.capital.find((item) => /\b(?:issued and outstanding|shares? of (?:the (?:company|issuer)'?s? )?|(?:our|its|the company'?s) )common stock\b/i.test(item.statement));
    if (securityTypeEvidence) capital.security = { ...capital.security, security_type: "common_stock", evidence_state: "confirmed", claim_ids: [...new Set([...capital.security.claim_ids, securityTypeEvidence.claimId])] };
  }
  const catalyst = fragments.catalyst; const compliance = byDomain.catalyst.filter((item) => item.kind === "exchange_compliance"); const events = byDomain.catalyst.filter((item) => item.kind === "catalyst");
  if (catalyst && compliance.length) {
    const expandedCompliance = compliance.flatMap((item) => {
      const rules = [[/5550\s*\(a\)\s*\(2\)|minimum bid/i, "nasdaq_5550_a_2_minimum_bid"], [/5550\s*\(b\)\s*\(1\)|stockholders['’]? equity/i, "nasdaq_5550_b_1_stockholders_equity"]].filter(([pattern]) => pattern.test(item.statement)).map(([, rule]) => rule);
      return rules.length > 1 ? rules.map((rule) => ({ ...item, normalized_compliance_rule: rule })) : [item];
    });
    const groupedCompliance = new Map();
    for (const item of expandedCompliance) { const key = item.normalized_compliance_rule ?? complianceRule(item); if (!groupedCompliance.has(key)) groupedCompliance.set(key, []); groupedCompliance.get(key).push(item); }
    const reconciled = [];
    for (const [rule, group] of groupedCompliance) {
      const ordered = [...group].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)) || (b.resolution_state === "resolved" ? 1 : -1));
      const current = ordered[0];
      ordered.forEach((item, index) => {
        const state = index === 0 ? item.resolution_state : "historical";
        reconciled.push({ ...item, resolution_state: state, title: state === "historical" ? "Historical exchange compliance event" : item.title });
        listingComplianceDiagnostics.push({ rule, venue: /NYSE/i.test(item.statement) ? "NYSE" : "Nasdaq", event_date: item.event_date, lifecycle_event: item.resolution_state === "resolved" ? "matter_closed" : "deficiency_opened", superseded_event_id: index ? `${rule}:${current.event_date}` : null, current_state: current.resolution_state, reconciliation_reason: index ? "newer_same_rule_authoritative_event_supersedes" : "newest_authoritative_event_for_rule", claim_id: item.claimId });
      });
    }
    const active = reconciled.filter((item) => item.resolution_state === "active");
    const resolved = reconciled.filter((item) => item.resolution_state === "resolved");
    const hasTerminalStatus = capital?.security?.listing_status === "delisted" || /^(OTC|OTCID)/i.test(capital?.security?.listing_venue ?? "");
    const currentContext = hasTerminalStatus ? `${capital.security.ticker} is currently ${capital.security.listing_status} and trades in ${capital.security.listing_venue}; prior exchange deficiencies are historical context, not an active current-exchange warning.` : active.length ? `Selected filings contain ${active.length} active current exchange-compliance condition(s); ${resolved.length} separately resolved condition(s) remain historical context.` : "Selected filings contain resolved historical exchange-compliance evidence; no active deficiency is inferred from it.";
    catalyst.compliance_and_warnings = { state: "limited_coverage", summary: currentContext, coverage_notes: ["Fast does not exhaustively search exchange notices or older filings."], items: reconciled.map((item, index) => ({ id: `compliance-${index + 1}`, kind: "exchange_compliance", title: hasTerminalStatus ? "Historical exchange compliance event" : item.title, state: "confirmed", summary: hasTerminalStatus || item.resolution_state === "historical" ? `Historical ${item.statement}` : item.statement, event_date: item.event_date, resolution_state: hasTerminalStatus ? "historical" : item.resolution_state, claim_ids: [item.claimId, ...lineageClaimsAt(item.event_date)] })), claim_ids: [...new Set(reconciled.flatMap((item) => [item.claimId, ...lineageClaimsAt(item.event_date)]))] };
    const terminalEvidence = [...compliance].filter((item) => /(?:trading|securities).{0,160}(?:suspend|delist)|(?:commence|began|continue).{0,120}(?:OTCID|OTC Pink|OTC Expert Market)/i.test(item.statement)).sort((a, b) => b.event_date.localeCompare(a.event_date))[0];
    if (capital && terminalEvidence) {
      const venue = /OTC Expert Market/i.test(terminalEvidence.statement) ? "OTC Expert Market" : /OTC Pink/i.test(terminalEvidence.statement) ? "OTC Pink" : /OTCID/i.test(terminalEvidence.statement) ? "OTCID" : capital.security.listing_venue;
      const authoritativeCommonStock = /\b(?:shares? of )?common stock\b/i.test(terminalEvidence.statement);
      const securityType = capital.security.security_type === "unknown" && authoritativeCommonStock ? "common_stock" : capital.security.security_type;
      capital.security = { ...capital.security, security_type: securityType, listing_venue: venue, listing_status: "delisted", evidence_state: securityType === "unknown" ? "limited_coverage" : "confirmed", claim_ids: [...new Set([...capital.security.claim_ids, terminalEvidence.claimId, ...lineageClaimsAt(terminalEvidence.event_date)])] };
    }
  }
  if (catalyst && events.length) { const item = events[0]; catalyst.catalyst_assessment.current = { state: "confirmed", classification: normalizeCatalystClassification(item.classification), title: item.title, event_date: item.event_date, summary: item.statement, confidence: "high", claim_ids: [item.claimId], factors: { recency: { rating: "high", explanation: "The event appears in a filing within the bounded recent window.", claim_ids: [item.claimId] }, specificity: { rating: "medium", explanation: "The filing provides a specific material-event statement.", claim_ids: [item.claimId] }, credibility: { rating: "high", explanation: "The statement comes directly from an SEC filing.", claim_ids: [item.claimId] }, novelty: factor("Novelty"), potential_significance: factor("Potential significance") } }; catalyst.catalyst_assessment.uncertainty = ["Fast does not add market context or secondary corroboration."]; }
  const financial = fragments.financial; const warnings = byDomain.financial.filter((item) => ["going_concern", "bankruptcy", "accounting_warning", "non_reliance", "working_capital_deficit", "debt_maturity", "late_annual_filing"].includes(item.kind));
  if (financial && warnings.length) {
    const going = warnings.find((item) => item.kind === "going_concern"); if (going) financial.financial_assessment.going_concern = { state: "confirmed", as_of: going.event_date, summary: going.statement, claim_ids: [going.claimId] };
    financial.financial_assessment.material_warnings.push(...warnings.map((item, index) => ({ id: `financial-filing-warning-${index + 1}`, kind: ["accounting_warning", "non_reliance"].includes(item.kind) ? "accounting" : item.kind === "going_concern" ? "going_concern" : "other", state: "confirmed", severity: item.severity, title: item.title, as_of: item.event_date, summary: item.statement, claim_ids: [item.claimId] })));
    const invalidity = warnings.find((item) => item.kind === "non_reliance");
    if (invalidity) {
      for (const key of ["revenue", "profitability", "operating_cash_flow", "free_cash_flow", "cash_burn"]) {
        const metric = financial.financial_assessment.metrics[key]; if (!metric) continue;
        metric.state = "limited_coverage"; metric.value = null; metric.unit = null; metric.trend = "unknown"; metric.observations = []; metric.annual_observations = [];
        metric.summary = `This historical flow metric is not scored because a newer SEC non-reliance or restatement event may affect the reported periods.`;
        metric.claim_ids = [...new Set([...(metric.claim_ids ?? []), invalidity.claimId])];
      }
      financial.financial_assessment.coverage_notes.push("A recent SEC non-reliance/restatement event invalidates affected historical flow scoring until corrected comparable statements are available.");
    }
  }

  const splitActions = findings.filter((item) => ["reverse_split", "stock_split"].includes(item.kind) && item.action_state === "completed" && Number.isFinite(item.split_factor));
  const shares = financial?.financial_assessment?.shares_outstanding;
  if (shares?.state === "confirmed" && shares.observations.length > 1) {
    for (const observation of shares.observations) {
      const factor = splitActions.filter((item) => item.event_date > observation.period_end).reduce((product, item) => product * item.split_factor, 1);
      observation.value = Math.round(observation.value * factor);
    }
    shares.annual_observations = shares.observations;
    const first = shares.observations[0]; const latest = shares.observations.at(-1); const ratio = latest.value / first.value;
    if (!splitActions.length && (ratio >= 4 || ratio <= .25)) {
      shares.state = "limited_coverage";
      shares.summary = "Reported share counts contain a large unexplained discontinuity; Fast does not label it dilution without a confirmed split-adjustment basis.";
      shares.observations = [];
      shares.annual_observations = [];
    } else {
      const change = (latest.value - first.value) / first.value * 100;
      shares.summary = `${splitActions.length ? "Split-adjusted reported" : "Reported"} shares outstanding ${change >= 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(1)}% over the displayed period from ${first.period_end} to ${latest.period_end}.`;
    }
  }
  return corporateActionDiagnostics;
}

export function createSecEvidenceClient({ fetchImpl = globalThis.fetch, now = () => Date.now(), userAgent = DEFAULT_USER_AGENT, minRequestIntervalMs = 125, logger = console } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  const cache = new Map(); const inFlight = new Map(); let nextRequestAt = 0; let requestQueue = Promise.resolve(); const packets = new Map();
  const cachedJson = async (key, url, ttl, { phase, endpointCategory, requestCounter, format = "json", budget }) => {
    budget?.checkTime();
    if (budget?.signal.aborted) throw budget.signal.reason;
    const hit = cache.get(key); if (hit && hit.expiresAt > now()) { budget?.recordSource(`sec:${key}`, "completed", { endpoint_category: endpointCategory, cache_state: "hit", cost_usd: 0 }); return { data: hit.data, cache: "hit" }; }
    if (inFlight.has(key)) { const data = await awaitWithSignal(inFlight.get(key), budget?.signal); budget?.recordSource(`sec:${key}`, "completed", { endpoint_category: endpointCategory, cache_state: "shared", cost_usd: 0 }); return { data, cache: "shared" }; }
    const request = requestQueue.then(async () => {
      budget?.checkTime();
      const wait = Math.max(0, nextRequestAt - now()); if (wait) await abortableDelay(wait, budget?.signal); nextRequestAt = now() + minRequestIntervalMs;
      const requestStarted = now(); requestCounter.count += 1; let response;
      try {
        budget?.recordSource(`sec:${key}`, "in_progress", { endpoint_category: endpointCategory });
        response = await fetchImpl(url, { signal: budget?.signal, headers: { "User-Agent": userAgent, Accept: format === "text" ? "text/html,text/plain;q=0.9,*/*;q=0.8" : "application/json", "Accept-Encoding": "gzip, deflate" } });
        if (!response.ok) throw new SecRetrievalError("SEC returned an unsuccessful status", { status: response.status, responseReceived: true });
        const data = format === "text" ? await response.text() : await response.json(); cache.set(key, { data, expiresAt: now() + ttl }); return data;
      } catch (error) {
        if (error instanceof SecRetrievalError) {
          Object.assign(error, { phase, endpointCategory, elapsedMs: now() - requestStarted, cacheState: "miss", requestCount: requestCounter.count });
          throw error;
        }
        throw new SecRetrievalError("SEC request could not be completed", { phase, endpointCategory, elapsedMs: now() - requestStarted, responseReceived: Boolean(response), cacheState: "miss", requestCount: requestCounter.count }, error);
      }
    });
    requestQueue = request.catch(() => undefined);
    inFlight.set(key, request); try {
      const data = await awaitWithSignal(request, budget?.signal);
      budget?.recordSource(`sec:${key}`, "completed", { endpoint_category: endpointCategory, cost_usd: 0 });
      return { data, cache: "miss" };
    } finally { inFlight.delete(key); }
  };
  return {
    getPacket(ticker) { return packets.get(ticker) ?? null; },
    async researchTicker(ticker, { onProgress, budget } = {}) {
      const started = now(); const retrievedAt = new Date(now()).toISOString(); const records = []; const cacheStatus = {}; const requestCounter = { count: 0 }; const failures = []; let firstUseful = null; const results = {};
      const retrieve = async (key, url, ttl, phase, endpointCategory, format = "json") => {
        try { return await cachedJson(key, url, ttl, { phase, endpointCategory, requestCounter, format, budget }); }
        catch (error) {
          const timedOut = budget?.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
          budget?.recordSource(`sec:${key}`, timedOut ? "timed_out" : "failed", { endpoint_category: endpointCategory });
          const diagnostic = getSafeSecDiagnostics(error, { phase, endpointCategory, elapsedMs: now() - started, requestCount: requestCounter.count }); failures.push(diagnostic); logger.error(`SEC retrieval failed for ${ticker} ${JSON.stringify(diagnostic)}`); return null;
        }
      };
      const tickerResult = await retrieve("tickers", TICKER_URL, CACHE_TTL_MS.tickers, "sec_ticker_map_request", "ticker_map");
      if (!tickerResult) return { report: assembleFastReport(ticker, {}, { generatedAt: retrievedAt, final: true, terminalReason: "sec_unavailable" }), operations: { ...buildResearchOperations({ stage: "fast", latencyMs: now() - started, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: "limited" }])) }), retrieval: { status: "unavailable", reason: "sec_unavailable", sec_request_count: requestCounter.count, cache: { tickers: "miss" }, failures } }, evidence_records: [], synthesis: { status: "unavailable", reason: "sec_unavailable" } };
      cacheStatus.tickers = tickerResult.cache;
      const fields = tickerResult.data.fields ?? ["cik", "name", "ticker", "exchange"]; const entries = (tickerResult.data.data ?? Object.values(tickerResult.data)).map((row) => Array.isArray(row) ? Object.fromEntries(fields.map((field, index) => [field, row[index]])) : row);
      let match = entries.find((entry) => String(entry.ticker).toUpperCase() === ticker);
      const historicalIdentity = match ? null : resolveBoundedHistoricalIdentity(ticker);
      if (historicalIdentity) match = { cik: historicalIdentity.cik, name: historicalIdentity.legal_name, ticker: historicalIdentity.current_ticker, exchange: historicalIdentity.listing_venue };
      if (!match) return { report: assembleFastReport(ticker, {}, { generatedAt: retrievedAt, final: true, terminalReason: "identity_unresolved" }), operations: { ...buildResearchOperations({ stage: "fast", latencyMs: now() - started, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: "limited" }])) }), retrieval: { status: "limited", reason: "identity_unresolved", sec_request_count: requestCounter.count, cache: cacheStatus, failures } }, evidence_records: [], synthesis: { status: "unavailable", reason: "identity_unresolved" } };
      const cik = String(match.cik ?? match.cik_str).padStart(10, "0");
      const submissionResult = await retrieve(`submissions:${cik}`, `${SEC_BASE}/submissions/CIK${cik}.json`, CACHE_TTL_MS.issuer, "sec_submissions_request", "submissions"); if (submissionResult) cacheStatus.submissions = submissionResult.cache;
      const submissions = submissionResult?.data ?? { name: match.name, filings: { recent: {} } };
      assertIssuerIdentity(cik, submissions, null);
      const capitalBase = identityFragment(ticker, { ...match, cik }, submissions, retrievedAt, records, historicalIdentity); results.capital = { fragment: capitalBase }; firstUseful = now() - started;
      const publish = async (final = false) => { if (onProgress) await onProgress({ report: assembleFastReport(ticker, results, { generatedAt: retrievedAt }), operations: operations(final), evidence_records: structuredClone(records), final }); };
      const operations = () => ({ ...buildResearchOperations({ stage: "fast", latencyMs: now() - started, firstUsefulLatencyMs: firstUseful, usage: null, webSearchCalls: 0, domains: Object.fromEntries(Object.keys(FAST_DOMAINS).map((key) => [key, { status: results[key]?.fragment ? "completed" : budget?.isStopped() ? "limited" : "pending" }] )) }), retrieval: { status: "in_progress", sec_request_count: requestCounter.count, cache: cacheStatus, failures }, ...(budget ? { budget: budget.telemetry() } : {}) });
      await publish(false);
      const factsPromise = retrieve(`facts:${cik}`, `${SEC_BASE}/api/xbrl/companyfacts/CIK${cik}.json`, CACHE_TTL_MS.issuer, "sec_companyfacts_request", "companyfacts");
      const historyResults = await Promise.all(historicalSubmissionFiles(submissions, retrievedAt).map((file) => retrieve(`submissions-history:${cik}:${file.name}`, `${SEC_BASE}/submissions/${file.name}`, CACHE_TTL_MS.issuer, "sec_historical_submissions_request", "submissions_history")));
      const historicalRows = historyResults.filter(Boolean).flatMap((result) => filingRows({ filings: { recent: result.data } }));
      const rows = [...new Map([...filingRows(submissions), ...historicalRows, ...(historicalIdentity?.seed_filings ?? [])].map((row) => [row.accession, row])).values()]; results.capital = { fragment: capitalFromFilings(capitalBase, rows, retrievedAt, records) }; results.catalyst = { fragment: catalystFragment(capitalBase.identity, rows, retrievedAt, records) }; await publish(false);
      const ntSelection = selectRelevantNtFiling(rows, retrievedAt);
      const documentRows = boundedDocumentRows(rows, retrievedAt);
      cacheStatus.documents = [];
      const documentPromises = documentRows.map(async (row) => {
        const url = accessionUrl(cik, row.accession, row.document);
        const result = await retrieve(`document:${row.accession}:${row.document}`, url, CACHE_TTL_MS.issuer, "sec_filing_document_request", "filing_document", "text");
        if (result) cacheStatus.documents.push({ accession: row.accession, document: row.document, state: result.cache });
        return result ? { row, url, html: result.data } : null;
      });
      const factsResult = await factsPromise; if (factsResult) { assertIssuerIdentity(cik, submissions, factsResult.data); cacheStatus.companyfacts = factsResult.cache; results.financial = { fragment: financialFragment(capitalBase.identity, factsResult.data, retrievedAt, records) }; }
      const documents = (await Promise.all(documentPromises)).filter(Boolean); const corporateActionDiagnostics = []; const ntFilingDiagnostics = [...ntSelection.diagnostics];
      const findings = documents.flatMap(({ row, url, html }) => { const extracted = extractSecFilingEvidenceWithDiagnostics({ html, form: row.form, filed: row.filed, reportDate: row.reportDate, accession: row.accession, documentUrl: url, documentName: row.document, evaluatedAt: retrievedAt }); corporateActionDiagnostics.push(...extracted.corporate_action_diagnostics); ntFilingDiagnostics.push(...extracted.nt_filing_diagnostics); return extracted.findings; });
      for (const [index, action] of (historicalIdentity?.completed_corporate_actions ?? []).entries()) {
        const occurrenceId = `${action.accession}:${action.document}:registry-completed-action:${index + 1}`;
        findings.push({ kind: action.kind, category: "reverse_splits", title: `Completed ${action.ratio} reverse split`, statement: action.description, event_date: action.effective_date, source_filing_date: action.filed, announced_date: null, effective_date: action.effective_date, completed_date: action.effective_date, accession: action.accession, document: action.document, source_url: accessionUrl(cik, action.accession, action.document), source_title: `${action.form} filed ${action.filed} — ${action.document}`, confidence: "high", evidence_state: "confirmed", ratio: action.ratio, split_factor: action.split_factor, action_state: "completed", date_role: "effective_date", date_role_evidence: "authoritative_retrospective_history", canonical_support_only: false, local_text_span_id: `registry-completed-action-${index + 1}`, occurrence_id: occurrenceId });
        corporateActionDiagnostics.push({ source_accession: action.accession, source_document: action.document, filing_form: action.form, occurrence_id: occurrenceId, local_text_span_id: `registry-completed-action-${index + 1}`, extracted_ratio: action.ratio, extracted_status: "completed", extracted_effective_date: action.effective_date, extracted_date: action.effective_date, date_role: "effective_date", date_role_evidence: "authoritative_retrospective_history", date_role_evidence_strength: 5, source_filing_date: action.filed, authorization_accession: action.authorization_accession, canonical_acceptance_invariant_passed: true, issuer_identity_match: true, disposition: "accepted", reason: "owner_reviewed_authoritative_retrospective_history", canonical_event_id: null });
      }
      const exhibitCandidates = documents.filter(({ row, url, html }) => CATALYST_FORMS.has(row.form) && findMaterialExhibitUrl(html, url) && (/(?:3\.01|4\.02|5\.03)/.test(row.items) || !findings.some((finding) => finding.accession === row.accession && ["catalyst", "reverse_split", "non_reliance", "exchange_compliance"].includes(finding.kind)))).slice(0, 3);
      for (const exhibitCandidate of exhibitCandidates) {
        if (budget?.isStopped()) break;
        const exhibitUrl = findMaterialExhibitUrl(exhibitCandidate.html, exhibitCandidate.url); const exhibitName = new URL(exhibitUrl).pathname.split("/").at(-1);
        const exhibit = await retrieve(`document:${exhibitCandidate.row.accession}:${exhibitName}`, exhibitUrl, CACHE_TTL_MS.issuer, "sec_filing_exhibit_request", "filing_exhibit", "text");
        if (exhibit) { cacheStatus.documents.push({ accession: exhibitCandidate.row.accession, document: exhibitName, state: exhibit.cache }); const extracted = extractSecFilingEvidenceWithDiagnostics({ html: exhibit.data, form: exhibitCandidate.row.form, filed: exhibitCandidate.row.filed, reportDate: exhibitCandidate.row.reportDate, accession: exhibitCandidate.row.accession, documentUrl: exhibitUrl, documentName: exhibitName, evaluatedAt: retrievedAt }); findings.push(...extracted.findings); corporateActionDiagnostics.push(...extracted.corporate_action_diagnostics); ntFilingDiagnostics.push(...extracted.nt_filing_diagnostics); }
      }
      const reportingIdentityDiagnostics = promoteIssuerReportingProperties(results.capital.fragment, documents, retrievedAt, records);
      const listingComplianceDiagnostics = [];
      const normalizedCorporateActionDiagnostics = applyExtractedFindings(Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.fragment])), compactFindings(findings), retrievedAt, records, corporateActionDiagnostics, listingComplianceDiagnostics);
      const packetSources = [...new Map(Object.values(results).flatMap((result) => result.fragment?.sources ?? []).map((source) => [source.id, source])).values()];
      const securityTypeFinding = findings.find((finding) => finding.claimId && results.capital.fragment.security.claim_ids.includes(finding.claimId));
      const promoted = results.capital.fragment;
      const packet = { ticker, identity: capitalBase.identity, identity_resolution: { requested_ticker: ticker, current_ticker: historicalIdentity?.current_ticker ?? ticker, status: historicalIdentity?.identity_status ?? "current", current_ticker_effective_from: historicalIdentity?.current_ticker_effective_from ?? null, listing_effective_from: historicalIdentity?.listing_effective_from ?? null, filer_jurisdiction: promoted.issuer.jurisdiction ?? historicalIdentity?.filer_jurisdiction ?? null, filer_regime: promoted.issuer.filing_regime ?? historicalIdentity?.filer_regime ?? null, accounting_standard: promoted.issuer.accounting_basis ?? historicalIdentity?.accounting_standard ?? null, source_url: historicalIdentity?.source_url ?? TICKER_URL, security_type_resolution: { status: results.capital.fragment.security.security_type === "unknown" ? "limited" : "resolved", security_type: results.capital.fragment.security.security_type, basis: securityTypeFinding ? "identity_gated_selected_filing" : historicalIdentity?.security_type ? "reviewed_historical_identity" : "unresolved", source_accession: securityTypeFinding?.accession ?? null, claim_id: securityTypeFinding?.claimId ?? null } }, retrieved_at: retrievedAt, records: structuredClone(records), sources: packetSources, normalization_diagnostics: structuredClone(results.financial?.fragment?.normalization_diagnostics ?? []), reporting_identity_diagnostics: structuredClone(reportingIdentityDiagnostics), listing_compliance_diagnostics: structuredClone(listingComplianceDiagnostics), corporate_action_diagnostics: structuredClone(normalizedCorporateActionDiagnostics), nt_filing_diagnostics: structuredClone(ntFilingDiagnostics), cache: cacheStatus, sec_request_count: requestCounter.count }; packets.set(ticker, packet);
      const stopped = budget?.isStopped() === true;
      if (stopped || failures.length) budget?.markPartial();
      return { report: assembleFastReport(ticker, results, { generatedAt: retrievedAt, final: true }), operations: { ...operations(true), retrieval: { status: stopped || failures.length ? "limited" : "completed", sec_request_count: requestCounter.count, cache: cacheStatus, failures }, ...(budget ? { budget: budget.telemetry({ final: true }) } : {}) }, evidence_records: records, evidence_packet: packet, synthesis: { status: "pending" } };
    }
  };
}
