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
    const body = await response.json();
    assert.equal(body.ticker, "ACME");
    assert.deepEqual(body.report, completeReport);
    assert.equal(body.operations.budget.cost_limit_usd, 0.03);
    assert.equal(body.operations.budget.termination_reason, "completed");
    assert.ok(body.operations.score_states.scored > 0);
  });
  assert.deepEqual(calls, ["ACME"]);
});

test("analyze defaults to fast research and requires deliberate supported stages", async () => {
  const calls = [];
  const app = buildApp({ async researchTicker(ticker, options) { calls.push({ ticker, options }); const report = structuredClone(completeReport); report.metadata.stage = options.stage; return { report, operations: { stage: options.stage } }; } });
  await withTestServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/analyze?ticker=ACME`)).status, 200);
    const deep = await fetch(`${baseUrl}/api/analyze?ticker=ACME&stage=deep`);
    assert.equal(deep.status, 200);
    assert.equal((await deep.json()).report.metadata.stage, "deep");
    const invalid = await fetch(`${baseUrl}/api/analyze?ticker=ACME&stage=automatic`);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code: "INVALID_RESEARCH_STAGE", error: "Research stage must be fast or deep." });
  });
  assert.deepEqual(calls.map((call) => call.options.stage), ["fast", "deep"]);
});

test("analyze replaces provider-authored score values deterministically", async () => {
  const providerReport = structuredClone(completeReport);
  providerReport.scores.dilution_historical_severity.value = 10;
  providerReport.scores.dilution_historical_severity.explanation = "Provider-authored placeholder.";
  const app = buildApp({ async researchTicker() { return providerReport; } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.report.scores.dilution_historical_severity.value, null);
    assert.equal(body.report.scores.dilution_historical_severity.methodology_version, "2.0.0");
    assert.notEqual(body.report.scores.dilution_historical_severity.explanation, "Provider-authored placeholder.");
  });
});

test("analyze returns a validated partial report as a successful result", async () => {
  const app = buildApp({ async researchTicker() { return structuredClone(partialReport); } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=XYZ`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ticker, "XYZ");
    assert.deepEqual(body.report, partialReport);
    assert.equal(body.operations.budget.termination_reason, "partial_coverage");
    assert.ok(body.operations.score_states.unscored + body.operations.score_states.limited > 0);
  });
});

test("Fast streaming emits progressive validated reports and a final result", async () => {
  const app = buildApp({
    async researchTicker(_ticker, options) {
      const progress = { report: structuredClone(partialReport), operations: { stage: "fast", domains: { capital: { status: "completed" }, catalyst: { status: "pending" }, financial: { status: "pending" } } } };
      progress.report.metadata.stage = "fast";
      await options.onProgress(progress);
      return { report: progress.report, operations: { ...progress.operations, domains: { capital: { status: "completed" }, catalyst: { status: "completed" }, financial: { status: "pending" } } } };
    }
  });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze-stream?ticker=XYZ`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/x-ndjson/);
    const messages = (await response.text()).trim().split("\n").map(JSON.parse);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, "report");
    assert.equal(messages[0].final, false);
    assert.equal(messages[1].final, true);
    assert.equal(messages[1].report.scores.financial_health.value, null);
  });
});

test("streaming rejection logs safe validation context without the report", async () => {
  const logs = []; const invalid = structuredClone(partialReport);
  invalid.issuer.prior_identities = [{ name: "private issuer text", ticker: null, effective_from: "2020-01-01T05:00:00.000Z", effective_to: "2022-01-01T05:00:00.000Z", linkage_state: "confirmed", linkage_confidence: "high", claim_ids: [] }];
  const operations = { stage: "fast", domains: { capital: { status: "completed" }, catalyst: { status: "pending" }, financial: { status: "pending" } }, retrieval: { status: "completed" }, synthesis: { status: "pending" } };
  const app = buildApp({ async researchTicker(_ticker, options) { const value = { report: invalid, operations, evidence_records: [{ id: "private evidence" }] }; await options.onProgress(value); return value; } }, { logger: { error(message) { logs.push(message); } } });
  await withTestServer(app, async (baseUrl) => { const messages = (await (await fetch(`${baseUrl}/api/analyze-stream?ticker=SWVL`)).text()).trim().split("\n").map(JSON.parse); assert.equal(messages.at(-1).code, "INVALID_RESEARCH_RESPONSE"); });
  assert.equal(logs.length, 2); assert.match(logs[0], /"phase":"report_validation"/); assert.match(logs[0], /"report_kind":"intermediate"/); assert.match(logs[1], /"report_kind":"final"/);
  assert.match(logs[0], /"capital":"completed"/); assert.match(logs[0], /"sec_retrieval_status":"completed"/); assert.match(logs[0], /"synthesis_status":"pending"/); assert.match(logs[0], /"evidence_records_retrieved":true/); assert.match(logs[0], /effective_from/); assert.match(logs[0], /"keyword":"format"/);
  assert.doesNotMatch(logs.join(" "), /private issuer text|private evidence/);
});

test("streaming conversion failure logs only safe error metadata", async () => {
  const logs = []; const operations = { domains: { capital: { status: "pending" } }, retrieval: { status: "limited" }, synthesis: { status: "unavailable" } };
  const app = buildApp({ async researchTicker() { return { report: null, operations, evidence_records: [] }; } }, { logger: { error(message) { logs.push(message); } } });
  await withTestServer(app, async (baseUrl) => { await fetch(`${baseUrl}/api/analyze-stream?ticker=SWVL`); });
  assert.equal(logs.length, 1); assert.match(logs[0], /"phase":"report_conversion"/); assert.match(logs[0], /"error_constructor":"TypeError"/); assert.match(logs[0], /"evidence_records_retrieved":false/);
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

test("a report for a different requested security is rejected", async () => {
  const app = buildApp({ async researchTicker() { return structuredClone(completeReport); } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=WRONG`);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "INVALID_RESEARCH_RESPONSE");
  });
});

