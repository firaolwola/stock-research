import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDashboardView, buildPriorityFindings, scoreGroups, sectionLabels, validateTickerInput } from "../public/dashboard.js";
import { loadReportFixture } from "../support/report-fixtures.js";

test("dashboard exposes every report section and keeps score concepts grouped", async () => {
  const view = buildDashboardView(await loadReportFixture("complete"));
  assert.deepEqual(view.sections.map((section) => section.key), Object.keys(sectionLabels));
  assert.deepEqual(view.scoreGroups.map((group) => group.title), ["Capital structure risk", "Company context", "Near-term catalyst & setup"]);
  assert.deepEqual(scoreGroups[1].keys, ["financial_health", "long_term_company_quality"]);
  assert.deepEqual(scoreGroups[2].keys, ["catalyst_strength", "near_term_setup_quality"]);
});

test("dashboard exposes catalyst factors, analogue limits, reactions, and confidence", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  for (const text of ["Catalyst assessment", "Potential significance", "Historical analogues", "Comparison limit", "Near-term evidence implication", "confidence"]) {
    assert.match(source, new RegExp(text));
  }
});

test("dashboard exposes financial periods, trends, going concern, and warnings", async () => {
  const source = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");
  for (const text of ["Financial health context", "Cash burn", "Free cash flow", "Going concern", "compared with", "financial-warnings"]) assert.match(source, new RegExp(text));
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
});

test("dashboard ticker input retains server-compatible normalization", () => {
  assert.deepEqual(validateTickerInput(" brk.b "), { valid: true, ticker: "BRK.B", message: "" });
  assert.equal(validateTickerInput("A..B").valid, false);
});
