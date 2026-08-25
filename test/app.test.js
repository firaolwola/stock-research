import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import { withTestServer } from "../support/test-server.js";

const quietLogger = { error() {} };

test("createApp requires an explicit research client", () => {
  assert.throws(() => createApp(), /requires a researchClient/);
});

test("runtime metadata distinguishes live and mock apps", async () => {
  const researchClient = { async researchTicker() { return "unused"; } };
  const cases = [
    { runtime: undefined, expected: { mode: "live", demoTicker: null } },
    { runtime: { mode: "mock", demoTicker: "ACME" }, expected: { mode: "mock", demoTicker: "ACME" } }
  ];

  for (const { runtime, expected } of cases) {
    const app = createApp({ researchClient, logger: quietLogger, runtime });
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/runtime`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
    });
  }
});

test("analyze normalizes a ticker and returns mocked research", async () => {
  const calls = [];
  const app = createApp({
    researchClient: { async researchTicker(ticker) { calls.push(ticker); return "Mock report"; } },
    logger: quietLogger
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=%20acme%20`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ticker: "ACME", answer: "Mock report" });
  });
  assert.deepEqual(calls, ["ACME"]);
});

test("analyze rejects an empty ticker without calling research", async () => {
  let called = false;
  const app = createApp({
    researchClient: { async researchTicker() { called = true; return "unused"; } },
    logger: quietLogger
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=%20`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { code: "TICKER_REQUIRED", error: "Please enter a ticker." });
  });
  assert.equal(called, false);
});

test("analyze returns stable validation errors for malformed tickers", async () => {
  let called = false;
  const app = createApp({
    researchClient: { async researchTicker() { called = true; return "unused"; } },
    logger: quietLogger
  });

  await withTestServer(app, async (baseUrl) => {
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

test("analyze passes valid punctuated syntax to the research boundary", async () => {
  const calls = [];
  const app = createApp({
    researchClient: { async researchTicker(ticker) { calls.push(ticker); return "Mock report"; } },
    logger: quietLogger
  });

  await withTestServer(app, async (baseUrl) => {
    for (const ticker of ["BRK.B", "bf-b"]) {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=${ticker}`);
      assert.equal(response.status, 200);
    }
  });
  assert.deepEqual(calls, ["BRK.B", "BF-B"]);
});

for (const scenario of [
  { name: "upstream failure", action: async () => { throw new Error("provider secret detail"); } },
  { name: "timeout rejection", action: async () => { const error = new Error("timed out"); error.name = "TimeoutError"; throw error; } },
  { name: "invalid data", action: async () => ({ unexpected: true }) }
]) {
  test(`analyze contains a simulated ${scenario.name}`, async () => {
    const app = createApp({ researchClient: { researchTicker: scenario.action }, logger: quietLogger });
    await withTestServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Research failed. Please try again." });
    });
  });
}

test("upstream secret details do not appear in logs or responses", async () => {
  const secret = "secret-provider-detail";
  const logMessages = [];
  const app = createApp({
    researchClient: { async researchTicker() { throw new Error(secret); } },
    logger: { error(...values) { logMessages.push(values.join(" ")); } }
  });

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/analyze?ticker=ACME`);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(body.includes(secret), false);
  });
  assert.equal(logMessages.join(" ").includes(secret), false);
});
