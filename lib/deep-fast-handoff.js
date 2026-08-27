export const FAST_PACKET_FRESHNESS = Object.freeze({
  fast_moving_ms: 2 * 60 * 1000,
  core_ms: 5 * 60 * 1000
});

const unresolvedStates = new Set(["unknown", "limited_coverage", "pending"]);
const unique = (values) => [...new Set(values.filter(Boolean))];

export function assessFastSnapshot(snapshot, ticker, nowMs) {
  if (!snapshot) return { usable: false, status: "missing", age_ms: null, stale_components: ["all"] };
  const age = Math.max(0, Math.round(nowMs - snapshot.captured_at_ms));
  const identity = snapshot.packet?.identity;
  const report = snapshot.report;
  const identityMatches = identity?.ticker === ticker && report?.security?.ticker === ticker &&
    (!identity?.cik || !report?.issuer?.cik || identity.cik === report.issuer.cik);
  if (!identityMatches) return { usable: false, status: "identity_mismatch", age_ms: age, stale_components: ["identity"] };
  if (age > FAST_PACKET_FRESHNESS.core_ms) return { usable: false, status: "stale", age_ms: age, stale_components: ["sec", "exchange", "news", "market"] };
  if (age > FAST_PACKET_FRESHNESS.fast_moving_ms) return { usable: true, status: "partially_stale", age_ms: age, stale_components: ["exchange", "news", "market"] };
  return { usable: true, status: "fresh", age_ms: age, stale_components: [] };
}

export function hasSafeFastIdentity(report, packet, ticker) {
  if (!report || !packet || report.security?.ticker !== ticker || packet.identity?.ticker !== ticker) return false;
  if (report.issuer?.identity_state !== "confirmed") return false;
  if (report.issuer?.cik && packet.identity?.cik && report.issuer.cik !== packet.identity.cik) return false;
  return true;
}

export function buildDeepPriorityPlan(report) {
  const sourceById = new Map((report.sources ?? []).map((source) => [source.id, source]));
  const scoreKeys = Object.entries(report.scores ?? {}).filter(([, score]) => score.state !== "confirmed" || !Number.isFinite(score.value)).map(([key]) => key);
  const unresolvedSections = Object.entries(report.sections ?? {}).filter(([, section]) => unresolvedStates.has(section.state)).map(([key]) => key);
  const unresolvedMetrics = Object.entries(report.financial_assessment?.metrics ?? {}).filter(([, metric]) => unresolvedStates.has(metric.state)).map(([key]) => `financial:${key}`);
  const unresolvedClaims = (report.claims ?? []).filter((claim) => unresolvedStates.has(claim.state) || claim.state === "conflicting").map((claim) => claim.id);
  const lowConfidenceClaims = (report.claims ?? []).filter((claim) => claim.source_ids?.some((id) => ["low", "unknown"].includes(sourceById.get(id)?.confidence))).map((claim) => claim.id);
  const staleWarnings = (report.financial_assessment?.material_warnings ?? []).filter((warning) => /stale/i.test(`${warning.kind} ${warning.title} ${warning.summary}`)).map((warning) => warning.id);
  const missingHistory = [];
  if (report.issuer?.prior_identities?.some((identity) => identity.linkage_state !== "confirmed")) missingHistory.push("issuer_lineage");
  if (unresolvedStates.has(report.catalyst_assessment?.historical_analogues?.state)) missingHistory.push("historical_catalyst_analogues");
  if ((report.financial_assessment?.shares_outstanding?.observations?.length ?? 0) < 2) missingHistory.push("shares_outstanding_history");
  const components = unique([...scoreKeys, ...unresolvedSections, ...unresolvedMetrics, ...missingHistory]);
  return { score_keys: scoreKeys, unresolved_sections: unresolvedSections, unresolved_metrics: unresolvedMetrics, unresolved_claim_ids: unresolvedClaims, low_confidence_claim_ids: lowConfidenceClaims, stale_warning_ids: staleWarnings, missing_history: missingHistory, components };
}

