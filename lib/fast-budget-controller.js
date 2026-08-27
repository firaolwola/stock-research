import { RESEARCH_STAGES } from "./research-budget.js";

export const FAST_BUDGET_CLASSES = Object.freeze({
  normal: Object.freeze({ cost_limit_usd: 0.03 }),
  difficult: Object.freeze({ cost_limit_usd: 0.05 })
});

export const FAST_FINALIZATION_RESERVE_MS = 500;

const roundMoney = (value) => Number(Math.max(0, value).toFixed(6));
const safeDetail = (value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : undefined;

export function createFastBudgetController({
  budgetClass = "normal",
  elapsedLimitMs = RESEARCH_STAGES.fast.timeout_ms,
  finalizationReserveMs = FAST_FINALIZATION_RESERVE_MS,
  costLimitUsd = FAST_BUDGET_CLASSES[budgetClass]?.cost_limit_usd,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  if (!FAST_BUDGET_CLASSES[budgetClass]) throw new TypeError("Fast budget class must be normal or difficult");
  if (!Number.isFinite(elapsedLimitMs) || elapsedLimitMs <= 0) throw new TypeError("Fast elapsed limit must be positive");
  if (!Number.isFinite(finalizationReserveMs) || finalizationReserveMs < 0 || finalizationReserveMs >= elapsedLimitMs) throw new TypeError("Fast finalization reserve must fit inside the elapsed limit");
  if (!Number.isFinite(costLimitUsd) || costLimitUsd <= 0) throw new TypeError("Fast cost limit must be positive");

  const startedAt = now();
  const workLimitMs = elapsedLimitMs - finalizationReserveMs;
  const workController = new AbortController();
  const hardController = new AbortController();
  const sources = new Map();
  const reservations = new Map();
  let reservationSequence = 0;
  let consumed = 0;
  let reserved = 0;
  let timeCeilingHit = false;
  let costCeilingHit = false;
  let partialCoverage = false;
  let finished = false;
  let cancelled = false;
  let stopReason = null;

  const stopForTime = () => {
    if (timeCeilingHit) return;
    timeCeilingHit = true;
    stopReason ??= "time_ceiling";
    partialCoverage = true;
    workController.abort(new DOMException("Fast work deadline reached", "TimeoutError"));
  };
  const hardStop = () => {
    stopForTime();
    hardController.abort(new DOMException("Fast hard deadline reached", "TimeoutError"));
  };
  const stopForCost = () => {
    if (costCeilingHit) return;
    costCeilingHit = true;
    stopReason ??= "cost_ceiling";
    partialCoverage = true;
    workController.abort(new DOMException("Fast cost ceiling reached", "AbortError"));
  };
  const workTimer = setTimer(stopForTime, workLimitMs);
  const hardTimer = setTimer(hardStop, elapsedLimitMs);
  workTimer?.unref?.();
  hardTimer?.unref?.();

  const checkTime = () => {
    const elapsed = now() - startedAt;
    if (elapsed >= elapsedLimitMs) hardStop();
    else if (elapsed >= workLimitMs) stopForTime();
    return elapsed;
  };
  const recordSource = (source, status, details = {}) => {
    sources.set(source, {
      ...Object.fromEntries(Object.entries(details).filter(([key]) => key !== "status").map(([key, value]) => [key, safeDetail(value)]).filter(([, value]) => value !== undefined)),
      status
    });
    if (["failed", "timed_out", "cancelled", "cost_blocked", "unavailable", "limited"].includes(status)) partialCoverage = true;
  };
  const reserveCost = (source, maximumCostUsd) => {
    checkTime();
    if (workController.signal.aborted) {
      recordSource(source, "cancelled", { reason: "time_ceiling" });
      return null;
    }
    if (!Number.isFinite(maximumCostUsd) || maximumCostUsd < 0) throw new TypeError("A paid operation requires a finite non-negative maximum cost");
    if (consumed + reserved + maximumCostUsd > costLimitUsd + Number.EPSILON) {
      stopForCost();
      recordSource(source, "cost_blocked", { maximum_cost_usd: maximumCostUsd });
      return null;
    }
    const reservation = { id: ++reservationSequence, source, maximumCostUsd };
    reservations.set(reservation.id, reservation);
    reserved = roundMoney(reserved + maximumCostUsd);
    recordSource(source, "reserved", { maximum_cost_usd: maximumCostUsd });
    return reservation;
  };
  const releaseCost = (reservation) => {
    const existing = reservation && reservations.get(reservation.id);
    if (!existing) return;
    reservations.delete(existing.id);
    reserved = roundMoney(reserved - existing.maximumCostUsd);
  };
  const commitCost = (reservation, actualCostUsd) => {
    const existing = reservation && reservations.get(reservation.id);
    if (!existing) throw new TypeError("Unknown Fast cost reservation");
    if (!Number.isFinite(actualCostUsd) || actualCostUsd < 0 || actualCostUsd > existing.maximumCostUsd + Number.EPSILON) throw new RangeError("Actual cost exceeded the reserved maximum");
    releaseCost(existing);
    consumed = roundMoney(consumed + actualCostUsd);
    recordSource(existing.source, "completed", { cost_usd: actualCostUsd });
    if (consumed >= costLimitUsd) stopForCost();
  };
  const terminationReason = (final) => {
    checkTime();
    if (stopReason) return stopReason;
    if (cancelled) return "cancelled";
    if (!final) return "in_progress";
    if (partialCoverage) return "partial_coverage";
    return "completed";
  };
  const telemetry = ({ final = finished } = {}) => {
    const elapsed = Math.max(0, checkTime());
    return {
      budget_class: budgetClass,
      elapsed_ms: Math.round(elapsed),
      elapsed_limit_ms: elapsedLimitMs,
      work_limit_ms: workLimitMs,
      finalization_reserve_ms: finalizationReserveMs,
      time_remaining_ms: Math.max(0, Math.round(elapsedLimitMs - elapsed)),
      cost_limit_usd: costLimitUsd,
      cost_consumed_usd: roundMoney(consumed),
      cost_reserved_usd: roundMoney(reserved),
      cost_remaining_usd: roundMoney(costLimitUsd - consumed - reserved),
      termination_reason: terminationReason(final),
      completed_normally: final && !partialCoverage && !timeCeilingHit && !costCeilingHit,
      partial_coverage: partialCoverage,
      sources: Object.fromEntries(sources)
    };
  };
  const finish = ({ partial = partialCoverage } = {}) => {
    partialCoverage ||= partial;
    finished = true;
    clearTimer(workTimer);
    clearTimer(hardTimer);
    return telemetry({ final: true });
  };
  const cancel = () => {
    if (finished) return telemetry({ final: true });
    cancelled = true;
    stopReason ??= "cancelled";
    partialCoverage = true;
    workController.abort(new DOMException("Fast request cancelled", "AbortError"));
    hardController.abort(new DOMException("Fast request cancelled", "AbortError"));
    return finish({ partial: true });
  };

  return {
    budgetClass,
    signal: workController.signal,
    hardSignal: hardController.signal,
    checkTime,
    remainingTimeMs({ includeFinalizationReserve = false } = {}) {
      const elapsed = checkTime();
      const limit = includeFinalizationReserve ? elapsedLimitMs : workLimitMs;
      return Math.max(0, Math.floor(limit - elapsed));
    },
    isStopped() { checkTime(); return workController.signal.aborted || costCeilingHit; },
    recordSource,
    reserveCost,
    releaseCost,
    commitCost,
    markPartial() { partialCoverage = true; },
    telemetry,
    finish,
    cancel
  };
}
