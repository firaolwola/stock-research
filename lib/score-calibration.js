import { SCORE_DEFINITIONS, calibrateReportScores } from "./scoring.js";

/**
 * The score calibration harness is deliberately deterministic and provider
 * agnostic. It inspects reports after the same calibration function used by
 * the application; it never performs retrieval or changes a report.
 */
export const CALIBRATION_COMPONENTS = Object.freeze(Object.fromEntries(
  Object.entries(SCORE_DEFINITIONS).map(([key, [direction, time_horizon]]) => [key, {
    key,
    direction,
    time_horizon,
    unresolved_states: ["limited_coverage", "unknown", "researching", "not_applicable"]
  }])
));

const ADVISORY_LANGUAGE = /\b(?:buy|sell|hold|recommend(?:ation)?|price target|entry price|exit price|guarantee|probability\s*[:=]?\s*\d+%?)\b/i;

function maps(report) {
  return {
    claims: new Map((report.claims ?? []).map((claim) => [claim.id, claim])),
    sources: new Map((report.sources ?? []).map((source) => [source.id, source]))
  };
}

/** Check that a score is structurally honest without weakening report schema validation. */
export function inspectScoreFidelity(report, score, key) {
  const errors = [];
  const definition = CALIBRATION_COMPONENTS[key];
  if (!definition) errors.push(`unknown score key ${key}`);
  if (definition && score.direction !== definition.direction) errors.push(`${key} direction is ${score.direction}, expected ${definition.direction}`);
  if (definition && score.time_horizon !== definition.time_horizon) errors.push(`${key} horizon is not the Methodology 2.1 horizon`);

  const { claims, sources } = maps(report);
  const claimIds = [...new Set([...(score.claim_ids ?? []), ...(score.components ?? []).flatMap((part) => part.claim_ids ?? [])])];
  for (const claimId of claimIds) {
    const claim = claims.get(claimId);
    if (!claim) { errors.push(`${key} references missing claim ${claimId}`); continue; }
    if (!claim.source_ids?.length) errors.push(`${key} claim ${claimId} has no source`);
    for (const sourceId of claim.source_ids ?? []) {
      const source = sources.get(sourceId);
      if (!source) errors.push(`${key} claim ${claimId} references missing source ${sourceId}`);
      else if (!source.published_date) errors.push(`${key} source ${sourceId} has no dated publication`);
    }
  }
  if (score.state === "confirmed" && !Number.isFinite(score.value)) errors.push(`${key} confirmed score has no numeric value`);
  if (score.state === "confirmed" && (score.value < score.scale_min || score.value > score.scale_max)) errors.push(`${key} score is outside its declared scale`);
  if (score.state !== "confirmed" && score.value !== null) errors.push(`${key} unresolved score has a numeric value`);
  if (ADVISORY_LANGUAGE.test(score.explanation ?? "")) errors.push(`${key} explanation contains advisory or unsupported probability language`);
  return { valid: errors.length === 0, errors };
}

/**
 * Evaluate all Methodology 2.1 score components and optional expected ranges.
 * Ranges are inclusive and are kept in the calibration plan, not in scoring.
 */
export function evaluateScoreCalibration(report, expected = {}) {
  const scored = calibrateReportScores(report);
  const errors = [];
  const components = {};
  for (const key of Object.keys(CALIBRATION_COMPONENTS)) {
    const score = scored.scores?.[key];
    if (!score) { errors.push(`${key} is missing`); continue; }
    const fidelity = inspectScoreFidelity(scored, score, key);
    errors.push(...fidelity.errors);
    const range = expected[key];
    if (range?.state && score.state !== range.state) errors.push(`${key} state ${score.state} is outside expected ${range.state}`);
    if (range?.min != null && (score.value == null || score.value < range.min)) errors.push(`${key} value is below expected minimum ${range.min}`);
    if (range?.max != null && (score.value == null || score.value > range.max)) errors.push(`${key} value is above expected maximum ${range.max}`);
    components[key] = { state: score.state, value: score.value, direction: score.direction, fidelity_errors: fidelity.errors };
  }
  return { valid: errors.length === 0, errors, scores: scored.scores, components };
}

/** Compare two independently calibrated reports using the declared direction. */
export function evaluateRelativeOrdering(leftReport, rightReport, scoreKey) {
  const left = calibrateReportScores(leftReport).scores[scoreKey];
  const right = calibrateReportScores(rightReport).scores[scoreKey];
  if (!left || !right || left.state !== "confirmed" || right.state !== "confirmed") {
    return { valid: false, reason: "both reports need confirmed numeric scores", left, right };
  }
  const direction = CALIBRATION_COMPONENTS[scoreKey]?.direction;
  const valid = direction === "higher_is_more_risk" ? left.value > right.value : left.value > right.value;
  return { valid, direction, left: left.value, right: right.value };
}

export function calibrationSummary(results) {
  const total = results.length;
  const passed = results.filter((result) => result.valid).length;
  return { total, passed, failed: total - passed, pass_rate: total ? passed / total : 0 };
}
