import assert from "node:assert/strict";
import test from "node:test";
import { createMockResearchClient, DEMO_TICKER, UnsupportedDemoTickerError } from "../mock-research-client.js";
import { loadReportFixture } from "../support/report-fixtures.js";

test("ACME always returns the same deterministic fixture-backed report", async () => {
  const report = await loadReportFixture("complete");
  const client = createMockResearchClient(report);
  const first = await client.researchTicker(DEMO_TICKER);
  const second = await client.researchTicker(DEMO_TICKER);

  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), report);
});

test("mock client rejects unsupported tickers", async () => {
  const client = createMockResearchClient(await loadReportFixture("complete"));
  await assert.rejects(client.researchTicker("MSFT"), UnsupportedDemoTickerError);
});
