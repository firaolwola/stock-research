export function evaluateCalibrationProviderAvailability({ alphaRequestsAvailable, alphaRequestsRequired, configuredProviders = [], optionalContextMaySettleLimited = false, requiresOwnerReview = false } = {}) {
  if (requiresOwnerReview) return { allowed: false, reason: "provider_plan_requires_owner_review" };
  if (alphaRequestsAvailable >= alphaRequestsRequired) return { allowed: true, reason: "alpha_allowance_sufficient" };
  if (configuredProviders.some((provider) => provider !== "alpha_vantage")) return { allowed: true, reason: "approved_fallback_available" };
  if (optionalContextMaySettleLimited) return { allowed: true, reason: "optional_context_may_settle_limited" };
  return { allowed: false, reason: "optional_provider_allowance_insufficient" };
}
