const tickerPattern = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/;

export const sectionLabels = Object.freeze({
  reverse_splits: "Reverse splits", dilution: "Dilution & financing", dividends: "Dividends",
  compliance_and_warnings: "Compliance & warnings", financial_context: "Financial context", catalysts_and_news: "Catalysts & news"
});
export const scoreGroups = Object.freeze([
  { title: "Capital structure risk", keys: ["dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk"] },
  { title: "Company context", keys: ["financial_health", "long_term_company_quality"] },
  { title: "Near-term catalyst & setup", keys: ["catalyst_strength", "near_term_setup_quality"] }
]);
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

export function validateTickerInput(value) {
  const ticker = String(value || "").trim().toUpperCase();
  if (!ticker) return { valid: false, ticker, message: "Please enter a ticker." };
  if (ticker.length > 15 || !tickerPattern.test(ticker)) return { valid: false, ticker, message: "Ticker must be 1–15 letters or numbers, with single periods or hyphens between segments." };
  return { valid: true, ticker, message: "" };
}
export function formatLabel(value) {
  return stateLabels[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  return [...claimFindings, ...unresolvedSections]
    .sort((a, b) => (stateRank[a.state] - stateRank[b.state]) || (materialityRank[a.materiality] - materialityRank[b.materiality]) || a.id.localeCompare(b.id));
}
export function buildDashboardView(report) {
  const sourcesById = new Map(report.sources.map((source) => [source.id, source]));
  const claimsById = new Map(report.claims.map((claim) => [claim.id, claim]));
  const sourcesForClaims = (claimIds = []) => {
    const ids = new Set(claimIds.flatMap((claimId) => claimsById.get(claimId)?.source_ids || []));
    return [...ids].map((id) => sourcesById.get(id)).filter(Boolean);
  };
  return {
    report, findings: buildPriorityFindings(report), sourcesForClaims,
    scoreGroups: scoreGroups.map((group) => ({ ...group, scores: group.keys.map((key) => ({ key, label: scoreLabels[key], ...report.scores[key] })) })),
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
  const panel = element("section", "panel"); panel.append(element("h2", "", "Score components"));
  const groups = element("div", "score-groups");
  view.scoreGroups.forEach((group) => {
    const section = element("section"); section.append(element("h3", "score-group-title", group.title));
    const grid = element("div", "score-grid");
    group.scores.forEach((score) => {
      const card = element("article", "score-card"); const title = element("div", "section-title"); title.append(element("h3", "", score.label), badge(score.state)); card.append(title);
      if (score.value === null) card.append(element("p", "score-state", formatLabel(score.state)));
      else { const value = element("div", "score-value"); value.append(element("strong", "", String(score.value)), element("span", "", `/ ${score.scale_max}`)); card.append(value); }
      card.append(element("p", "score-direction", `${formatLabel(score.direction)} · ${score.time_horizon}`), element("p", "", score.explanation));
      appendSourceLinks(card, view.sourcesForClaims(score.claim_ids)); grid.append(card);
    });
    section.append(grid); groups.append(section);
  });
  panel.append(groups); return panel;
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
  current.append(factors);
  panel.append(current);

  const evidence = element("div", "evidence-grid");
  [["Favorable evidence", assessment.favorable_evidence_claim_ids], ["Unfavorable evidence", assessment.unfavorable_evidence_claim_ids]].forEach(([title, claimIds]) => {
    const card = element("article", "section-card"); card.append(element("h3", "", title));
    if (!claimIds.length) card.append(element("p", "empty-note", "No supported evidence reported."));
    claimIds.forEach((claimId) => card.append(element("p", "", view.report.claims.find((claim) => claim.id === claimId)?.text || claimId)));
    appendSourceLinks(card, view.sourcesForClaims(claimIds)); evidence.append(card);
  });
  panel.append(evidence);

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
  appendSourceLinks(analogues, view.sourcesForClaims(assessment.historical_analogues.claim_ids)); panel.append(analogues);

  const implication = element("article", "section-card");
  const implicationTitle = element("div", "section-title"); implicationTitle.append(element("h3", "", "Near-term evidence implication"), badge(assessment.near_term_implication.state));
  implication.append(implicationTitle, element("p", "muted", `${formatLabel(assessment.near_term_implication.direction)} · ${formatLabel(assessment.near_term_implication.confidence)} confidence`), element("p", "", assessment.near_term_implication.summary));
  assessment.uncertainty.forEach((note) => implication.append(element("p", "coverage-note", `Uncertainty: ${note}`)));
  appendSourceLinks(implication, view.sourcesForClaims(assessment.near_term_implication.claim_ids)); panel.append(implication);
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
export function renderDashboard(container, report) {
  const view = buildDashboardView(report);
  container.replaceChildren(renderHeader(view), renderCoverage(view), renderFindings(view), renderCatalystAssessment(view), renderScores(view), renderSections(view), renderSources(view)); container.hidden = false;
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
  const form = document.getElementById("research-form"); const tickerInput = document.getElementById("ticker"); const analyzeButton = document.getElementById("analyze-button"); const status = document.getElementById("status"); const results = document.getElementById("results"); let submitting = false;
  tickerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (submitting) return; const validation = validateTickerInput(tickerInput.value);
    if (!validation.valid) { status.textContent = validation.message; status.dataset.kind = "error"; results.replaceChildren(); results.hidden = true; return; }
    const ticker = validation.ticker; tickerInput.value = ticker; submitting = true; analyzeButton.disabled = true; analyzeButton.textContent = "Researching…"; status.textContent = `Researching ${ticker}…`; status.dataset.kind = "loading"; results.setAttribute("aria-busy", "true"); results.replaceChildren(); results.hidden = true;
    try {
      const response = await fetch(`/api/analyze?ticker=${encodeURIComponent(ticker)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Something went wrong.");
      renderDashboard(results, data.report); status.textContent = `${ticker} research ${formatLabel(data.report.metadata.completion_status).toLowerCase()}.`; status.dataset.kind = "success";
    } catch (error) { status.textContent = "Research could not be completed."; status.dataset.kind = "error"; results.replaceChildren(element("div", "panel", error.message)); results.hidden = false; }
    finally { submitting = false; analyzeButton.disabled = false; analyzeButton.textContent = "Analyze"; results.setAttribute("aria-busy", "false"); }
  });
  showRuntimeMode();
}
if (typeof document !== "undefined") initializeDashboard();
