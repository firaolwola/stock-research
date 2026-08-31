export const LEGACY_SCORING_METHODOLOGY_VERSION = "1.0.0";
export const PREVIOUS_SCORING_METHODOLOGY_VERSION = "2.0.0";
export const SCORING_METHODOLOGY_VERSION = "2.1.0";

export const SCORE_DEFINITIONS = Object.freeze({
  dilution_historical_severity: ["higher_is_more_risk", "Past three years"],
  dilution_future_likelihood: ["higher_is_more_risk", "Next twelve months"],
  dilution_potential_impact: ["higher_is_more_risk", "Next twelve months"],
  reverse_split_risk: ["higher_is_more_risk", "Next twelve months"],
  financial_health: ["higher_is_better", "Latest reported period and next twelve months"],
  financial_revenue_trend: ["higher_is_better", "Comparable SEC-reported periods"],
  financial_net_income_trend: ["higher_is_better", "Comparable SEC-reported periods"],
  financial_debt_trend: ["higher_is_better", "Comparable SEC-reported period ends"],
  financial_free_cash_flow_trend: ["higher_is_better", "Comparable SEC-reported periods"],
  financial_cash_trend: ["higher_is_better", "Comparable SEC-reported period ends"],
  financial_operating_cash_flow_trend: ["higher_is_better", "Comparable SEC-reported periods"],
  long_term_company_quality: ["higher_is_better", "Multi-year (Deep only)"],
  catalyst_strength: ["higher_is_better", "Current catalyst"],
  near_term_setup_quality: ["higher_is_better", "Next five trading days"]
});

const clamp = (n) => Math.max(0, Math.min(10, n));
const round = (n) => Math.round(clamp(n) * 10) / 10;
const part = (key, state, value, weight, explanation, claim_ids = []) => ({ key, state, value: Number.isFinite(value) ? round(value) : null, weight, explanation, claim_ids: [...new Set(claim_ids)] });
const claimsOf = (parts) => [...new Set(parts.flatMap((item) => item.claim_ids))];
const weighted = (parts) => parts.reduce((sum, item) => sum + item.value * item.weight, 0);

function evidence(report) {
  return { claims: new Map(report.claims.map((x) => [x.id, x])), sources: new Map(report.sources.map((x) => [x.id, x])) };
}

function authoritative(report, ids, market = false) {
  const { claims, sources } = evidence(report);
  const allowed = new Set(market ? ["exchange_notice", "other_secondary"] : ["sec_filing", "exchange_notice", "company_release", "company_filing", "original_news", "other_primary"]);
  return ids.length > 0 && ids.every((id) => {
    const claim = claims.get(id);
    return ["confirmed", "not_found"].includes(claim?.state) && claim.source_ids.some((sourceId) => allowed.has(sources.get(sourceId)?.source_type));
  });
}

function secAuthoritative(report, ids, allowNotFound = false) {
  const { claims, sources } = evidence(report);
  return ids.length > 0 && ids.every((id) => {
    const claim = claims.get(id);
    if (!(allowNotFound ? ["confirmed", "not_found"].includes(claim?.state) : claim?.state === "confirmed") || claim.source_ids.length === 0) return false;
    return claim.source_ids.some((sourceId) => {
      const source = sources.get(sourceId);
      if (!source) return false;
      if (source.source_type === "sec_filing") return true;
      try { return /(^|\.)sec\.gov$/i.test(new URL(source.url).hostname); } catch { return false; }
    });
  });
}

function confidence(report, ids) {
  const { claims, sources } = evidence(report);
  const levels = ids.flatMap((id) => claims.get(id)?.source_ids ?? []).map((id) => sources.get(id)?.confidence).filter(Boolean);
  return !levels.length ? "unknown" : levels.includes("low") ? "low" : levels.some((x) => ["medium", "unknown"].includes(x)) ? "medium" : "high";
}

function result(report, key, state, value, explanation, components = []) {
  const ids = claimsOf(components); const [direction, time_horizon] = SCORE_DEFINITIONS[key];
  return { state, value: state === "confirmed" ? round(value) : null, scale_min: 0, scale_max: 10, direction, time_horizon, explanation, claim_ids: ids, confidence: state === "confirmed" ? confidence(report, ids) : "unknown", methodology_version: SCORING_METHODOLOGY_VERSION, components };
}
const limited = (report, key, explanation, components = [], state = "limited_coverage") => result(report, key, state, null, explanation, components);
const riskPercent = (n) => n <= 0 ? 0 : n <= 5 ? 2 : n <= 15 ? 4 : n <= 30 ? 6 : n <= 60 ? 8 : 10;
const percentItems = (section) => section.items.filter((x) => x.state === "confirmed" && x.unit === "percent_of_shares" && Number.isFinite(x.value));

