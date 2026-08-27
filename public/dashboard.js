const tickerPattern = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/;

export const sectionLabels = Object.freeze({
  reverse_splits: "Reverse splits", dilution: "Dilution & financing", dividends: "Dividends",
  compliance_and_warnings: "Compliance & warnings", financial_context: "Financial context", catalysts_and_news: "Catalysts & news"
});
export const priorityScoreKeys = Object.freeze(["dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk", "financial_health", "catalyst_strength", "near_term_setup_quality"]);
export const financialMetricOrder = Object.freeze(["revenue", "profitability", "debt", "free_cash_flow", "cash", "operating_cash_flow"]);
export const scoreSummaryOrder = Object.freeze(["financial_health", ...financialMetricOrder, "dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk"]);
const scoreLabels = Object.freeze({
  dilution_historical_severity: "Historical dilution severity", dilution_future_likelihood: "Future dilution likelihood",
  dilution_potential_impact: "Potential dilution impact", reverse_split_risk: "Reverse-split risk",
  financial_health: "Financial health", long_term_company_quality: "Long-term company quality",
  catalyst_strength: "Catalyst strength", near_term_setup_quality: "Near-term setup quality"
});
const stateLabels = Object.freeze({
  confirmed: "Confirmed", not_found: "Not found in window", unknown: "Unknown", not_applicable: "Not applicable",
  limited_coverage: "Limited coverage", complete: "Complete", partial: "Partial", pending: "Pending", fast: "Fast report", deep: "Deep report"
});
const catalystFactorLabels = Object.freeze({
  recency: "Recency", specificity: "Specificity", credibility: "Credibility",
  novelty: "Novelty", potential_significance: "Potential significance"
});
const financialMetricLabels = Object.freeze({
  cash: "Cash", cash_burn: "Cash burn", revenue: "Revenue", profitability: "Net income / loss",
  operating_cash_flow: "Operating cash flow", free_cash_flow: "Free cash flow", debt: "Total debt"
});
const scoreDescriptions = Object.freeze({
  financial_health: "Overall resilience from liquidity, debt, cash flow, profitability, and material warnings.",
  revenue: "Latest reported sales and whether comparable evidence supports a trend.",
  profitability: "Whether comparable SEC-reported net income or loss is improving.",
  debt: "Whether comparable SEC-reported total debt is stable, declining, or growing.",
  free_cash_flow: "Whether comparable SEC-derived free cash flow is improving.",
  cash: "Whether fresh comparable SEC-reported cash balances are strengthening or depleting.",
  cash_burn: "Supported rate of cash use; missing burn never implies safety.",
  operating_cash_flow: "Whether comparable SEC-reported operating cash flow is improving.",
  dilution_historical_severity: "How much supported dilution has already affected the share base.",
  dilution_future_likelihood: "How likely supported financing capacity is to become future dilution.",
  dilution_potential_impact: "Potential share-base impact from supported warrants, convertibles, or offerings.",
  reverse_split_risk: "Supported split history and current listing pressure."
});
const financialTrendScoreKeys = Object.freeze({
  revenue: "financial_revenue_trend", profitability: "financial_net_income_trend", debt: "financial_debt_trend",
  free_cash_flow: "financial_free_cash_flow_trend", cash: "financial_cash_trend", operating_cash_flow: "financial_operating_cash_flow_trend"
});
const scoreTooltipGuidance = Object.freeze({
  financial_health: ["strong overall financial resilience", "very weak financial condition"],
  revenue: ["strong/improving revenue trend", "sharply deteriorating revenue"],
  profitability: ["strong profits or major improvement", "worsening losses"],
  debt: ["falling or well-controlled debt trend", "rapidly worsening debt trend"],
  free_cash_flow: ["strong positive/improving free cash flow", "strongly negative/deteriorating free cash flow"],
  cash: ["strong/growing cash position", "substantial cash depletion"],
  operating_cash_flow: ["strong/improving operating cash generation", "heavy/deteriorating operating cash consumption"],
  dilution_historical_severity: ["severe historical dilution", "little or no confirmed historical dilution"],
  dilution_future_likelihood: ["high supported future dilution risk", "low supported future dilution risk"],
  dilution_potential_impact: ["potentially severe shareholder dilution", "little supported potential dilution"],
  reverse_split_risk: ["high supported reverse-split risk", "low supported reverse-split risk"]
});

