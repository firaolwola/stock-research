export const SCORING_METHODOLOGY_VERSION = "1.0.0";

export const SCORE_DEFINITIONS = Object.freeze({
  dilution_historical_severity: ["higher_is_more_risk", "Past three years"],
  dilution_future_likelihood: ["higher_is_more_risk", "Next twelve months"],
  dilution_potential_impact: ["higher_is_more_risk", "Next twelve months"],
  reverse_split_risk: ["higher_is_more_risk", "Next twelve months"],
  financial_health: ["higher_is_better", "Latest reported period and next twelve months"],
  long_term_company_quality: ["higher_is_better", "Multi-year"],
  catalyst_strength: ["higher_is_better", "Current catalyst"],
  near_term_setup_quality: ["higher_is_better", "Next five trading days"]
});

const clamp = (value) => Math.max(0, Math.min(10, value));
const round = (value) => Math.round(clamp(value) * 10) / 10;
const unionClaims = (components) => [...new Set(components.flatMap((component) => component.claim_ids || []))];
const component = (key, state, value, weight, explanation, claimIds = []) => ({ key, state, value: Number.isFinite(value) ? round(value) : value, weight: Math.round(weight * 1000) / 1000, explanation, claim_ids: [...new Set(claimIds)] });

function confidenceFor(report, claimIds) {
  const claims = new Map(report.claims.map((claim) => [claim.id, claim]));
  const sources = new Map(report.sources.map((source) => [source.id, source]));
  const levels = claimIds.flatMap((id) => claims.get(id)?.source_ids || []).map((id) => sources.get(id)?.confidence).filter(Boolean);
  if (!levels.length) return "unknown";
  if (levels.includes("low")) return "low";
  if (levels.includes("medium") || levels.includes("unknown")) return "medium";
  return "high";
}

function claimsAreScoreable(report, claimIds) {
  const claims = new Map(report.claims.map((claim) => [claim.id, claim]));
  return claimIds.length > 0 && claimIds.every((id) => ["confirmed", "not_found"].includes(claims.get(id)?.state) && claims.get(id).source_ids.length > 0);
}

function score(report, key, state, value, explanation, components) {
  const [direction, timeHorizon] = SCORE_DEFINITIONS[key];
  const claimIds = unionClaims(components);
  return {
    state,
    value: state === "confirmed" ? round(value) : null,
    scale_min: 0,
    scale_max: 10,
    direction,
    time_horizon: timeHorizon,
    explanation,
    claim_ids: claimIds,
    confidence: state === "confirmed" ? confidenceFor(report, claimIds) : "unknown",
    methodology_version: SCORING_METHODOLOGY_VERSION,
    components
  };
}

function unresolved(report, key, state, explanation, components = []) {
  const safeState = ["unknown", "limited_coverage", "not_applicable"].includes(state) ? state : "unknown";
  return score(report, key, safeState, null, explanation, components);
}

function weighted(components) {
  const included = components.filter((item) => item.state === "confirmed" && Number.isFinite(item.value) && item.weight > 0);
  const weight = included.reduce((sum, item) => sum + item.weight, 0);
  return weight ? included.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : null;
}

function historicalDilution(report) {
  const section = report.sections.dilution;
  if (section.state === "not_applicable") return unresolved(report, "dilution_historical_severity", "not_applicable", "Dilution history is not applicable to this security.");
  if (["unknown", "limited_coverage"].includes(section.state)) return unresolved(report, "dilution_historical_severity", section.state, "Incomplete dilution evidence prevents a numeric historical-severity score.");
  if (section.items.some((item) => ["unknown", "limited_coverage"].includes(item.state))) return unresolved(report, "dilution_historical_severity", "limited_coverage", "An unresolved dilution event prevents a numeric historical-severity score.");
  const weights = { offering: 2, warrant: 1, convertible: 2, other_dilution: 1 };
  const value = Math.min(10, section.items.reduce((sum, item) => sum + (weights[item.kind] || 0), 0));
  const components = [component("confirmed_dilution_events", "confirmed", value, 1, `${section.items.length} in-window dilution event(s) contributed by documented instrument type.`, section.claim_ids)];
  return score(report, "dilution_historical_severity", "confirmed", value, "Counts confirmed in-window offerings and instruments using fixed severity weights; a bounded not-found search scores 0 without asserting lifetime absence.", components);
}

