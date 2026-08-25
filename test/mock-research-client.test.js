import assert from "node:assert/strict";
import test from "node:test";
import { createMockResearchClient, DEMO_TICKER, DEMO_TICKERS, UnsupportedDemoTickerError } from "../mock-research-client.js";
import { loadReportFixture } from "../support/report-fixtures.js";

test("ACME always returns the same deterministic fixture-backed report", async () => {
  const report = await loadReportFixture("complete");
  const client = createMockResearchClient(report);
  const first = await client.researchTicker(DEMO_TICKER);
  const second = await client.researchTicker(DEMO_TICKER);

  assert.deepEqual(first.report, report);
  assert.deepEqual(second.report, report);
  assert.notEqual(first.report, second.report);
  assert.equal(first.operations.estimated_cost_usd, 0);
});

test("mock client rejects unsupported tickers", async () => {
  const client = createMockResearchClient(await loadReportFixture("complete"));
  await assert.rejects(client.researchTicker("MSFT"), UnsupportedDemoTickerError);
});

test("mock client serves deterministic complete, partial, and pending reports", async () => {
  const complete = await loadReportFixture("complete");
  const partial = await loadReportFixture("partial");
  const pending = structuredClone(partial);
  pending.security.ticker = "PENDING";
  pending.metadata.completion_status = "pending";
  const client = createMockResearchClient([complete, partial, pending]);

  assert.deepEqual(DEMO_TICKERS, ["ACME", "XYZ", "PENDING"]);
  assert.equal((await client.researchTicker("XYZ")).report.metadata.completion_status, "partial");
  assert.equal((await client.researchTicker("PENDING")).report.metadata.completion_status, "pending");
});