export function createDeepSeed(snapshot, priorityPlan) {
  return {
    packet_version: "1.0.0",
    captured_at: snapshot.captured_at,
    identity: snapshot.packet.identity,
    evidence_records: snapshot.evidence_records ?? snapshot.packet.records ?? [],
    sources: snapshot.report.sources ?? snapshot.packet.sources ?? [],
    fast_report: snapshot.report,
    fast_operations: snapshot.operations,
    priority_plan: priorityPlan,
    instructions: {
      preserve_fast_claims_and_sources: true,
      new_ids_prefix: "deep-",
      resolve_priority_plan_first: true,
      explain_conflicts_and_revisions: true
    }
  };
}

function rewriteReferences(value, claimIds, sourceIds) {
  if (Array.isArray(value)) return value.map((item) => rewriteReferences(item, claimIds, sourceIds));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "claim_ids" || key === "supported_claim_ids") output[key] = item.map((id) => claimIds.get(id) ?? id);
    else if (key === "source_ids") output[key] = item.map((id) => sourceIds.get(id) ?? id);
    else output[key] = rewriteReferences(item, claimIds, sourceIds);
  }
  return output;
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const renamedId = (prefix, id, used) => {
  const base = `${prefix}${String(id).replace(/^(?:claim-|source-)/, "")}`; let candidate = base; let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  used.add(candidate); return candidate;
};