function futureDilution(report, historical) {
  if (historical.state !== "confirmed") return unresolved(report, "dilution_future_likelihood", historical.state, "Future dilution likelihood remains unscored because historical dilution evidence is unresolved.", historical.components);
  const financial = report.financial_assessment;
  if (financial.state !== "confirmed") return unresolved(report, "dilution_future_likelihood", financial.state, "Liquidity evidence is incomplete, so future financing likelihood is not scored.");
  const instruments = report.sections.dilution.items.filter((item) => item.state === "confirmed" && ["warrant", "convertible"].includes(item.kind)).length;
  const cashPressure = (financial.metrics.cash_burn.value > 0 ? 7 : 2) + (financial.metrics.free_cash_flow.value < 0 ? 2 : 0);
  const debtPressure = financial.metrics.debt.value > financial.metrics.cash.value ? 8 : 3;
  const components = [
    component("historical_dilution", "confirmed", historical.value, 0.4, "Prior dilution raises—but does not determine—future financing likelihood.", historical.claim_ids),
    component("cash_flow_pressure", "confirmed", clamp(cashPressure), 0.35, "Positive cash burn or negative free cash flow raises financing pressure.", [...financial.metrics.cash_burn.claim_ids, ...financial.metrics.free_cash_flow.claim_ids]),
    component("debt_and_instruments", "confirmed", clamp(debtPressure + Math.min(2, instruments)), 0.25, "Debt above cash and outstanding warrants or convertibles raise financing pressure.", [...financial.metrics.cash.claim_ids, ...financial.metrics.debt.claim_ids, ...report.sections.dilution.claim_ids])
  ];
  return score(report, "dilution_future_likelihood", "confirmed", weighted(components), "Weighted evidence estimate for the next twelve months; it is not a probability forecast.", components);
}

function dilutionImpact(report, historical) {
  if (historical.state !== "confirmed") return unresolved(report, "dilution_potential_impact", historical.state, "Potential dilution impact remains unscored because instrument history is unresolved.");
  const cash = report.financial_assessment.metrics.cash;
  if (cash.state !== "confirmed" || !Number.isFinite(cash.value) || cash.value <= 0) return unresolved(report, "dilution_potential_impact", "limited_coverage", "A supported cash base is required to contextualize documented offering size.");
  const offerings = report.sections.dilution.items.filter((item) => item.state === "confirmed" && item.kind === "offering");
  if (offerings.some((item) => item.unit !== "USD" || !Number.isFinite(item.value))) return unresolved(report, "dilution_potential_impact", "limited_coverage", "A confirmed offering lacks comparable USD value, so potential impact remains unscored.");
  const offeringTotalMillions = offerings.reduce((sum, item) => sum + item.value / 1_000_000, 0);
  const instruments = report.sections.dilution.items.filter((item) => item.state === "confirmed" && ["warrant", "convertible"].includes(item.kind)).length;
  const ratioScore = clamp((offeringTotalMillions / cash.value) * 10);
  const components = [
    component("offering_size_vs_cash", "confirmed", ratioScore, 0.75, "Documented offering value is normalized to reported cash; this is not an ownership-dilution percentage.", [...report.sections.dilution.claim_ids, ...cash.claim_ids]),
    component("instrument_overhang", "confirmed", Math.min(10, instruments * 3), 0.25, "Confirmed warrants and convertibles add potential issuance overhang.", report.sections.dilution.claim_ids)
  ];
  return score(report, "dilution_potential_impact", "confirmed", weighted(components), "Contextualizes known financing size and instrument overhang; missing share-count terms keep this conservative and are stated in the components.", components);
}