const trendScoreKeys = Object.freeze({
  revenue: "financial_revenue_trend", profitability: "financial_net_income_trend", debt: "financial_debt_trend",
  free_cash_flow: "financial_free_cash_flow_trend", cash: "financial_cash_trend", operating_cash_flow: "financial_operating_cash_flow_trend"
});
const generationMetrics = new Set(["profitability", "free_cash_flow", "operating_cash_flow"]);
const pointInTimeMetrics = new Set(["cash", "debt"]);
const ageDays = (later, earlier) => Math.floor((new Date(`${later.slice(0, 10)}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) / 86_400_000);
const ratioChange = (previous, current) => (current - previous) / Math.max(Math.abs(previous), Math.abs(current) * .1, 1);

function comparableSeries(metric, metricKey) {
  if (pointInTimeMetrics.has(metricKey) && (metric.observations?.length ?? 0) >= 2) return { observations: metric.observations, cadence: "quarter-end" };
  // FCF's primary trend is intentionally annual.  Interim FCF remains useful
  // as a separate freshness/context signal, but must not replace the longer
  // comparable annual history or get mixed into the primary trend score.
  if (metricKey === "free_cash_flow") {
    if ((metric.annual_observations?.length ?? 0) >= 2) return { observations: metric.annual_observations, cadence: "annual" };
    return { observations: [], cadence: "annual" };
  }
  if ((metric.observations?.length ?? 0) >= 2 && metric.observations.at(-1).period_end > (metric.annual_observations?.at(-1)?.period_end ?? "")) return { observations: metric.observations, cadence: "interim" };
  if ((metric.annual_observations?.length ?? 0) >= 2) return { observations: metric.annual_observations, cadence: "annual" };
  if ((metric.observations?.length ?? 0) >= 2) return { observations: metric.observations, cadence: pointInTimeMetrics.has(metricKey) ? "quarter-end" : "quarterly" };
  return { observations: [], cadence: "unavailable" };
}

function trendConfidence(report, ids, count) {
  const order = ["unknown", "low", "medium", "high"];
  const sample = count >= 4 ? "high" : count >= 3 ? "medium" : "low";
  const source = confidence(report, ids);
  return order[Math.min(order.indexOf(sample), order.indexOf(source))];
}

function financialTrend(report, metricKey) {
  const scoreKey = trendScoreKeys[metricKey]; const metric = report.financial_assessment.metrics[metricKey];
  const { observations, cadence } = comparableSeries(metric ?? {}, metricKey);
  const ids = [...new Set(observations.flatMap((item) => item.claim_ids ?? []))];
  const unavailable = (why) => limited(report, scoreKey, why);
  if (metric?.state !== "confirmed" || observations.length < 2) return unavailable("At least two comparable SEC-derived observations are required; one observation does not establish a trend.");
  const durations = observations.map((item) => Math.round((new Date(`${item.period_end}T00:00:00Z`) - new Date(`${item.period_start}T00:00:00Z`)) / 86_400_000));
  const periodShapeMatches = pointInTimeMetrics.has(metricKey)
    ? durations.every((days) => days === 0)
    : cadence === "annual"
      ? durations.every((days) => days >= 330 && days <= 400)
      : durations.every((days) => Math.abs(days - durations[0]) <= 3);
  if (!observations.every((item) => Number.isFinite(item.value) && item.unit === observations[0].unit) || !periodShapeMatches || !secAuthoritative(report, ids)) return unavailable("Every scored observation must be identity-gated, comparable, and supported only by SEC authoritative evidence; secondary-provider values and mismatched periods are ignored.");
  if (confidence(report, ids) === "unknown") return unavailable("The linked SEC evidence needs a usable confidence assessment before the trend can score.");
  if (report.financial_assessment.as_of) {
    const maximumAge = pointInTimeMetrics.has(metricKey) ? 180 : cadence === "annual" ? 550 : 180;
    if (ageDays(report.financial_assessment.as_of, observations.at(-1).period_end) > maximumAge) return unavailable("The latest comparable SEC observation is too stale for a Fast financial trend score.");
  }
  const values = observations.map((item) => item.value); const changes = values.slice(1).map((value, index) => ratioChange(values[index], value));
  const averageChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  let value; let formula;
  if (generationMetrics.has(metricKey)) {
    const scale = Math.max(...values.map(Math.abs), 1);
    const latestLevel = clamp(5 + 5 * values.at(-1) / scale);
    const improvement = clamp(5 + 5 * (values.at(-1) - values[0]) / scale);
    const consistency = 10 * changes.filter((change) => change > 0).length / changes.length;
    value = .45 * latestLevel + .4 * improvement + .15 * consistency;
    formula = `45% latest sign/level, 40% first-to-latest improvement, and 15% improving-transition consistency across ${observations.length} ${cadence} periods.`;
  } else {
    const directed = metricKey === "debt" ? -averageChange : averageChange;
    const latestDirected = metricKey === "debt" ? -changes.at(-1) : changes.at(-1);
    const consistency = 10 * changes.filter((change) => metricKey === "debt" ? change <= 0 : change >= 0).length / changes.length;
    value = .55 * clamp(5 + 20 * directed) + .3 * clamp(5 + 20 * latestDirected) + .15 * consistency;
    formula = `55% average direction, 30% latest comparable change, and 15% directional consistency across ${observations.length} ${cadence} periods.`;
  }
  const components = [part("comparable_sec_history", "confirmed", value, 1, formula, ids)];
  const observed = observations.map((item) => `${item.period_end}: ${item.value} ${item.unit}`).join("; ");
  const scored = result(report, scoreKey, "confirmed", value, `Company-relative trend only; raw company size is not scored. Observed normalized SEC values: ${observed}. ${formula}`, components);
  scored.confidence = trendConfidence(report, ids, observations.length);
  return scored;
}

function historical(report) {
  const s = report.sections.dilution;
  if (s.state === "not_applicable") return limited(report, "dilution_historical_severity", "Historical dilution is not applicable to this security.", [], "not_applicable");
  if (!["confirmed", "not_found"].includes(s.state) || !authoritative(report, s.claim_ids)) return limited(report, "dilution_historical_severity", "A bounded authoritative three-year history is required; missing history is not favorable evidence.");
  if (s.state === "not_found") {
    const p = [part("actual_share_increase", "confirmed", 0, 1, "No actual issuance was found in the bounded review; registration capacity is not counted as dilution.", s.claim_ids)];
    return result(report, "dilution_historical_severity", "confirmed", 0, "Measures actual shareholder dilution, not registrations or financing capacity.", p);
  }
  const actual = percentItems(s).filter((x) => x.evidence_role === "actual_issuance");
  if (!actual.length) return limited(report, "dilution_historical_severity", "Financing evidence exists, but actual share-count change is not quantified; registrations, warrants, and convertibles do not prove historical dilution.");
  const pct = actual.reduce((sum, x) => sum + Math.max(0, x.value), 0);
  const p = [part("actual_share_increase", "confirmed", riskPercent(pct), 1, `Confirmed issuance increased the share base by approximately ${round(pct)}% in-window.`, actual.flatMap((x) => x.claim_ids))];
  return result(report, "dilution_historical_severity", "confirmed", p[0].value, "Severity is based on supported ownership dilution; registration capacity remains separate.", p);
}

function future(report, hist) {
  const f = report.financial_assessment; const m = f.metrics;
  if (hist.state !== "confirmed" || f.state !== "confirmed" || !["cash", "cash_burn", "free_cash_flow", "debt"].every((k) => m[k].state === "confirmed")) return limited(report, "dilution_future_likelihood", "Current liquidity, true free cash flow, total debt, and resolved dilution history are required; gaps cannot lower financing risk.");
  const annualBurn = Math.max(0, m.cash_burn.value) * 4; const runway = annualBurn ? m.cash.value / annualBurn : Infinity;
  const liquidity = f.going_concern.state === "confirmed" ? 10 : runway < .5 ? 9 : runway < 1 ? 7 : runway < 2 ? 5 : annualBurn === 0 ? 2 : 3;
  const instruments = report.sections.dilution.items.filter((x) => x.state === "confirmed" && ["offering", "warrant", "convertible"].includes(x.kind));
  const mechanism = instruments.some((x) => x.kind === "convertible") ? 9 : instruments.some((x) => x.kind === "warrant") ? 7 : instruments.length ? 6 : 2;
  const ratio = m.cash.value > 0 ? m.debt.value / m.cash.value : Infinity; const leverage = ratio > 2 ? 9 : ratio > 1 ? 7 : ratio > .5 ? 5 : 2;
  const p = [part("liquidity_pressure", "confirmed", liquidity, .4, "Cash runway and going-concern evidence measure financing pressure.", [...m.cash.claim_ids, ...m.cash_burn.claim_ids, ...f.going_concern.claim_ids]), part("available_mechanisms", "confirmed", mechanism, .25, "Current offerings, warrants, or convertibles identify mechanisms; they do not prove completed dilution.", report.sections.dilution.claim_ids), part("leverage_pressure", "confirmed", leverage, .2, "Supported total debt is compared with current cash.", [...m.debt.claim_ids, ...m.cash.claim_ids]), part("resolved_history", "confirmed", hist.value, .15, "Actual history is secondary; unresolved history never receives a favorable value.", hist.claim_ids)];
  return result(report, "dilution_future_likelihood", "confirmed", weighted(p), "A financing-pressure assessment, not a probability forecast.", p);
}

function impact(report) {
  const items = percentItems(report.sections.dilution).filter((x) => ["potential_issuance", "instrument_overhang"].includes(x.evidence_role));
  if (!items.length) return limited(report, "dilution_potential_impact", "A supported potential-share numerator and current share denominator, expressed as percent of shares, are required; proceeds versus cash is not ownership impact.");
  const pct = items.reduce((sum, x) => sum + Math.max(0, x.value), 0); const p = [part("potential_share_increase", "confirmed", riskPercent(pct), 1, `Supported terms imply up to approximately ${round(pct)}% additional shares.`, items.flatMap((x) => x.claim_ids))];
  return result(report, "dilution_potential_impact", "confirmed", p[0].value, "Measures potential ownership impact from supported share terms.", p);
}

function splitRisk(report) {
  const s = report.sections.reverse_splits; const c = report.sections.compliance_and_warnings;
  if (!["confirmed", "not_found"].includes(s.state) || !["confirmed", "not_found"].includes(c.state) || report.security.evidence_state !== "confirmed" || report.security.listing_status === "unknown") return limited(report, "reverse_split_risk", "Resolved split history and current exchange/listing status are required; generic risk-factor text is not a listing deficiency.");
  const count = s.items.filter((x) => x.state === "confirmed" && x.kind === "reverse_split" && x.corporate_action_state === "completed").length;
  const pressure = c.items.some((x) => x.state === "confirmed" && x.kind === "exchange_compliance" && x.resolution_state === "active");
  const p = [part("confirmed_split_history", "confirmed", count ? Math.min(10, 4 + count * 2) : 0, .45, "Only confirmed corporate actions in the five-year window count.", s.claim_ids), part("active_listing_pressure", "confirmed", report.security.listing_status === "halted" ? 10 : pressure ? 9 : 0, .55, "Specific current exchange status or compliance notices drive listing pressure.", [...report.security.claim_ids, ...c.claim_ids])];
  return result(report, "reverse_split_risk", "confirmed", weighted(p), "Combines history with current listing pressure without predicting a corporate action.", p);
}

function finances(report) {
  const f = report.financial_assessment; const m = f.metrics; const required = ["cash", "cash_burn", "free_cash_flow", "debt", "profitability"];
  if (f.state !== "confirmed" || !required.every((k) => m[k].state === "confirmed") || !["confirmed", "not_found"].includes(f.going_concern.state)) return limited(report, "financial_health", "Current comparable cash, burn, true free cash flow, total debt, profitability, and going-concern evidence are required. Stale, conflicting, partial, or mismatched evidence stays Unscored.");
  const financialIds = [...new Set([...required.flatMap((key) => m[key].claim_ids), ...f.going_concern.claim_ids, ...f.material_warnings.flatMap((warning) => warning.claim_ids)])];
  if (!secAuthoritative(report, financialIds, true)) return limited(report, "financial_health", "Financial Health requires SEC-authoritative Company Facts or filed-report evidence for every score-affecting financial input; discovery and market-data providers are excluded.");
  const burn = Math.max(0, m.cash_burn.value) * 4; const runway = burn ? m.cash.value / burn : Infinity; const ratio = m.cash.value > 0 ? m.debt.value / m.cash.value : Infinity;
  const severe = f.material_warnings.some((x) => x.state === "confirmed" && ["high", "critical"].includes(x.severity));
  const p = [part("liquidity_and_runway", "confirmed", f.going_concern.state === "confirmed" ? 0 : runway < .5 ? 1 : runway < 1 ? 3 : runway < 2 ? 5 : burn === 0 ? 8 : 7, .3, "Missing burn never implies long runway.", [...m.cash.claim_ids, ...m.cash_burn.claim_ids]), part("total_debt_capacity", "confirmed", ratio > 2 ? 1 : ratio > 1 ? 3 : ratio > .5 ? 5 : 8, .2, "One debt component is not relabeled total debt.", [...m.debt.claim_ids, ...m.cash.claim_ids]), part("free_cash_flow", "confirmed", m.free_cash_flow.value > 0 ? 8 : m.free_cash_flow.value === 0 ? 5 : 2, .2, "Operating cash flow alone is insufficient for FCF.", m.free_cash_flow.claim_ids), part("profitability", "confirmed", m.profitability.value > 0 ? 8 : m.profitability.value === 0 ? 5 : 2, .15, "Profitability is separate from cash flow.", m.profitability.claim_ids), part("material_warnings", "confirmed", f.going_concern.state === "confirmed" ? 0 : severe ? 2 : 8, .15, "Going-concern and severe warnings cap favorable interpretation.", [...f.going_concern.claim_ids, ...f.material_warnings.flatMap((x) => x.claim_ids)])];
  let value = weighted(p); if (f.going_concern.state === "confirmed") value = Math.min(value, 2); else if (severe) value = Math.min(value, 3);
  return result(report, "financial_health", "confirmed", value, "Current resilience from comparable, fresh evidence; gaps never become favorable assumptions.", p);
}

function catalyst(report) {
  const c = report.catalyst_assessment.current; const vals = { high: 9, medium: 6, low: 2 }; const weights = { potential_significance: .3, specificity: .25, credibility: .2, novelty: .15, recency: .1 };
  const confirmedIds = c.claim_ids.filter((id) => report.claims.find((claim) => claim.id === id)?.state === "confirmed");
  if (c.state !== "confirmed" || !authoritative(report, confirmedIds)) return limited(report, "catalyst_strength", "A current identity-gated SEC, exchange, issuer, or attributable original source is required; discovery-only items cannot score.");
  const p = Object.entries(weights).map(([key, weight]) => { const x = c.factors[key]; const ok = vals[x.rating] && authoritative(report, x.claim_ids); return part(key, ok ? "confirmed" : "limited_coverage", ok ? vals[x.rating] : null, weight, x.explanation, x.claim_ids); });
  if (p.some((x) => x.state !== "confirmed")) return limited(report, "catalyst_strength", "Every weighted factor needs authoritative evidence; unresolved significance remains Unscored.", p);
  return result(report, "catalyst_strength", "confirmed", weighted(p), "Current-event strength without historical analogues or outcome probabilities.", p);
}

function setup(report, cat) {
  if (cat.state !== "confirmed") return limited(report, "near_term_setup_quality", "A supported current catalyst is required before market context can form a setup score.", cat.components);
  const items = report.sections.financial_context.items; const price = items.find((x) => x.state === "confirmed" && x.unit === "price_change_percent"); const volume = items.find((x) => x.state === "confirmed" && x.unit === "volume_ratio");
  if (!price || !volume || !authoritative(report, [...price.claim_ids, ...volume.claim_ids], true)) return limited(report, "near_term_setup_quality", "Fresh bounded end-of-day price change and volume-versus-baseline context are required; catalyst analogues are Deep-only.", cat.components);
  const pv = price.value >= 10 ? 9 : price.value >= 3 ? 7 : price.value > -3 ? 5 : price.value > -10 ? 3 : 1; const vv = volume.value >= 3 ? 9 : volume.value >= 1.5 ? 7 : volume.value >= .75 ? 5 : 2;
  const p = [part("supported_catalyst", "confirmed", cat.value, .6, "Supported catalyst strength is primary.", cat.claim_ids), part("eod_price_context", "confirmed", pv, .2, "Price change is context, not a prediction.", price.claim_ids), part("eod_volume_context", "confirmed", vv, .2, "Relative volume indicates participation, not future return.", volume.claim_ids)];
  return result(report, "near_term_setup_quality", "confirmed", weighted(p), "Current catalyst plus bounded EOD context; analogues and profit forecasts are excluded.", p);
}

export function calibrateReportScores(report) {
  const r = structuredClone(report); const hist = historical(r); const fin = finances(r); const cat = catalyst(r);
  r.scores = { dilution_historical_severity: hist, dilution_future_likelihood: future(r, hist), dilution_potential_impact: impact(r), reverse_split_risk: splitRisk(r), financial_health: fin,
    financial_revenue_trend: financialTrend(r, "revenue"), financial_net_income_trend: financialTrend(r, "profitability"), financial_debt_trend: financialTrend(r, "debt"),
    financial_free_cash_flow_trend: financialTrend(r, "free_cash_flow"), financial_cash_trend: financialTrend(r, "cash"), financial_operating_cash_flow_trend: financialTrend(r, "operating_cash_flow"),
    long_term_company_quality: limited(r, "long_term_company_quality", "Long-term company quality remains a Deep construct and is not deterministically scored from bounded Fast evidence."), catalyst_strength: cat, near_term_setup_quality: setup(r, cat) };
  return r;
}

export function diagnoseCapitalScoreSufficiency(report) {
  const scored = calibrateReportScores(report); const metrics = report.financial_assessment.metrics;
  const definitions = {
    dilution_historical_severity: {
      inputs: { "bounded authoritative dilution history": ["confirmed", "not_found"].includes(report.sections.dilution.state), "quantified actual share-base change": report.sections.dilution.items.some((item) => item.evidence_role === "actual_issuance" && item.unit === "percent_of_shares") }
    },
    dilution_future_likelihood: {
      inputs: { "resolved historical dilution": scored.scores.dilution_historical_severity.state === "confirmed", "current cash": metrics.cash?.state === "confirmed", "current cash burn": metrics.cash_burn?.state === "confirmed", "true free cash flow": metrics.free_cash_flow?.state === "confirmed", "total debt": metrics.debt?.state === "confirmed" }
    },
    dilution_potential_impact: {
      inputs: { "supported potential-share numerator": report.sections.dilution.items.some((item) => ["potential_issuance", "instrument_overhang"].includes(item.evidence_role)), "current class-consistent share denominator": report.financial_assessment.shares_outstanding?.state === "confirmed", "percent-of-shares calculation": report.sections.dilution.items.some((item) => ["potential_issuance", "instrument_overhang"].includes(item.evidence_role) && item.unit === "percent_of_shares") }
    },
    reverse_split_risk: {
      inputs: { "resolved five-year split history": ["confirmed", "not_found"].includes(report.sections.reverse_splits.state), "current listing state": report.security.evidence_state === "confirmed" && report.security.listing_status !== "unknown", "current active listing-pressure state": ["confirmed", "not_found"].includes(report.sections.compliance_and_warnings.state) }
    }
  };
  return Object.fromEntries(Object.entries(definitions).map(([key, definition]) => {
    const required = Object.keys(definition.inputs); const available = required.filter((input) => definition.inputs[input]); const missing = required.filter((input) => !definition.inputs[input]);
    return [key, { required_inputs: required, available_inputs: available, missing_inputs: missing, final_state: scored.scores[key].state, value: scored.scores[key].value, explanation: scored.scores[key].explanation }];
  }));
}

export function buildScoreRollup(scores, { name, score_keys }) {
  if (!name || !Array.isArray(score_keys) || !score_keys.length) throw new TypeError("A roll-up name and component score keys are required");
  const selected = score_keys.map((key) => ({ key, ...scores[key] })); if (selected.some((x) => !x.direction)) throw new TypeError("Roll-up refers to an unknown score"); if (new Set(selected.map((x) => x.direction)).size !== 1) throw new TypeError("A roll-up cannot combine opposite score directions");
  const unresolved = selected.filter((x) => x.state !== "confirmed");
  return { name, state: unresolved.length ? "limited_coverage" : "confirmed", value: unresolved.length ? null : round(selected.reduce((s, x) => s + x.value, 0) / selected.length), scale_min: 0, scale_max: 10, direction: selected[0].direction, explanation: unresolved.length ? `Roll-up is unscored because ${unresolved.map((x) => x.key).join(", ")} is unresolved.` : "Equal-weight optional summary; inspect every component before use.", component_scores: selected.map(({ key, state, value, confidence }) => ({ key, state, value, confidence })) };
}