for (const scenario of [
  { code: RESEARCH_ERROR_CODES.timeout, status: 504, expected: { code: "RESEARCH_TIMEOUT", error: "Research took too long. Please try again." } },
  { code: RESEARCH_ERROR_CODES.rateLimit, status: 503, expected: { code: "RESEARCH_RATE_LIMITED", error: "Research is temporarily rate limited. Please try again later." } },
  { code: RESEARCH_ERROR_CODES.authentication, status: 502, expected: { code: "RESEARCH_CONFIGURATION_ERROR", error: "Research is temporarily unavailable." } },
  { code: RESEARCH_ERROR_CODES.temporary, status: 503, expected: { code: "RESEARCH_SERVICE_UNAVAILABLE", error: "The research service is temporarily unavailable." } },
  { code: RESEARCH_ERROR_CODES.refused, expected: { code: "RESEARCH_REFUSED", error: "The research request was refused." } },
  { code: RESEARCH_ERROR_CODES.incomplete, expected: { code: "RESEARCH_INCOMPLETE", error: "The research response was incomplete." } },
  { code: RESEARCH_ERROR_CODES.invalid, expected: { code: "INVALID_RESEARCH_RESPONSE", error: "The research provider returned an invalid report." } },
  { code: RESEARCH_ERROR_CODES.unusable, expected: { code: "RESEARCH_UNUSABLE", error: "The research provider returned an unusable response." } },
  { code: RESEARCH_ERROR_CODES.badRequest, expected: { code: "RESEARCH_REQUEST_REJECTED", error: "The research request configuration was rejected." } },
  { code: RESEARCH_ERROR_CODES.unexpected, expected: { code: "RESEARCH_UNAVAILABLE", error: "Research is temporarily unavailable." } }
]) {
  test(`analyze maps ${scenario.code} to a controlled response`, async () => {
    const app = buildApp({ async researchTicker() { throw new ResearchResponseError(scenario.code); } });
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
      assert.equal(response.status, scenario.status ?? 502);
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

test("safe upstream diagnostics retain category, status, and code without provider messages", async () => {
  const logMessages = [];
  const app = createApp({
    researchClient: { async researchTicker() { throw new ResearchResponseError(RESEARCH_ERROR_CODES.badRequest, { status: 400, provider_code: "invalid_json_schema", error_type: "BadRequestError" }); } },
    reportValidator,
    logger: { error(...values) { logMessages.push(values.join(" ")); } }
  });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, "RESEARCH_REQUEST_REJECTED");
  });
  assert.match(logMessages[0], /UPSTREAM_BAD_REQUEST; type=BadRequestError; status=400; provider_code=invalid_json_schema/);
});

test("lifecycle diagnostics expose safe timeout context without provider content", async () => {
  const logs = [];
  const diagnostics = { stage: "fast", phase: "openai_request", elapsed_ms: 15002, error_constructor: "APIConnectionTimeoutError", error_type: "Error", cause_constructor: "DOMException", cause_name: "AbortError", cause_code: "ABORT_ERR", response_received: false };
  const app = createApp({ researchClient: { async researchTicker() { throw new ResearchResponseError(RESEARCH_ERROR_CODES.timeout, diagnostics); } }, reportValidator, logger: { error(value) { logs.push(value); } } });
  await withTestServer(app, async (baseUrl) => assert.equal((await fetch(`${baseUrl}/api/analyze?ticker=SWVL&stage=fast`)).status, 504));
  assert.match(logs[0], /stage=fast; phase=openai_request; elapsed_ms=15002; constructor=APIConnectionTimeoutError; type=Error/);
  assert.match(logs[0], /cause_constructor=DOMException; cause_name=AbortError; cause_code=ABORT_ERR; response_received=false/);
  assert.equal(logs[0].includes("provider content"), false);
});

test("server derives scores when the provider omits redundant score output", async () => {
  const providerReport = structuredClone(completeReport);
  delete providerReport.scores;
  const app = buildApp({ async researchTicker() { return { report: providerReport, operations: { stage: "fast", input_tokens: 10000, output_tokens: 3200, total_tokens: 13200 } }; } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME&stage=fast`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.report.scores.dilution_historical_severity.value, null);
    assert.equal(body.report.scores.catalyst_strength.state, "limited_coverage");
  });
});

test("bounded fast provider report preserves explicit pending evidence and validates after scoring", async () => {
  const providerReport = structuredClone(partialReport);
  providerReport.metadata.stage = "fast";
  delete providerReport.scores;
  const app = buildApp({ async researchTicker() { return { report: providerReport, operations: { stage: "fast", input_tokens: 9000, output_tokens: 1700, total_tokens: 10700 } }; } });
  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=XYZ&stage=fast`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.report.metadata.completion_status, "partial");
    assert.equal(body.report.catalyst_assessment.historical_analogues.state, "unknown");
    assert.ok(body.report.metadata.coverage_limitations.length > 0);
    assert.ok(body.report.scores);
  });
});