function reverseSplit(report) {
  const splits = report.sections.reverse_splits;
  const compliance = report.sections.compliance_and_warnings;
  if (["unknown", "limited_coverage"].includes(splits.state) || ["unknown", "limited_coverage"].includes(compliance.state)) return unresolved(report, "reverse_split_risk", "limited_coverage", "Split or listing-compliance evidence is incomplete, so risk is not scored.");
  if ([...splits.items, ...compliance.items].some((item) => ["unknown", "limited_coverage"].includes(item.state))) return unresolved(report, "reverse_split_risk", "limited_coverage", "An unresolved split or compliance item prevents a numeric risk score.");
  if (splits.state === "not_applicable") return unresolved(report, "reverse_split_risk", "not_applicable", "Reverse-split risk is not applicable to this security.");
  const splitValue = splits.state === "not_found" ? 1 : Math.min(10, splits.items.length * 3);
  const complianceValue = compliance.items.some((item) => item.kind === "exchange_compliance" && item.state === "confirmed") ? 8 : 1;
  const components = [component("split_history", "confirmed", splitValue, 0.65, "Each confirmed in-window reverse split adds fixed severity; bounded not-found retains a baseline of 1.", splits.claim_ids), component("listing_pressure", "confirmed", complianceValue, 0.35, "Confirmed listing-compliance pressure increases near-term split risk.", compliance.claim_ids)];
  return score(report, "reverse_split_risk", "confirmed", weighted(components), "Combines five-year split history with current listing pressure; it does not predict a corporate action.", components);
}

function financialHealth(report) {
  const financial = report.financial_assessment;
  if (financial.state !== "confirmed") return unresolved(report, "financial_health", financial.state, "Incomplete or inapplicable financial evidence prevents a numeric health score.");
  const trendMap = { improving: 8, stable: 6, mixed: 5, deteriorating: 2 };
  const metrics = Object.entries(financial.metrics).map(([key, metric]) => component(key, metric.state, trendMap[metric.trend] ?? 5, 1 / 6, metric.summary, metric.claim_ids));
  let value = weighted(metrics);
  if (financial.metrics.profitability.value > 0) value += 0.7;
  if (financial.metrics.free_cash_flow.value > 0) value += 0.7;
  if (financial.metrics.debt.value > financial.metrics.cash.value) value -= 1.5;
  if (financial.going_concern.state === "confirmed") value -= 4;
  const components = [...metrics, component("going_concern_and_liquidity_warnings", "confirmed", financial.going_concern.state === "confirmed" ? 0 : 7, 0, "Going-concern and material financial warnings apply fixed downward adjustments.", [...financial.going_concern.claim_ids, ...financial.material_warnings.flatMap((warning) => warning.claim_ids)])];
  return score(report, "financial_health", "confirmed", value, "A trend-based baseline with explicit profitability, cash-flow, leverage, and going-concern adjustments.", components);
}

function longTermQuality(report, financial, historical) {
  if (financial.state !== "confirmed" || historical.state !== "confirmed") return unresolved(report, "long_term_company_quality", "limited_coverage", "Financial health and dilution history are both required for a longer-term quality score.", [...financial.components, ...historical.components]);
  const compliance = report.sections.compliance_and_warnings;
  if (["unknown", "limited_coverage"].includes(compliance.state)) return unresolved(report, "long_term_company_quality", "limited_coverage", "Compliance evidence is incomplete, so longer-term quality remains unscored.");
  if (compliance.items.some((item) => ["unknown", "limited_coverage"].includes(item.state))) return unresolved(report, "long_term_company_quality", "limited_coverage", "An unresolved compliance item prevents a numeric longer-term quality score.");
  const components = [
    component("financial_health", "confirmed", financial.value, 0.6, "Current financial health is the largest longer-term input.", financial.claim_ids),
    component("dilution_resilience", "confirmed", 10 - historical.value, 0.2, "Lower historical dilution severity supports resilience.", historical.claim_ids),
    component("compliance_quality", "confirmed", compliance.state === "not_found" ? 8 : 4, 0.2, "Bounded absence of material compliance warnings is favorable but not proof of lifetime absence.", compliance.claim_ids)
  ];
  return score(report, "long_term_company_quality", "confirmed", weighted(components), "Combines financial health, dilution resilience, and compliance evidence; catalyst/setup inputs are excluded.", components);
}

function catalystStrength(report) {
  const current = report.catalyst_assessment.current;
  if (current.state !== "confirmed") return unresolved(report, "catalyst_strength", current.state, "No sufficiently supported current catalyst is available for scoring.");
  const rating = { high: 9, medium: 6, low: 2 };
  const factors = Object.entries(current.factors).map(([key, factor]) => {
    const state = rating[factor.rating] && claimsAreScoreable(report, factor.claim_ids) ? "confirmed" : rating[factor.rating] ? "limited_coverage" : factor.rating;
    return component(key, state, state === "confirmed" ? rating[factor.rating] : null, 0.2, factor.explanation, factor.claim_ids);
  });
  if (factors.some((item) => item.state !== "confirmed")) return unresolved(report, "catalyst_strength", "limited_coverage", "One or more required catalyst factors are unknown, so strength remains unscored.", factors);
  return score(report, "catalyst_strength", "confirmed", weighted(factors), "Equal-weight assessment of recency, specificity, credibility, novelty, and potential significance; it is not an outcome probability.", factors);
}

