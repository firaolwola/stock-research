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
    assert.deepEqual(await response.json(), { error: "Please enter a ticker." });
  });
  assert.equal(called, false);
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
