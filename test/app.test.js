import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import { createReportValidator } from "../lib/report-validation.js";
import { RESEARCH_ERROR_CODES, ResearchResponseError } from "../openai-research-client.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";
import { withTestServer } from "../support/test-server.js";

const quietLogger = { error() {} };
const reportValidator = createReportValidator(await loadReportSchema());
const completeReport = await loadReportFixture("complete");
const partialReport = await loadReportFixture("partial");

function buildApp(researchClient, options = {}) {
  return createApp({ researchClient, reportValidator, logger: quietLogger, ...options });
}

test("createApp requires explicit research and report-validation boundaries", () => {
  assert.throws(() => createApp(), /requires a researchClient/);
  assert.throws(
    () => createApp({ researchClient: { async researchTicker() {} } }),
    /requires a reportValidator/
  );
});

test("runtime metadata distinguishes live and mock apps", async () => {
  const researchClient = { async researchTicker() { return completeReport; } };
  const cases = [
    { runtime: undefined, expected: { mode: "live", demoTicker: null } },
    { runtime: { mode: "mock", demoTicker: "ACME" }, expected: { mode: "mock", demoTicker: "ACME" } }
  ];

  for (const { runtime, expected } of cases) {
    await withTestServer(buildApp(researchClient, { runtime }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/runtime`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
    });
  }
});

test("analyze normalizes a ticker and returns a validated complete report", async () => {
  const calls = [];
  const app = buildApp({ async researchTicker(ticker) { calls.push(ticker); return structuredClone(completeReport); } });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=%20acme%20`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ticker: "ACME", report: completeReport });
  });
  assert.deepEqual(calls, ["ACME"]);
});

test("analyze returns a validated partial report as a successful result", async () => {
  const app = buildApp({ async researchTicker() { return structuredClone(partialReport); } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=XYZ`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ticker: "XYZ", report: partialReport });
  });
});

test("analyze rejects empty and malformed tickers without calling research", async () => {
  let called = false;
  const app = buildApp({ async researchTicker() { called = true; return completeReport; } });

  await withTestServer(app, async (baseUrl) => {
    const empty = await fetch(`${baseUrl}/api/analyze?ticker=%20`);
    assert.equal(empty.status, 400);
    assert.deepEqual(await empty.json(), { code: "TICKER_REQUIRED", error: "Please enter a ticker." });

    for (const ticker of ["A%2FB", ".ABC", "ABC-", "A..B", "A_B", "A%20B", "A234567890123456"]) {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=${ticker}`);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        code: "INVALID_TICKER",
        error: "Ticker must be 1–15 letters or numbers, with single periods or hyphens between segments."
      });
    }
  });
  assert.equal(called, false);
});

test("analyze preserves valid punctuated ticker normalization", async () => {
  const calls = [];
  const app = buildApp({
    async researchTicker(ticker) {
      calls.push(ticker);
      const report = structuredClone(completeReport);
      report.security.ticker = ticker;
      return report;
    }
  });

  await withTestServer(app, async (baseUrl) => {
    for (const ticker of ["BRK.B", "bf-b"]) {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=${ticker}`);
      assert.equal(response.status, 200);
    }
  });
  assert.deepEqual(calls, ["BRK.B", "BF-B"]);
});

test("invalid structured data never reaches the browser as success", async () => {
  const app = buildApp({ async researchTicker() { return { schema_version: "broken" }; } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      code: "INVALID_RESEARCH_RESPONSE",
      error: "The research provider returned an invalid report."
    });
  });
});

for (const scenario of [
  { code: RESEARCH_ERROR_CODES.refused, expected: { code: "RESEARCH_REFUSED", error: "The research request was refused." } },
  { code: RESEARCH_ERROR_CODES.incomplete, expected: { code: "RESEARCH_INCOMPLETE", error: "The research response was incomplete." } },
  { code: RESEARCH_ERROR_CODES.invalid, expected: { code: "INVALID_RESEARCH_RESPONSE", error: "The research provider returned an invalid report." } },
  { code: RESEARCH_ERROR_CODES.unusable, expected: { code: "RESEARCH_UNUSABLE", error: "The research provider returned an unusable response." } }
]) {
  test(`analyze maps ${scenario.code} to a controlled response`, async () => {
    const app = buildApp({ async researchTicker() { throw new ResearchResponseError(scenario.code); } });
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), scenario.expected);
    });
  });
}

test("unexpected upstream details do not appear in logs or responses", async () => {
  const secret = "secret-provider-detail";
  const logMessages = [];
  const app = createApp({
    researchClient: { async researchTicker() { throw new Error(secret); } },
    reportValidator,
    logger: { error(...values) { logMessages.push(values.join(" ")); } }
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.deepEqual(JSON.parse(body), { code: "RESEARCH_UNAVAILABLE", error: "Research is temporarily unavailable." });
    assert.equal(body.includes(secret), false);
  });
  assert.equal(logMessages.join(" ").includes(secret), false);
});