function nearTermSetup(report, catalyst) {
  const implication = report.catalyst_assessment.near_term_implication;
  const analogues = report.catalyst_assessment.historical_analogues;
  if (catalyst.state !== "confirmed" || implication.state !== "confirmed") return unresolved(report, "near_term_setup_quality", "limited_coverage", "Confirmed catalyst strength and a supported near-term implication are required for setup scoring.", catalyst.components);
  if (!claimsAreScoreable(report, implication.claim_ids)) return unresolved(report, "near_term_setup_quality", "limited_coverage", "The near-term implication includes unresolved claims, so setup remains unscored.", catalyst.components);
  if (["unknown", "limited_coverage"].includes(analogues.state)) return unresolved(report, "near_term_setup_quality", analogues.state, "Issuer-specific analogue evidence is incomplete; no reaction is inferred.", catalyst.components);
  const direction = { strengthens: 8, mixed: 5, weakens: 2, neutral: 5 }[implication.direction] ?? null;
  if (direction === null) return unresolved(report, "near_term_setup_quality", "unknown", "Near-term implication direction is unresolved.", catalyst.components);
  const reactions = analogues.items.flatMap((item) => item.reaction_windows).filter((window) => window.state === "confirmed");
  const reactionValue = reactions.length ? clamp(5 + reactions.reduce((sum, window) => sum + Math.sign(window.price_change_percent), 0) / reactions.length * 2) : 5;
  const components = [component("catalyst_strength", "confirmed", catalyst.value, 0.6, "Current catalyst strength is the primary setup input.", catalyst.claim_ids), component("qualitative_implication", "confirmed", direction, 0.25, implication.summary, implication.claim_ids), component("bounded_historical_reactions", "confirmed", reactionValue, 0.15, "Sourced issuer reactions provide limited context and never predict repetition.", analogues.claim_ids)];
  return score(report, "near_term_setup_quality", "confirmed", weighted(components), "Combines current catalyst evidence, qualitative implication, and bounded issuer analogues; long-term company quality is excluded and no trade outcome is predicted.", components);
}

export function calibrateReportScores(report) {
  const calibrated = structuredClone(report);
  const historical = historicalDilution(calibrated);
  const financial = financialHealth(calibrated);
  const catalyst = catalystStrength(calibrated);
  calibrated.scores = {
    dilution_historical_severity: historical,
    dilution_future_likelihood: futureDilution(calibrated, historical),
    dilution_potential_impact: dilutionImpact(calibrated, historical),
    reverse_split_risk: reverseSplit(calibrated),
    financial_health: financial,
    long_term_company_quality: longTermQuality(calibrated, financial, historical),
    catalyst_strength: catalyst,
    near_term_setup_quality: nearTermSetup(calibrated, catalyst)
  };
  return calibrated;
}

export function buildScoreRollup(scores, { name, score_keys: scoreKeys }) {
  if (!name || !Array.isArray(scoreKeys) || scoreKeys.length === 0) throw new TypeError("A roll-up name and component score keys are required");
  const selected = scoreKeys.map((key) => ({ key, ...scores[key] }));
  if (selected.some((item) => !item.direction)) throw new TypeError("Roll-up refers to an unknown score");
  if (new Set(selected.map((item) => item.direction)).size !== 1) throw new TypeError("A roll-up cannot combine opposite score directions");
  const unresolvedScores = selected.filter((item) => item.state !== "confirmed");
  return {
    name,
    state: unresolvedScores.length ? "limited_coverage" : "confirmed",
    value: unresolvedScores.length ? null : round(selected.reduce((sum, item) => sum + item.value, 0) / selected.length),
    scale_min: 0,
    scale_max: 10,
    direction: selected[0].direction,
    explanation: unresolvedScores.length ? `Roll-up is unscored because ${unresolvedScores.map((item) => item.key).join(", ")} is unresolved.` : "Equal-weight optional summary; inspect every component before use.",
    component_scores: selected.map(({ key, state, value, confidence }) => ({ key, state, value, confidence }))
  };
}
