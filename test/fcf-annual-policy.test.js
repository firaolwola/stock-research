import test from "node:test";
import assert from "node:assert/strict";
import { buildFcfAnnualPolicyAudit } from "../scripts/evaluate-fcf-annual-policy.js";

test("annual-primary FCF policy audit recomputes stored cases without network", async () => {
  const audit = await buildFcfAnnualPolicyAudit();
  assert.equal(audit.network_calls, false);
  assert.equal(audit.live_execution, false);
  assert.deepEqual(audit.cases.map((item) => item.ticker), ["AAPL", "SMCI", "MSFT", "RIVN", "AMC"]);
  assert.equal(audit.denominator_views.annual_numeric_fcf.detected, 4);
  assert.equal(audit.denominator_views.safe_settlement.rate, 1);
  assert.equal(audit.cases.find((item) => item.ticker === "AAPL").score_uses_annual_primary, true);
  assert.equal(audit.cases.find((item) => item.ticker === "RIVN").score_uses_annual_primary, true);
  assert.equal(audit.cases.find((item) => item.ticker === "AMC").safe_settlement, true);
});
