import assert from "node:assert/strict";
import test from "node:test";

import { createFastBudgetController, FAST_BUDGET_CLASSES } from "../lib/fast-budget-controller.js";

function fakeClock() {
  let current = 0;
  const timers = new Set();
  return {
    now: () => current,
    setTimer(fn, delay) { const timer = { at: current + delay, fn, cleared: false, unref() {} }; timers.add(timer); return timer; },
    clearTimer(timer) { if (timer) timer.cleared = true; },
    advance(milliseconds) {
      current += milliseconds;
      for (const timer of [...timers]) if (!timer.cleared && timer.at <= current) { timer.cleared = true; timer.fn(); }
    },
    activeTimers() { return [...timers].filter((timer) => !timer.cleared).length; }
  };
}

test("normal cost reservations stop before a paid operation can exceed $0.03", () => {
  const clock = fakeClock();
  const budget = createFastBudgetController({ now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  const first = budget.reserveCost("provider:news", 0.02);
  assert.ok(first);
  budget.commitCost(first, 0.015);
  assert.equal(budget.telemetry().cost_consumed_usd, 0.015);
  assert.equal(budget.reserveCost("openai_synthesis", 0.016), null);
  const telemetry = budget.finish({ partial: true });
  assert.equal(telemetry.cost_limit_usd, 0.03);
  assert.equal(telemetry.cost_remaining_usd, 0.015);
  assert.equal(telemetry.termination_reason, "cost_ceiling");
  assert.equal(telemetry.sources.openai_synthesis.status, "cost_blocked");
  assert.equal(clock.activeTimers(), 0);
});

test("difficult budget is explicit and never silently escalates a normal run", () => {
  const normal = createFastBudgetController();
  assert.equal(normal.reserveCost("provider", 0.04), null);
  assert.equal(normal.telemetry().cost_limit_usd, FAST_BUDGET_CLASSES.normal.cost_limit_usd);
  normal.finish({ partial: true });

  const difficult = createFastBudgetController({ budgetClass: "difficult" });
  const reservation = difficult.reserveCost("provider", 0.04);
  assert.ok(reservation);
  difficult.commitCost(reservation, 0.04);
  assert.equal(difficult.finish().cost_limit_usd, FAST_BUDGET_CLASSES.difficult.cost_limit_usd);
});

test("reaching the exact cost ceiling cancels remaining source work but preserves completion telemetry", () => {
  const budget = createFastBudgetController();
  const reservation = budget.reserveCost("provider", 0.03);
  budget.commitCost(reservation, 0.03);
  assert.equal(budget.signal.aborted, true);
  const telemetry = budget.finish({ partial: true });
  assert.equal(telemetry.cost_consumed_usd, 0.03);
  assert.equal(telemetry.cost_remaining_usd, 0);
  assert.equal(telemetry.termination_reason, "cost_ceiling");
});

test("fake clock aborts work before the 20-second hard ceiling and preserves finalization time", () => {
  const clock = fakeClock();
  const budget = createFastBudgetController({ now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  budget.recordSource("sec:identity", "completed", { cost_usd: 0 });
  clock.advance(19_500);
  assert.equal(budget.signal.aborted, true);
  const atWorkStop = budget.telemetry();
  assert.equal(atWorkStop.termination_reason, "time_ceiling");
  assert.equal(atWorkStop.time_remaining_ms, 500);
  assert.equal(atWorkStop.sources["sec:identity"].status, "completed");
  clock.advance(500);
  assert.equal(budget.hardSignal.aborted, true);
  assert.equal(budget.finish({ partial: true }).elapsed_ms, 20_000);
  assert.equal(clock.activeTimers(), 0);
});

test("finishing normally clears deadline timers and does not later abort work", () => {
  const clock = fakeClock();
  const budget = createFastBudgetController({ now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  assert.equal(budget.finish().termination_reason, "completed");
  assert.equal(clock.activeTimers(), 0);
  clock.advance(25_000);
  assert.equal(budget.signal.aborted, false);
});

test("cancellation and source failure remain distinguishable in safe telemetry", () => {
  const failed = createFastBudgetController();
  failed.recordSource("provider:market", "failed", { status: 503 });
  const partial = failed.finish({ partial: true });
  assert.equal(partial.termination_reason, "partial_coverage");
  assert.deepEqual(partial.sources["provider:market"], { status: "failed" });

  const cancelled = createFastBudgetController();
  const result = cancelled.cancel();
  assert.equal(cancelled.signal.aborted, true);
  assert.equal(result.termination_reason, "cancelled");
});
