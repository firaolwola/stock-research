import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDashboardView, buildPriorityFindings, buildScorePresentation, financialMetricOrder, priorityScoreKeys, scoreSummaryOrder, scoreToStars, sectionLabels, settledScoreKeysForOperations, validateTickerInput } from "../public/dashboard.js";
import { loadReportFixture } from "../support/report-fixtures.js";

test("dashboard exposes every report section and the approved unified score order", async () => {
  const view = buildDashboardView(await loadReportFixture("complete"));
  assert.deepEqual(view.sections.map((section) => section.key), Object.keys(sectionLabels));
  assert.deepEqual(priorityScoreKeys, ["dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk", "financial_health", "catalyst_strength", "near_term_setup_quality"]);
  assert.deepEqual(financialMetricOrder, ["revenue", "profitability", "debt", "free_cash_flow", "cash", "cash_burn"]);
  assert.deepEqual(view.scoreSummary.map((score) => score.key), scoreSummaryOrder);
  assert.deepEqual(scoreSummaryOrder, ["financial_health", "revenue", "profitability", "debt", "free_cash_flow", "cash", "cash_burn", "dilution_historical_severity", "dilution_future_likelihood", "dilution_potential_impact", "reverse_split_risk"]);
});

test("0–10 internal scores map to 0–5 stars with half-stars", () => {
  for (const [internal, stars] of [[0, 0], [1, 0.5], [2, 1], [4, 2], [5, 2.5], [6, 3], [8, 4], [10, 5]]) assert.equal(scoreToStars(internal), stars);
  assert.equal(scoreToStars(7.4), 3.5);
  assert.equal(scoreToStars(null), null);
});

test("risk and quality cards communicate direction in text and accessible labels", () => {
  const base = { state: "confirmed", value: 8, scale_max: 10 };
  const risk = buildScorePresentation({ ...base, direction: "higher_is_more_risk" });
  const quality = buildScorePresentation({ ...base, direction: "higher_is_better" });
  assert.equal(risk.directionLabel, "Higher = More Risk");
  assert.match(risk.accessibleLabel, /4 out of 5 stars.*More Risk/);
  assert.equal(quality.directionLabel, "Higher = Stronger");
  assert.match(quality.accessibleLabel, /4 out of 5 stars.*Stronger/);
});

test("cards transition without provisional numbers and settle independently", async () => {
  const report = await loadReportFixture("partial");
  const researching = buildDashboardView(report, { final: false });
  assert.ok(researching.scoreSummary.every((score) => score.presentation.state === "researching" && score.presentation.stars === null));
  const partialProgress = structuredClone(report);
  partialProgress.scores.reverse_split_risk = { ...partialProgress.scores.reverse_split_risk, state: "confirmed", value: 6, confidence: "high" };
  const progressive = buildDashboardView(partialProgress, { final: false, settledScoreKeys: new Set(["reverse_split_risk"]) }).scoreSummary;
  assert.equal(progressive.find((score) => score.key === "reverse_split_risk").presentation.state, "scored");
  assert.equal(progressive.find((score) => score.key === "dilution_historical_severity").presentation.state, "researching");
  const settled = buildDashboardView(report, { final: true }).scoreSummary;
  assert.equal(settled.find((score) => score.key === "financial_health").presentation.state, "limited");
  const unknown = { ...report.scores.catalyst_strength, state: "unknown" };
  assert.equal(buildScorePresentation(unknown, { final: true }).state, "unscored");
  assert.equal(buildScorePresentation(unknown, { final: false }).accessibleLabel.includes("no provisional score"), true);
});

test("financial display rows reuse only direct methodology components", async () => {
  const view = buildDashboardView(await loadReportFixture("complete"));
  const rows = new Map(view.scoreSummary.map((row) => [row.key, row]));
  for (const key of ["profitability", "debt", "free_cash_flow"]) assert.equal(rows.get(key).presentation.state, "scored", `${key} should reuse its direct methodology component`);
  for (const key of ["revenue", "cash", "cash_burn"]) {
    assert.equal(rows.get(key).presentation.state, "unscored", `${key} has no independent methodology score`);
    assert.equal(rows.get(key).presentation.stars, null);
    assert.match(rows.get(key).explanation, /no independent methodology score/i);
  }
});

test("financial rows expose supported values while charts use chronological observations", async () => {
  const view = buildDashboardView(await loadReportFixture("complete"));
  const revenue = view.scoreSummary.find((row) => row.key === "revenue");
  assert.equal(revenue.metric.value, 125);
  assert.deepEqual(revenue.metric.observations.map((item) => item.period_end), ["2025-06-30", "2026-06-30"]);
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(source, /vertical-bar-chart/); assert.match(source, /chart-y-axis/); assert.match(source, /chart-x-label/);
  assert.match(source, /one supported period · no trend inferred/i);
  assert.match(css, /\.vertical-bar-chart/); assert.match(css, /\.vertical-bar/);
  assert.doesNotMatch(source, /single-value-chart/);
});

