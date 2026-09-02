import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCalibrationProviderAvailability } from "../lib/calibration-provider-policy.js";

test("calibration does not globally depend on Alpha allowance", () => {
  assert.equal(evaluateCalibrationProviderAvailability({ alphaRequestsAvailable: 0, alphaRequestsRequired: 10, configuredProviders: ["alpha_vantage", "twelve_data"] }).reason, "approved_fallback_available");
  assert.equal(evaluateCalibrationProviderAvailability({ alphaRequestsAvailable: 0, alphaRequestsRequired: 10, configuredProviders: [], optionalContextMaySettleLimited: true }).reason, "optional_context_may_settle_limited");
  assert.equal(evaluateCalibrationProviderAvailability({ alphaRequestsAvailable: 0, alphaRequestsRequired: 10, configuredProviders: [], optionalContextMaySettleLimited: false }).allowed, false);
});

test("a frozen evaluation source-policy change still requires owner review", () => {
  assert.deepEqual(evaluateCalibrationProviderAvailability({ alphaRequestsAvailable: 25, alphaRequestsRequired: 10, configuredProviders: ["twelve_data"], requiresOwnerReview: true }), { allowed: false, reason: "provider_plan_requires_owner_review" });
});
