import { calibrateReportScores } from "./scoring.js";

export function finalizeResearchReport(rawReport, { reportValidator, requestedTicker } = {}) {
  if (typeof reportValidator !== "function") throw new TypeError("A report validator is required");
  const report = calibrateReportScores(rawReport);
  const validation = reportValidator(report);
  const identityValid = !requestedTicker || report.security?.ticker === requestedTicker;
  return { report, validation, identityValid, valid: validation.valid && identityValid };
}