test("Financial Health owns supporting financial explanations without duplicate metric dropdowns", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  const detailsFunction = source.slice(source.indexOf("function renderScoreDetails"), source.indexOf("function renderSections"));
  assert.match(detailsFunction, /Financial Health explanation/);
  assert.match(detailsFunction, /financialMetricOrder\.forEach/);
  assert.match(detailsFunction, /coverage_notes\.forEach/);
  assert.doesNotMatch(detailsFunction, /renderDetailGroup\("Financial metric explanations"/);
  assert.match(detailsFunction, /renderDetailGroup\("Dilution and reverse-split explanations"/);
});

test("partial provider failure settles only dependent cards", () => {
  const settled = settledScoreKeysForOperations({
    retrieval: { status: "completed" },
    bounded_sources: { nasdaq: "completed", news: "limited", market: "timed_out" },
    synthesis: { status: "unavailable" }
  }, false);
  for (const key of priorityScoreKeys) assert.equal(settled.has(key), true, `${key} should settle when its source has reached a terminal state`);
  const stillWorking = settledScoreKeysForOperations({ retrieval: { status: "completed" }, bounded_sources: { nasdaq: "completed", news: "in_progress", market: "in_progress" }, synthesis: { status: "in_progress" } }, false);
  assert.equal(stillWorking.has("dilution_historical_severity"), true);
  assert.equal(stillWorking.has("financial_health"), true);
  assert.equal(stillWorking.has("catalyst_strength"), false);
  assert.equal(stillWorking.has("near_term_setup_quality"), false);
});

test("dashboard exposes score methodology, confidence, inputs, and weights", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  for (const text of ["methodology_version", "confidence", "component.weight", "Internal value", "Why the scores look this way"] ) assert.match(source, new RegExp(text.replace(".", "\\.")));
});

test("dashboard exposes catalyst factors, analogue limits, reactions, and confidence", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  for (const text of ["Catalyst assessment", "Potential significance", "Historical analogues", "Comparison limit", "Near-term evidence implication", "confidence"]) {
    assert.match(source, new RegExp(text));
  }
});

test("dashboard exposes financial periods, trends, going concern, and warnings", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  for (const text of ["Financial metric charts", "Latest supported period", "no trustworthy chart is available", "Cash burn", "Free cash flow", "Going concern", "financial-warnings"]) assert.match(source, new RegExp(text));
});

test("dashboard exposes operational budgets and deliberate deeper research", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  assert.match(html, /value="fast"/);
  assert.match(html, /value="deep"/);
  for (const text of ["Research status & budget", "Technical operations telemetry", "estimated_cost_usd", "web_search_calls", "bounded_sources", "Alpha Vantage", "Operational budgets do not certify evidence completeness"]) assert.match(source, new RegExp(text));
});

test("priority findings rank unknowns before material confirmed risk evidence", async () => {
  const report = await loadReportFixture("complete");
  const findings = buildPriorityFindings(report);
  assert.equal(findings[0].id, "claim-catalyst-value-conflict");
  assert.ok(findings.some((claim) => claim.id === "claim-dilution"));
  assert.equal(findings.some((claim) => claim.id === "claim-splits"), false);
});

test("partial and pending reports preserve unknown, limited, and not-applicable states", async () => {
  const partial = await loadReportFixture("partial");
  const pending = structuredClone(partial);
  pending.metadata.completion_status = "pending";
  const partialView = buildDashboardView(partial);
  const states = new Set(partialView.sections.map((section) => section.state));
  assert.ok(states.has("unknown"));
  assert.ok(states.has("limited_coverage"));
  assert.ok(states.has("not_applicable"));
  assert.ok(partialView.findings.some((finding) => finding.id === "section-dilution" && finding.state === "unknown"));
  assert.ok(partialView.findings.some((finding) => finding.id === "section-reverse_splits" && finding.state === "limited_coverage"));
  assert.equal(buildDashboardView(pending).report.metadata.completion_status, "pending");
});

test("claim references resolve to useful dated sources", async () => {
  const report = await loadReportFixture("complete");
  const view = buildDashboardView(report);
  const sources = view.sourcesForClaims(["claim-dilution"]);
  assert.equal(sources[0].title, "Acme Holdings Form 8-K — Registered Offering");
  assert.equal(sources[0].published_date, "2025-04-10");
  assert.match(sources[0].url, /^https:\/\//);
});

test("dashboard uses safe external links, semantic form submission, and a narrow layout", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(html, /<form id="research-form"/);
  assert.match(script, /event\.key === "Enter"[\s\S]*form\.requestSubmit\(\)/);
  assert.match(script, /target = "_blank"/);
  assert.match(script, /rel = "noopener noreferrer"/);
  assert.match(script, /textContent = text/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.score-grid, \.financial-grid, \.financial-chart-grid, \.factor-grid, \.evidence-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.fast-top-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(script, /role", "img"/);
  assert.match(script, /aria-label/);
  assert.match(script, /visually-hidden/);
  assert.doesNotMatch(script, /\/ 5 stars/);
});

test("wide dashboard pairs identity, operations, and catalyst with the score sidebar", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(source, /primary\.append\(renderHeader\(view\), renderOperations\(operations\), renderCatalystAssessment\(view\)\)/);
  assert.match(source, /sidebar\.append\(renderScores\(view\)\)/);
  assert.match(source, /replaceChildren\(renderTopLayout\(view, operations\), renderFinancialAssessment\(view\), renderScoreDetails\(view\), renderSupportingEvidence\(view\), renderSources\(view\)\)/);
  assert.match(css, /\.fast-top-layout \{ display: grid; grid-template-columns: minmax\(0, 1\.3fr\) minmax\(340px, \.9fr\)/);
});

test("compact score rows contain only the metric name and stars or status", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  const scoreFunction = source.slice(source.indexOf("function renderScores"), source.indexOf("function renderCatalystAssessment"));
  assert.match(scoreFunction, /copy\.append\(element\("h3", "", score\.label\)\)/);
  assert.doesNotMatch(scoreFunction, /score\.description|directionLabel|score\.explanation/);
  assert.match(source, /body\.append\(element\("p", "", score\.description\), element\("p", "", score\.explanation\)/);
});

test("dashboard ticker input retains server-compatible normalization", () => {
  assert.deepEqual(validateTickerInput(" brk.b "), { valid: true, ticker: "BRK.B", message: "" });
  assert.equal(validateTickerInput("A..B").valid, false);
});