export function mergeDeepWithFast(fastReport, deepReport) {
  const deep = structuredClone(deepReport); const fast = structuredClone(fastReport);
  const fastClaims = new Map(fast.claims.map((item) => [item.id, item])); const fastSources = new Map(fast.sources.map((item) => [item.id, item]));
  const usedClaims = new Set(fastClaims.keys()); const usedSources = new Set(fastSources.keys()); const claimMap = new Map(); const sourceMap = new Map(); const collisions = [];
  for (const source of deep.sources ?? []) if (fastSources.has(source.id) && !same(fastSources.get(source.id), source)) { const next = renamedId("source-deep-", source.id, usedSources); sourceMap.set(source.id, next); collisions.push({ kind: "source_revision", fast_id: source.id, deep_id: next }); }
  for (const claim of deep.claims ?? []) if (fastClaims.has(claim.id) && !same(fastClaims.get(claim.id), claim)) { const next = renamedId("claim-deep-", claim.id, usedClaims); claimMap.set(claim.id, next); collisions.push({ kind: "claim_revision", fast_id: claim.id, deep_id: next }); }
  const rewritten = rewriteReferences(deep, claimMap, sourceMap);
  rewritten.claims = (rewritten.claims ?? []).map((claim) => ({ ...claim, id: claimMap.get(claim.id) ?? claim.id }));
  rewritten.sources = (rewritten.sources ?? []).map((source) => ({ ...source, id: sourceMap.get(source.id) ?? source.id }));

  const deepClaimIds = new Set(rewritten.claims.map((item) => item.id)); const deepSourceIds = new Set(rewritten.sources.map((item) => item.id));
  rewritten.claims = [...fast.claims.filter((item) => !deepClaimIds.has(item.id)), ...rewritten.claims];
  rewritten.sources = [...fast.sources.filter((item) => !deepSourceIds.has(item.id)), ...rewritten.sources.map((source) => {
    const prior = fastSources.get(source.id);
    return prior ? { ...source, supported_claim_ids: unique([...prior.supported_claim_ids, ...source.supported_claim_ids]) } : source;
  })];

  for (const [sectionName, fastSection] of Object.entries(fast.sections)) {
    const deepSection = rewritten.sections?.[sectionName]; if (!deepSection) continue;
    const ids = new Set(deepSection.items.map((item) => item.id));
    deepSection.items = [...fastSection.items.filter((item) => !ids.has(item.id)), ...deepSection.items];
    deepSection.claim_ids = unique([...fastSection.claim_ids, ...deepSection.claim_ids]);
    deepSection.coverage_notes = unique([...fastSection.coverage_notes, ...deepSection.coverage_notes]);
  }
  if (fast.issuer.identity_state === "confirmed" && rewritten.issuer.identity_state !== "confirmed") rewritten.issuer = { ...rewritten.issuer, legal_name: fast.issuer.legal_name, cik: fast.issuer.cik, identity_state: fast.issuer.identity_state };
  const priorIdentityKey = (item) => `${item.name}:${item.ticker}:${item.effective_from}:${item.effective_to}`;
  const priorIdentityIds = new Set((rewritten.issuer.prior_identities ?? []).map(priorIdentityKey));
  rewritten.issuer.prior_identities = [...(fast.issuer.prior_identities ?? []).filter((item) => !priorIdentityIds.has(priorIdentityKey(item))), ...(rewritten.issuer.prior_identities ?? [])];
  if (fast.security.evidence_state === "confirmed" && rewritten.security.evidence_state !== "confirmed") rewritten.security = { ...rewritten.security, ...Object.fromEntries(["ticker", "name", "security_type", "listing_venue", "listing_status", "evidence_state"].map((key) => [key, fast.security[key]])) };
  rewritten.issuer.claim_ids = unique([...fast.issuer.claim_ids, ...rewritten.issuer.claim_ids]);
  rewritten.security.claim_ids = unique([...fast.security.claim_ids, ...rewritten.security.claim_ids]);
  for (const [key, fastMetric] of Object.entries(fast.financial_assessment.metrics)) {
    const deepMetric = rewritten.financial_assessment?.metrics?.[key];
    if (fastMetric.state === "confirmed" && deepMetric?.state !== "confirmed") rewritten.financial_assessment.metrics[key] = fastMetric;
  }
  const deepShares = rewritten.financial_assessment.shares_outstanding;
  const fastShares = fast.financial_assessment.shares_outstanding;
  if (fastShares?.state === "confirmed" && deepShares?.state !== "confirmed") rewritten.financial_assessment.shares_outstanding = fastShares;
  else if (fastShares?.state === "confirmed" && deepShares?.state === "confirmed") {
    for (const field of ["observations", "annual_observations"]) {
      const periods = new Set((deepShares[field] ?? []).map((item) => item.period_end));
      deepShares[field] = [...(fastShares[field] ?? []).filter((item) => !periods.has(item.period_end)), ...(deepShares[field] ?? [])].sort((left, right) => left.period_end.localeCompare(right.period_end));
    }
  }
  if (fast.financial_assessment.going_concern.state === "confirmed" && rewritten.financial_assessment.going_concern.state !== "confirmed") rewritten.financial_assessment.going_concern = fast.financial_assessment.going_concern;
  const warningIds = new Set((rewritten.financial_assessment.material_warnings ?? []).map((item) => item.id));
  rewritten.financial_assessment.material_warnings = [...fast.financial_assessment.material_warnings.filter((item) => !warningIds.has(item.id)), ...rewritten.financial_assessment.material_warnings];
  if (fast.catalyst_assessment.current.state === "confirmed" && rewritten.catalyst_assessment.current.state !== "confirmed") rewritten.catalyst_assessment.current = fast.catalyst_assessment.current;
  const metricRevisions = Object.entries(fast.financial_assessment.metrics).filter(([key, metric]) => {
    const next = rewritten.financial_assessment?.metrics?.[key];
    return metric.state === "confirmed" && next?.state === "confirmed" && `${metric.value}:${metric.unit}:${metric.period_end}` !== `${next.value}:${next.unit}:${next.period_end}`;
  }).map(([key]) => `financial:${key}`);
  if (collisions.length || metricRevisions.length) {
    rewritten.metadata.completion_status = "partial";
    rewritten.metadata.coverage_limitations = [...rewritten.metadata.coverage_limitations, { code: "deep_revision_lineage", explanation: "Deep added evidence that differs from the preserved Fast snapshot; inspect the retained Fast and Deep claim/source IDs and handoff telemetry before relying on the revised conclusion.", affected_sections: unique([...metricRevisions, "claims", "sources"]) }];
  }
  const fastClaimIds = new Set(fast.claims.map((item) => item.id));
  return { report: rewritten, lineage: { reused_fast_claim_ids: [...fastClaimIds], new_deep_claim_ids: rewritten.claims.filter((item) => !fastClaimIds.has(item.id)).map((item) => item.id), revisions: [...collisions, ...metricRevisions.map((component) => ({ kind: "metric_revision", component }))] } };
}

export function countAvoidedRetrievals(operations) {
  return (operations?.retrieval?.sec_request_count ?? 0) + (operations?.bounded_sources?.request_count ?? 0);
}