export function validateTickerInput(value) {
  const ticker = String(value || "").trim().toUpperCase();
  if (!ticker) return { valid: false, ticker, message: "Please enter a ticker." };
  if (ticker.length > 15 || !tickerPattern.test(ticker)) return { valid: false, ticker, message: "Ticker must be 1–15 letters or numbers, with single periods or hyphens between segments." };
  return { valid: true, ticker, message: "" };
}
export function formatLabel(value) {
  return stateLabels[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function scoreToStars(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(10, value))) / 2;
}
export function scoreTooltipText(key, score, presentation = buildScorePresentation(score)) {
  if (presentation.state !== "scored" || !Number.isFinite(score.value)) return null;
  const guidance = scoreTooltipGuidance[key];
  if (!guidance) return `${score.value} / 10. ${presentation.directionLabel}.`;
  return `${score.value} / 10. ${presentation.directionLabel}. 5 stars = ${guidance[0]}. 0 stars = ${guidance[1]}.`;
}
export function settledScoreKeysForOperations(operations, final = false) {
  if (final) return new Set(priorityScoreKeys);
  const terminal = (status) => ["completed", "complete", "limited", "unavailable", "failed", "timed_out", "cancelled", "skipped", "discovery_only"].includes(status);
  const settled = new Set();
  const secDone = terminal(operations?.retrieval?.status) || terminal(operations?.domains?.capital?.status) || terminal(operations?.domains?.financial?.status);
  const capitalDone = terminal(operations?.domains?.capital?.status) || secDone;
  const financialDone = terminal(operations?.domains?.financial?.status) || secDone;
  const listingDone = terminal(operations?.bounded_sources?.nasdaq) || terminal(operations?.domains?.capital?.status);
  const catalystDone = terminal(operations?.bounded_sources?.news) || terminal(operations?.domains?.catalyst?.status);
  const marketDone = terminal(operations?.bounded_sources?.market) || terminal(operations?.domains?.catalyst?.status);
  const synthesisDone = !operations?.synthesis || terminal(operations.synthesis.status);
  if (capitalDone) ["dilution_historical_severity", "dilution_potential_impact"].forEach((key) => settled.add(key));
  if (capitalDone && financialDone) settled.add("dilution_future_likelihood");
  if (capitalDone && listingDone) settled.add("reverse_split_risk");
  if (financialDone) settled.add("financial_health");
  if (catalystDone && synthesisDone) settled.add("catalyst_strength");
  if (catalystDone && marketDone && synthesisDone) settled.add("near_term_setup_quality");
  return settled;
}
export function buildScorePresentation(score, { final = true, settled = final } = {}) {
  const directionLabel = score.direction === "higher_is_more_risk" ? "Higher = More Risk" : "Higher = Stronger";
  if (settled && score.state === "confirmed" && Number.isFinite(score.value)) {
    const stars = scoreToStars(score.value);
    return { state: "scored", stateLabel: "Scored", stars, directionLabel, accessibleLabel: `${stars} out of 5 stars; internal score ${score.value} out of 10; ${directionLabel}` };
  }
  if (!settled) return { state: "researching", stateLabel: "Researching", stars: null, directionLabel, accessibleLabel: `Researching; no provisional score; ${directionLabel}` };
  if (score.state === "limited_coverage") return { state: "limited", stateLabel: "Limited", stars: null, directionLabel, accessibleLabel: `Limited coverage; no score; ${directionLabel}` };
  if (score.state === "not_applicable") return { state: "not_applicable", stateLabel: "Not applicable", stars: null, directionLabel, accessibleLabel: `Not applicable; no score; ${directionLabel}` };
  return { state: "unscored", stateLabel: "Unscored", stars: null, directionLabel, accessibleLabel: `Unscored; no score; ${directionLabel}` };
}
export function buildPriorityFindings(report) {
  const riskClaimIds = new Set(["reverse_splits", "dilution", "compliance_and_warnings"].flatMap((key) => report.sections[key].items.flatMap((item) => item.claim_ids)));
  const stateRank = { unknown: 0, limited_coverage: 1, confirmed: 2, not_found: 3, not_applicable: 4 };
  const materialityRank = { high: 0, medium: 1, low: 2 };
  const claimFindings = report.claims.filter((claim) => ["unknown", "limited_coverage"].includes(claim.state) || riskClaimIds.has(claim.id));
  const unresolvedSections = Object.entries(report.sections)
    .filter(([, section]) => ["unknown", "limited_coverage"].includes(section.state))
    .map(([key, section]) => ({
      id: `section-${key}`,
      text: `${sectionLabels[key]}: ${section.summary}`,
      materiality: ["reverse_splits", "dilution", "compliance_and_warnings"].includes(key) ? "high" : "medium",
      state: section.state,
      claim_ids: section.claim_ids
    }));
  const financialWarnings = report.financial_assessment.material_warnings.map((warning) => ({
    id: `financial-${warning.id}`,
    text: `${warning.title}: ${warning.summary}`,
    materiality: ["critical", "high"].includes(warning.severity) ? "high" : warning.severity === "medium" ? "medium" : "low",
    state: warning.state,
    priority: ["critical", "high"].includes(warning.severity) ? 0 : 1,
    claim_ids: warning.claim_ids
  }));
  return [...financialWarnings, ...claimFindings, ...unresolvedSections]
    .sort((a, b) => (stateRank[a.state] - stateRank[b.state]) || (materialityRank[a.materiality] - materialityRank[b.materiality]) || ((a.priority ?? 1) - (b.priority ?? 1)) || a.id.localeCompare(b.id));
}
export function buildDashboardView(report, { final = true, settledScoreKeys = new Set(final ? priorityScoreKeys : []) } = {}) {
  const sourcesById = new Map(report.sources.map((source) => [source.id, source]));
  const claimsById = new Map(report.claims.map((claim) => [claim.id, claim]));
  const sourcesForClaims = (claimIds = []) => {
    const ids = new Set(claimIds.flatMap((claimId) => claimsById.get(claimId)?.source_ids || []));
    return [...ids].map((id) => sourcesById.get(id)).filter(Boolean);
  };
  const financialScore = report.scores.financial_health;
  const scoreForSummaryKey = (key) => {
    if (report.scores[key]) return { key, label: scoreLabels[key], description: scoreDescriptions[key], ...report.scores[key], presentation: buildScorePresentation(report.scores[key], { final, settled: settledScoreKeys.has(key) }) };
    const metric = report.financial_assessment.metrics[key] ?? { state: "unknown", value: null, unit: null, observations: [], annual_observations: [], summary: `${financialMetricLabels[key]} is not available in this report.`, claim_ids: [] };
    const independentScore = report.scores[financialTrendScoreKeys[key]];
    const settled = settledScoreKeys.has("financial_health");
    const displayScore = independentScore
      ? independentScore
      : { state: metric.state === "limited_coverage" ? "limited_coverage" : "unknown", value: null, scale_max: 10, direction: "higher_is_better", confidence: "unknown", methodology_version: financialScore.methodology_version, time_horizon: financialScore.time_horizon, explanation: `${metric.summary} This metric has no independent methodology score, so no stars are shown.`, claim_ids: metric.claim_ids, components: [] };
    return { key, label: key === "debt" ? "Debt" : financialMetricLabels[key], description: scoreDescriptions[key], metric, ...displayScore, presentation: buildScorePresentation(displayScore, { final, settled }) };
  };
  return {
    report, findings: buildPriorityFindings(report), sourcesForClaims,
    scoreSummary: scoreSummaryOrder.map(scoreForSummaryKey),
    sections: Object.entries(sectionLabels).map(([key, label]) => ({ key, label, ...report.sections[key] }))
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function badge(state) {
  const node = element("span", "badge", formatLabel(state));
  node.dataset.state = state;
  return node;
}
function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
function appendSourceLinks(parent, sources) {
  if (!sources.length) return;
  const links = element("div", "source-links");
  links.setAttribute("aria-label", "Supporting sources");
  sources.forEach((source, index) => {
    const link = element("a", "", `[${index + 1}] ${source.title} · ${formatDate(source.published_date)}`);
    link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    links.append(link);
  });
  parent.append(links);
}
function renderStars(score) {
  const { presentation } = score; const tooltipId = `score-tooltip-${score.key}`;
  const wrapper = element("button", "star-rating score-tooltip-trigger"); wrapper.type = "button";
  wrapper.setAttribute("aria-label", presentation.accessibleLabel);
  wrapper.setAttribute("aria-describedby", tooltipId);
  const visual = element("span", "stars"); visual.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 5; index += 1) {
    const remaining = presentation.stars - index;
    visual.append(element("span", `star ${remaining >= 1 ? "full" : remaining >= 0.5 ? "half" : "empty"}`, remaining >= 1 ? "★" : "☆"));
  }
  const tooltip = element("span", "score-tooltip", scoreTooltipText(score.key, score, presentation));
  tooltip.id = tooltipId; tooltip.setAttribute("role", "tooltip");
  wrapper.append(visual, element("span", "visually-hidden", presentation.accessibleLabel), tooltip);
  return wrapper;
}
function renderHeader(view) {
  const { report } = view;
  const panel = element("header", "panel report-header");
  const titleBlock = element("div");
  titleBlock.append(element("p", "eyebrow", `${formatLabel(report.metadata.stage)} · as of ${formatDate(report.metadata.as_of)}`));
  titleBlock.append(element("h2", "report-title", `${report.security.ticker} · ${report.issuer.legal_name}`));
  const context = element("div", "context-list");
  [formatLabel(report.security.security_type), report.security.listing_venue, formatLabel(report.security.listing_status), `Issuer confidence: ${formatLabel(report.issuer.identity_confidence)}`].forEach((text) => context.append(element("span", "", text)));
  titleBlock.append(context);
  const badges = element("div", "badge-row");
  badges.append(badge(report.metadata.completion_status), badge(report.security.evidence_state));
  panel.append(titleBlock, badges);
  return panel;
}
function renderCoverage(view) {
  const { report } = view;
  const panel = element("section", "panel");
  const heading = element("div", "panel-heading");
  heading.append(element("h2", "", "Coverage & identity"), badge(report.issuer.identity_state));
  panel.append(heading);
  appendSourceLinks(panel, view.sourcesForClaims(report.issuer.claim_ids));
  if (report.issuer.prior_identities.length) {
    const details = element("details");
    const list = element("ul", "prior-list");
    report.issuer.prior_identities.forEach((identity) => {
      const item = element("li", "", `${identity.name || "Name unknown"}${identity.ticker ? ` (${identity.ticker})` : ""} · ${identity.effective_from || "start unknown"} to ${identity.effective_to || "end unknown"} · ${formatLabel(identity.linkage_state)}, ${formatLabel(identity.linkage_confidence)} confidence`);
      appendSourceLinks(item, view.sourcesForClaims(identity.claim_ids)); list.append(item);
    });
    details.append(element("summary", "", `${report.issuer.prior_identities.length} prior ${report.issuer.prior_identities.length === 1 ? "identity" : "identities"}`), list);
    panel.append(details);
  }
  if (report.metadata.coverage_limitations.length) {
    const limitations = element("div", "limitations");
    report.metadata.coverage_limitations.forEach((limitation) => {
      const item = element("article", "limitation");
      item.append(element("h3", "", "Coverage limitation"), element("p", "", limitation.explanation), element("p", "muted", `Affected: ${limitation.affected_sections.map(formatLabel).join(", ")}`));
      limitations.append(item);
    });
    panel.append(limitations);
  } else panel.append(element("p", "empty-note", "No structured coverage limitations were reported."));
  return panel;
}
function renderOperations(operations) {
  const panel = element("section", "panel operations-panel");
  panel.append(element("h2", "", "Research status & budget"));
  if (!operations) {
    panel.append(element("p", "empty-note", "Provider usage and cost telemetry were unavailable; cost is unknown, not zero."));
    return panel;
  }
  const cost = Number.isFinite(operations.estimated_cost_usd) ? `Estimated cost $${operations.estimated_cost_usd.toFixed(4)}` : "Cost unknown";
  panel.append(element("p", "", `${formatLabel(operations.stage)} · ${(operations.latency_ms / 1000).toFixed(1)}s · ${cost}`));
  const details = element("details", "operations-details"); const body = element("div", "operations-detail-body");
  details.append(element("summary", "", "Technical operations telemetry"));
  body.append(element("p", "muted", `${operations.input_tokens ?? "Unknown"} input tokens · ${operations.output_tokens ?? "Unknown"} output tokens · ${operations.web_search_calls} web searches`));
  if (operations.stage === "fast" && operations.within_first_useful_target === false) body.append(element("p", "coverage-note", "The first usable Fast domain arrived outside the 3–10 second target."));
  if (operations.stage === "fast" && operations.within_latency_target === false) body.append(element("p", "coverage-note", "Fast collection exceeded the 20-second hard operating target."));
  if (operations.stage === "fast" && operations.domains) body.append(element("p", "muted", Object.entries(operations.domains).map(([name, value]) => `${formatLabel(name)}: ${formatLabel(value.status)}`).join(" · ")));
  if (operations.stage === "fast" && operations.synthesis) body.append(element("p", "muted", `AI synthesis: ${formatLabel(operations.synthesis.status)}${operations.synthesis.priority_evidence_ids ? ` · ${operations.synthesis.priority_evidence_ids.length} evidence records prioritized` : ""}. Deterministic evidence remains authoritative.`));
  if (operations.stage === "fast" && operations.retrieval) body.append(element("p", "muted", `SEC retrieval: ${formatLabel(operations.retrieval.status)} · ${operations.retrieval.sec_request_count ?? "Unknown"} network requests`));
  if (operations.stage === "fast" && operations.bounded_sources) body.append(element("p", "muted", `Bounded sources: ${formatLabel(operations.bounded_sources.status)} · Nasdaq ${formatLabel(operations.bounded_sources.nasdaq)} · news ${formatLabel(operations.bounded_sources.news)}${operations.bounded_sources.news_reason ? ` (${formatLabel(operations.bounded_sources.news_reason)})` : ""} · market ${formatLabel(operations.bounded_sources.market)}${operations.bounded_sources.market_reason ? ` (${formatLabel(operations.bounded_sources.market_reason)})` : ""} · ${operations.bounded_sources.request_count} network requests · Alpha Vantage ${operations.bounded_sources.alpha_vantage_requests_today}/${operations.bounded_sources.alpha_vantage_free_daily_limit} local daily allowance`));
  if (operations.stage === "fast" && operations.within_cost_target === false) body.append(element("p", "coverage-note", "This report exceeded the $0.03 normal Fast cost ceiling."));
  if (operations.stage === "deep" && operations.fast_foundation) {
    const foundation = operations.fast_foundation;
    body.append(element("p", "muted", `Fast foundation: ${formatLabel(foundation.mode)} · ${foundation.reused_fast_evidence_count ?? 0} evidence records reused · ${foundation.new_deep_evidence_count ?? 0} new Deep claims · ${foundation.duplicate_retrieval_avoided ?? 0} duplicate requests avoided`));
    if (foundation.unresolved_components_targeted?.length) body.append(element("p", "muted", `Deep targeted unresolved components first: ${foundation.unresolved_components_targeted.map(formatLabel).join(", ")}.`));
  }
  if (operations.stage === "deep" && operations.evidence_lineage?.revisions?.length) body.append(element("p", "coverage-note", `${operations.evidence_lineage.revisions.length} Fast-to-Deep evidence revision${operations.evidence_lineage.revisions.length === 1 ? "" : "s"} retained for traceability.`));
  body.append(element("p", "muted", "Operational budgets do not certify evidence completeness; review coverage and unknowns below."));
  details.append(body); panel.append(details);
  return panel;
}
function renderFindings(view) {
  const panel = element("section", "panel");
  const heading = element("div", "panel-heading");
  heading.append(element("h2", "", "Priority findings"), element("span", "muted", "Unknowns first, then material risk evidence")); panel.append(heading);
  const list = element("div", "priority-list");
  if (!view.findings.length) list.append(element("p", "empty-note", "No material warning or unresolved claim was reported."));
  view.findings.forEach((claim) => {
    const item = element("article", "finding"); item.dataset.priority = ["unknown", "limited_coverage"].includes(claim.state) ? "unknown" : claim.materiality;
    const row = element("div", "badge-row"); row.append(badge(claim.state), element("span", "badge", `${formatLabel(claim.materiality)} materiality`));
    item.append(row, element("p", "", claim.text)); appendSourceLinks(item, view.sourcesForClaims(claim.claim_ids || [claim.id])); list.append(item);
  });
  panel.append(list); return panel;
}
function renderScores(view) {
  const panel = element("section", "panel score-panel");
  const heading = element("div", "panel-heading"); heading.append(element("h2", "", "Fast score summary"), element("span", "muted", "No combined verdict")); panel.append(heading);
  const list = element("div", "score-summary");
  view.scoreSummary.forEach((score) => {
    const row = element("article", "score-summary-row"); row.dataset.presentationState = score.presentation.state;
    const copy = element("div", "score-summary-copy"); copy.append(element("h3", "", score.label));
    if (score.metric?.state === "confirmed" && Number.isFinite(score.metric.value)) {
      const count = score.metric.observations?.length ?? 0; const trend = score.metric.trend === "unknown" ? "Trend not classified" : formatLabel(score.metric.trend); const context = count > 1 ? `${trend} · ${count} comparable periods` : "Latest supported period · no trend inferred";
      copy.append(element("p", "score-metric-value", `${score.metric.value.toLocaleString()} ${score.metric.unit} · ${context}`));
    }
    const value = element("div", "score-summary-value");
    if (score.presentation.state === "scored") value.append(renderStars(score));
    else value.append(badge(score.presentation.state), element("span", "visually-hidden", score.presentation.accessibleLabel));
    row.append(copy, value); list.append(row);
  });
  panel.append(list); return panel;
}
function renderCatalystAssessment(view) {
  const assessment = view.report.catalyst_assessment;
  const panel = element("section", "panel catalyst-assessment");
  const heading = element("div", "panel-heading");
  heading.append(element("h2", "", "Catalyst assessment"), badge(assessment.current.state));
  panel.append(heading);

  const current = element("article", "section-card");
  current.append(element("h3", "", assessment.current.title));
  current.append(element("p", "muted", `${formatLabel(assessment.current.classification)} · ${assessment.current.event_date ? formatDate(assessment.current.event_date) : "Date unavailable"} · ${formatLabel(assessment.current.confidence)} confidence`));
  current.append(element("p", "", assessment.current.summary));
  appendSourceLinks(current, view.sourcesForClaims(assessment.current.claim_ids));
  const factors = element("div", "factor-grid");
  Object.entries(assessment.current.factors).forEach(([key, factor]) => {
    const card = element("article", "factor-card");
    const title = element("div", "section-title");
    title.append(element("h4", "", catalystFactorLabels[key]), badge(factor.rating));
    card.append(title, element("p", "", factor.explanation));
    appendSourceLinks(card, view.sourcesForClaims(factor.claim_ids));
    factors.append(card);
  });
  panel.append(current);

  const marketItems = view.report.sections.financial_context.items.filter((item) => ["price_change_percent", "volume_ratio"].includes(item.unit));
  const market = element("article", "market-context section-card"); market.append(element("h3", "", "Current market context"));
  if (!marketItems.length) market.append(element("p", "empty-note", "Fresh bounded price/volume context is unavailable; setup may remain Limited or Unscored."));
  marketItems.forEach((item) => {
    const value = item.unit === "price_change_percent" ? `${item.value.toFixed(1)}% price change` : `${item.value.toFixed(1)}× relative volume`;
    market.append(element("p", "market-value", `${value} · ${item.event_date ? formatDate(item.event_date) : "Date unavailable"}`));
    appendSourceLinks(market, view.sourcesForClaims(item.claim_ids));
  });
  panel.append(market);

  const supporting = element("details", "catalyst-supporting");
  const supportingBody = element("div", "catalyst-supporting-body");
  supporting.append(element("summary", "", "Supporting catalyst factors, evidence, and Deep analogues"));
  supportingBody.append(factors);

  const evidence = element("div", "evidence-grid");
  [["Favorable evidence", assessment.favorable_evidence_claim_ids], ["Unfavorable evidence", assessment.unfavorable_evidence_claim_ids]].forEach(([title, claimIds]) => {
    const card = element("article", "section-card"); card.append(element("h3", "", title));
    if (!claimIds.length) card.append(element("p", "empty-note", "No supported evidence reported."));
    claimIds.forEach((claimId) => card.append(element("p", "", view.report.claims.find((claim) => claim.id === claimId)?.text || claimId)));
    appendSourceLinks(card, view.sourcesForClaims(claimIds)); evidence.append(card);
  });
  supportingBody.append(evidence);

  const analogues = element("article", "section-card");
  const analogueTitle = element("div", "section-title"); analogueTitle.append(element("h3", "", "Historical analogues"), badge(assessment.historical_analogues.state));
  analogues.append(analogueTitle, element("p", "", assessment.historical_analogues.summary));
  assessment.historical_analogues.coverage_notes.forEach((note) => analogues.append(element("p", "coverage-note", `Coverage note: ${note}`)));
  assessment.historical_analogues.items.forEach((item) => {
    const detail = element("div", "analogue");
    detail.append(element("h4", "", item.title), element("p", "muted", item.event_date ? formatDate(item.event_date) : "Date unavailable"), element("p", "", `Comparable because: ${item.comparison_basis}`));
    item.comparison_limitations.forEach((limit) => detail.append(element("p", "coverage-note", `Comparison limit: ${limit}`)));
    item.reaction_windows.forEach((window) => detail.append(element("p", "", `${window.label} (${formatDate(window.start)}–${formatDate(window.end)}): ${window.summary}`)));
    appendSourceLinks(detail, view.sourcesForClaims(item.claim_ids)); analogues.append(detail);
  });
  appendSourceLinks(analogues, view.sourcesForClaims(assessment.historical_analogues.claim_ids)); supportingBody.append(analogues);

  const implication = element("article", "section-card");
  const implicationTitle = element("div", "section-title"); implicationTitle.append(element("h3", "", "Near-term evidence implication"), badge(assessment.near_term_implication.state));
  implication.append(implicationTitle, element("p", "muted", `${formatLabel(assessment.near_term_implication.direction)} · ${formatLabel(assessment.near_term_implication.confidence)} confidence`), element("p", "", assessment.near_term_implication.summary));
  assessment.uncertainty.forEach((note) => implication.append(element("p", "coverage-note", `Uncertainty: ${note}`)));
  appendSourceLinks(implication, view.sourcesForClaims(assessment.near_term_implication.claim_ids)); supportingBody.append(implication);
  supporting.append(supportingBody); panel.append(supporting);
  return panel;
}
function renderVerticalBarChart({ label, observations, state, summary, colorClass = "chart-blue" }) {
  const card = element("article", "financial-chart");
  const title = element("div", "section-title"); title.append(element("h3", "", label), badge(state)); card.append(title);
  if (!observations.length) {
    card.append(element("p", "chart-unavailable", `${formatLabel(state)} — no trustworthy chart is available.`), element("p", "muted", summary));
    return card;
  }
  const values = observations.map((item) => item.value); const minimum = Math.min(0, ...values); const maximum = Math.max(0, ...values); const range = maximum - minimum || 1;
  const compact = (value) => Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const chart = element("div", `vertical-bar-chart ${colorClass}`);
  chart.setAttribute("role", "img"); chart.setAttribute("aria-label", `${label} in ${observations[0].unit}: ${observations.map((item) => `${item.value.toLocaleString()} for ${formatDate(item.period_end)}`).join(", ")}. ${observations.length === 1 ? "One observation; no trend inferred." : "Comparable observations in chronological order."}`);
  const midpoint = minimum + range / 2; const axis = element("div", "chart-y-axis"); axis.append(element("span", "", compact(maximum)), element("span", "", compact(midpoint)), element("span", "", compact(minimum)));
  const plot = element("div", "chart-plot"); const zero = element("span", "chart-zero-line"); zero.style.bottom = `${((-minimum / range) * 100).toFixed(2)}%`; plot.append(zero);
  observations.forEach((observation) => {
    const column = element("div", "chart-column"); const bar = element("span", `vertical-bar ${observation.value < 0 ? "negative" : "positive"}`);
    bar.style.height = `${(Math.abs(observation.value) / range * 100).toFixed(2)}%`; bar.style.bottom = `${(((Math.min(0, observation.value) - minimum) / range) * 100).toFixed(2)}%`;
    bar.title = `${observation.value.toLocaleString()} ${observation.unit}`;
    column.append(bar, element("span", "chart-bar-value", compact(observation.value)), element("span", "chart-x-label", formatDate(observation.period_end))); plot.append(column);
  });
  chart.append(axis, plot); card.append(chart, element("p", "muted", summary));
  return card;
}
function renderGroupedBarChart(titleText, series) {
  const card = element("article", "financial-chart grouped-financial-chart");
  const title = element("div", "section-title"); title.append(element("h3", "", titleText)); card.append(title);
  const useAnnual = series.some((item) => (item.metric.annual_observations?.length ?? 0) > 0);
  const selected = series.map((item) => ({ ...item, observations: useAnnual ? item.metric.annual_observations ?? [] : item.metric.observations ?? [] }));
  const unit = selected.find((item) => item.observations.length)?.observations[0]?.unit;
  selected.forEach((item) => { if (item.observations.some((observation) => observation.unit !== unit)) item.observations = []; });
  const values = selected.flatMap((item) => item.observations.map((observation) => observation.value));
  const legend = element("div", "chart-legend"); selected.forEach((item) => legend.append(element("span", `legend-item ${item.colorClass}`, item.label))); card.append(legend);
  if (!values.length) { card.append(element("p", "chart-unavailable", "Limited — no trustworthy comparable history is available.")); return card; }
  const periods = [...new Set(selected.flatMap((item) => item.observations.map((observation) => observation.period_end)))].sort();
  const minimum = Math.min(0, ...values); const maximum = Math.max(0, ...values); const range = maximum - minimum || 1;
  const compact = (value) => Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const chart = element("div", "vertical-bar-chart grouped-bar-chart");
  chart.setAttribute("role", "img"); chart.setAttribute("aria-label", `${titleText}, ${useAnnual ? "annual" : "comparable"} observations: ${selected.flatMap((item) => item.observations.map((observation) => `${item.label} ${observation.value.toLocaleString()} ${observation.unit} for ${formatDate(observation.period_end)}`)).join(", ")}.`);
  const axis = element("div", "chart-y-axis"); axis.append(element("span", "", compact(maximum)), element("span", "", compact(minimum + range / 2)), element("span", "", compact(minimum)));
  const plot = element("div", "chart-plot"); const zero = element("span", "chart-zero-line"); zero.style.bottom = `${((-minimum / range) * 100).toFixed(2)}%`; plot.append(zero);
  periods.forEach((period) => {
    const cluster = element("div", "chart-column chart-cluster");
    selected.forEach((item) => {
      const observation = item.observations.find((value) => value.period_end === period); if (!observation) return;
      const bar = element("span", `vertical-bar ${item.colorClass} ${observation.value < 0 ? "negative" : "positive"}`);
      bar.style.height = `${(Math.abs(observation.value) / range * 100).toFixed(2)}%`; bar.style.bottom = `${(((Math.min(0, observation.value) - minimum) / range) * 100).toFixed(2)}%`; bar.title = `${item.label}: ${observation.value.toLocaleString()} ${observation.unit}`; cluster.append(bar);
    });
    cluster.append(element("span", "chart-x-label", useAnnual ? period.slice(0, 4) : formatDate(period))); plot.append(cluster);
  });
  chart.append(axis, plot); card.append(chart, element("p", "muted", `${unit} · ${useAnnual ? "annual reported periods" : "bounded comparable periods"}. Missing series remain Limited; no values are interpolated.`));
  return card;
}
function renderFinancialAssessment(view) {
  const assessment = view.report.financial_assessment;
  const panel = element("section", "panel financial-assessment");
  const heading = element("div", "panel-heading");
  heading.append(element("h2", "", "Financial and share-structure charts"), badge(assessment.state));
  panel.append(heading, element("p", "muted", `${assessment.as_of ? `As of ${formatDate(assessment.as_of)}` : "Date unavailable"}${assessment.reporting_currency ? ` · ${assessment.reporting_currency}` : ""}`), element("p", "", assessment.summary));
  assessment.coverage_notes.forEach((note) => panel.append(element("p", "coverage-note", `Coverage note: ${note}`)));

  const metric = (key) => assessment.metrics[key] ?? { state: "unknown", observations: [], annual_observations: [], claim_ids: [], summary: `${financialMetricLabels[key]} is unavailable.` };
  const metrics = element("div", "financial-chart-grid grouped-chart-grid");
  metrics.append(
    renderGroupedBarChart("Income statement", [{ label: "Revenue", metric: metric("revenue"), colorClass: "series-blue" }, { label: "Net income / loss", metric: metric("profitability"), colorClass: "series-cyan" }]),
    renderGroupedBarChart("Balance sheet", [{ label: "Cash", metric: metric("cash"), colorClass: "series-blue" }, { label: "Total debt", metric: metric("debt"), colorClass: "series-amber" }]),
    renderGroupedBarChart("Cash flow", [{ label: "Operating cash flow", metric: metric("operating_cash_flow"), colorClass: "series-cyan" }, { label: "Free cash flow", metric: metric("free_cash_flow"), colorClass: "series-purple" }])
  );
  const shares = assessment.shares_outstanding ?? { state: "unknown", summary: "Reported shares outstanding are unavailable.", observations: [] };
  const shareObservations = shares.annual_observations?.length ? shares.annual_observations : shares.observations;
  const shareChart = renderVerticalBarChart({ label: "Capital structure — Shares outstanding", observations: shares.state === "confirmed" ? shareObservations : [], state: shares.state, summary: shares.summary, colorClass: "chart-purple" });
  appendSourceLinks(shareChart, view.sourcesForClaims(shares.claim_ids)); metrics.append(shareChart);
  panel.append(metrics);

  const goingConcern = element("article", "section-card");
  const goingTitle = element("div", "section-title"); goingTitle.append(element("h3", "", "Going concern"), badge(assessment.going_concern.state));
  goingConcern.append(goingTitle, element("p", "muted", assessment.going_concern.as_of ? `As of ${formatDate(assessment.going_concern.as_of)}` : "Date unavailable"), element("p", "", assessment.going_concern.summary));
  appendSourceLinks(goingConcern, view.sourcesForClaims(assessment.going_concern.claim_ids)); panel.append(goingConcern);

  if (assessment.material_warnings.length) {
    const warnings = element("div", "financial-warnings");
    assessment.material_warnings.forEach((warning) => {
      const card = element("article", "finding"); card.dataset.priority = ["critical", "high"].includes(warning.severity) ? "high" : warning.severity;
      const title = element("div", "section-title"); title.append(element("h3", "", warning.title), badge(warning.state));
      card.append(title, element("p", "muted", `${formatLabel(warning.severity)} severity · ${warning.as_of ? formatDate(warning.as_of) : "Date unavailable"}`), element("p", "", warning.summary));
      appendSourceLinks(card, view.sourcesForClaims(warning.claim_ids)); warnings.append(card);
    });
    panel.append(warnings);
  }
  return panel;
}
function renderScoreDetails(view) {
  const panel = element("section", "panel score-detail-panel");
  panel.append(element("h2", "", "Why the scores look this way"), element("p", "muted", "Financial Health contains its supporting financial inputs. Independent capital-risk scores keep separate explanations, evidence, and sources."));
  const renderDetailGroup = (title, keys) => {
    const group = element("section", "score-detail-group"); group.append(element("h3", "", title));
    keys.forEach((key) => {
      const score = view.scoreSummary.find((item) => item.key === key);
      const details = element("details", "metric-details");
      details.append(element("summary", "", `${score.label} — ${score.presentation.stateLabel}`));
      const body = element("div", "score-detail-body");
      body.append(element("p", "", score.description), element("p", "", score.explanation), element("p", "muted", `${score.presentation.directionLabel} · ${score.presentation.state === "scored" ? `Internal value: ${score.value} / ${score.scale_max}` : "Internal value: not available"} · ${formatLabel(score.confidence)} confidence · methodology ${score.methodology_version}`));
      if (score.components.length) {
        const list = element("ul", "section-items");
        score.components.forEach((component) => {
          const item = element("li", "section-item");
          item.append(element("strong", "", formatLabel(component.key)), element("p", "muted", `${formatLabel(component.state)} · ${component.value === null ? "Unscored" : `${component.value} / 10`} · weight ${component.weight}`), element("p", "", component.explanation));
          appendSourceLinks(item, view.sourcesForClaims(component.claim_ids)); list.append(item);
        });
        body.append(element("h4", "", "Key supporting inputs"), list);
      }
      appendSourceLinks(body, view.sourcesForClaims(score.claim_ids)); details.append(body); group.append(details);
    });
    panel.append(group);
  };
  const financialHealth = view.scoreSummary.find((item) => item.key === "financial_health");
  const financialDetails = element("section", "score-detail-group"); financialDetails.append(element("h3", "", "Financial Health explanation"));
  const details = element("details", "metric-details"); details.append(element("summary", "", `Financial health — ${financialHealth.presentation.stateLabel}`));
  const body = element("div", "score-detail-body"); body.append(element("p", "", financialHealth.explanation), element("p", "muted", `${financialHealth.presentation.directionLabel} · ${financialHealth.presentation.state === "scored" ? `Internal value: ${financialHealth.value} / ${financialHealth.scale_max}` : "Internal value: not available"} · ${formatLabel(financialHealth.confidence)} confidence · methodology ${financialHealth.methodology_version}`));
  const inputs = element("div", "financial-input-details");
  financialMetricOrder.forEach((key) => {
    const metric = view.report.financial_assessment.metrics[key]; const trendScore = view.scoreSummary.find((score) => score.key === key); const item = element("article", "financial-input-detail");
    const title = element("div", "section-title"); title.append(element("h4", "", financialMetricLabels[key]), badge(metric.state)); item.append(title);
    if (metric.state === "confirmed") item.append(element("p", "", `${metric.value.toLocaleString()} ${metric.unit} · ${metric.observations?.length > 1 ? formatLabel(metric.trend) : "one period; no trend inferred"}`));
    item.append(element("p", "", metric.summary));
    item.append(element("p", "coverage-note", `Independent trend: ${trendScore.presentation.stateLabel}. ${trendScore.explanation}`));
    appendSourceLinks(item, view.sourcesForClaims(metric.claim_ids)); inputs.append(item);
  });
  financialHealth.components.forEach((component) => body.append(element("p", "coverage-note", `${formatLabel(component.key)} (${formatLabel(component.state)}): ${component.explanation}`)));
  view.report.financial_assessment.coverage_notes.forEach((note) => body.append(element("p", "coverage-note", `Coverage note: ${note}`)));
  body.append(inputs); appendSourceLinks(body, view.sourcesForClaims(financialHealth.claim_ids)); details.append(body); financialDetails.append(details); panel.append(financialDetails);
  renderDetailGroup("Dilution and reverse-split explanations", ["dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk"]);
  return panel;
}
function renderSections(view) {
  const panel = element("section", "panel"); panel.append(element("h2", "", "Research sections")); const grid = element("div", "section-grid");
  view.sections.forEach((section) => {
    const card = element("article", "section-card"); const title = element("div", "section-title"); title.append(element("h3", "", section.label), badge(section.state)); card.append(title, element("p", "", section.summary));
    section.coverage_notes.forEach((note) => card.append(element("p", "coverage-note", `Coverage note: ${note}`)));
    if (section.items.length) {
      const items = element("ul", "section-items");
      section.items.forEach((data) => {
        const item = element("li", "section-item"); item.append(element("strong", "", data.title), element("p", "muted", `${data.event_date ? formatDate(data.event_date) : "Date unavailable"} · ${formatLabel(data.kind)} · ${formatLabel(data.state)}`), element("p", "", data.summary));
        appendSourceLinks(item, view.sourcesForClaims(data.claim_ids)); items.append(item);
      }); card.append(items);
    }
    appendSourceLinks(card, view.sourcesForClaims(section.claim_ids)); grid.append(card);
  }); panel.append(grid); return panel;
}
function renderSources(view) {
  const panel = element("section", "panel"); panel.append(element("h2", "", "Source library")); const list = element("ol", "source-list");
  view.report.sources.forEach((source) => {
    const item = element("li"); const link = element("a", "", source.title); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    item.append(link, element("p", "source-meta", `${formatDate(source.published_date)} · ${formatLabel(source.source_type)} · ${formatLabel(source.confidence)} confidence`)); list.append(item);
  }); panel.append(list); return panel;
}
function renderSupportingEvidence(view) {
  const panel = element("section", "panel supporting-panel");
  const details = element("details"); const body = element("div", "supporting-body");
  details.append(element("summary", "", "Detailed research, unresolved findings, and evidence"));
  body.append(renderFindings(view), renderCoverage(view), renderSections(view)); details.append(body); panel.append(details);
  return panel;
}
function renderTopLayout(view, operations) {
  const layout = element("div", "fast-top-layout");
  const primary = element("div", "fast-top-primary");
  const sidebar = element("aside", "fast-score-sidebar");
  primary.append(renderHeader(view), renderOperations(operations), renderCatalystAssessment(view));
  sidebar.append(renderScores(view));
  layout.append(primary, sidebar);
  return layout;
}
export function renderDashboard(container, report, operations = null, { final = true } = {}) {
  const view = buildDashboardView(report, { final, settledScoreKeys: settledScoreKeysForOperations(operations, final) });
  container.replaceChildren(renderTopLayout(view, operations), renderFinancialAssessment(view), renderScoreDetails(view), renderSupportingEvidence(view), renderSources(view)); container.hidden = false;
}
async function showRuntimeMode() {
  try {
    const response = await fetch("/api/runtime"); if (!response.ok) return; const runtime = await response.json(); if (runtime.mode !== "mock") return;
    const tickers = runtime.demoTickers || [runtime.demoTicker]; const banner = document.getElementById("mock-banner");
    banner.textContent = `Mock testing mode — enter ${tickers.join(", ")} for complete, partial, or pending deterministic reports. No OpenAI tokens are used.`; banner.hidden = false;
    document.getElementById("ticker").placeholder = `Demo ticker: ${runtime.demoTicker}`;
  } catch (_error) { /* Search remains available if runtime metadata cannot load. */ }
}
export function initializeDashboard() {
  const form = document.getElementById("research-form"); const tickerInput = document.getElementById("ticker"); const analyzeButton = document.getElementById("analyze-button"); const deepButton = document.getElementById("deep-analyze-button"); const status = document.getElementById("status"); const results = document.getElementById("results"); let submitting = false;
  tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (submitting) return; const validation = validateTickerInput(tickerInput.value);
    if (!validation.valid) { status.textContent = validation.message; status.dataset.kind = "error"; results.replaceChildren(); results.hidden = true; return; }
    const stage = event.submitter?.value === "deep" ? "deep" : "fast"; const ticker = validation.ticker; tickerInput.value = ticker; submitting = true; analyzeButton.disabled = true; deepButton.disabled = true; status.textContent = `${stage === "deep" ? "Running deeper research" : "Researching"} ${ticker}…`; status.dataset.kind = "loading"; results.setAttribute("aria-busy", "true"); results.replaceChildren(); results.hidden = true;
    try {
      if (stage === "fast") {
        const response = await fetch(`/api/analyze-stream?ticker=${encodeURIComponent(ticker)}`); if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Something went wrong."); }
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let received = false;
        while (true) {
          const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n"); buffer = done ? "" : lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue; const data = JSON.parse(line); if (data.type === "error") throw new Error(data.error);
            if (data.type === "report") { received = true; const presentationFinal = data.final && data.report.metadata.completion_status !== "pending"; renderDashboard(results, data.report, data.operations, { final: presentationFinal }); status.textContent = presentationFinal ? `${ticker} fast research ${formatLabel(data.report.metadata.completion_status).toLowerCase()}.` : `${ticker}: showing completed Fast domains while remaining checks continue…`; status.dataset.kind = presentationFinal ? "success" : "loading"; }
          }
          if (done) break;
        }
        if (!received) throw new Error("Research returned no usable Fast domains.");
      } else {
        const response = await fetch(`/api/analyze?ticker=${encodeURIComponent(ticker)}&stage=${stage}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Something went wrong.");
        renderDashboard(results, data.report, data.operations); status.textContent = `${ticker} ${formatLabel(stage).toLowerCase()} research ${formatLabel(data.report.metadata.completion_status).toLowerCase()}.`; status.dataset.kind = "success";
      }
    } catch (error) { status.textContent = "Research could not be completed."; status.dataset.kind = "error"; results.replaceChildren(element("div", "panel", error.message)); results.hidden = false; }
    finally { submitting = false; analyzeButton.disabled = false; deepButton.disabled = false; results.setAttribute("aria-busy", "false"); }
  });
  showRuntimeMode();
}
if (typeof document !== "undefined") initializeDashboard();
