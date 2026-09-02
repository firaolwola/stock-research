# Issue plan and dependency tracker

**Last reviewed:** 2026-09-02

This page records the completed Issue #55 reliability milestone and its separate
broad-reliability successor. The roadmap records milestone history; this page
makes the current active follow-up, exit criteria, and dependencies explicit.
Historical calibration measurements and answer keys are never rewritten by this
plan.

## Current position

**Issue #55 status:** **Closed — bounded practical-small operational scope.**

**Current active step:** `78-BROAD-RELIABILITY` — establish independent,
defensible broad-reliability proof without reopening #55.

The latest offline quality review passes 14/14 validity, evidence traceability,
settlement, and explanation-fidelity rows with zero current severe misses. That
quality result is complete, but the older final-gate artifact predates it, and
the broader recall gate is still not a statistical claim. The owner has accepted
the practical-small sparse-category scope for this milestone and has not
authorized another expansion. Numeric FCF coverage is tracked as an
informational capability metric, not a mandatory closure gate, provided
unresolved cases remain safely Limited/Unscored.

The first #78 deliverable is frozen as a planning-only three-slot holdout
proposal in `evaluation/diagnostics/fast-broad-reliability-coverage-proposal-2026-09-02.json`
with the companion review in
`docs/results/FAST_BROAD_RELIABILITY_COVERAGE_PROPOSAL-2026-09-02.md`. It does
not authorize live execution.

No live run, provider call, or paid OpenAI call is implied by the current step.

## Ordered issue/dependency plan

| Order | Work item | Status | Exit criteria | Next when complete |
| --- | --- | --- | --- | --- |
| 1 | `55-GATE-RECONCILE` — Final gate reconciliation | **Complete** | Quality-aware review confirms 14/14 current rows are valid, traceable, settled, explanation-faithful, and free of current severe misses; historical artifacts remain immutable. | `55-DENOMINATOR-DECISION` |
| 2 | `55-DENOMINATOR-DECISION` — Non-overlapping denominator decision | **Complete** | One row per unique frozen claim ID; latest corrected outcome wins; only observed supported/missed claims with complete quality review are eligible. Result: 14 claims, 14 supported, 0 missed. | `55-GAP-DECISION` |
| 3 | `55-GAP-DECISION` — Closure-gate policy decision | **Complete** | Numeric FCF is not mandatory for closure when safe unresolved settlement, no favorable score, correct evidence binding, and production-shaped coverage are demonstrated. Sparse-category proof remains a separate gate. | `55-CLOSURE-REVIEW` |
| 4a | `55-FCF-REMEASURE` — Numeric FCF coverage | **Not required for #55 closure** | Optional future capability work may improve numeric coverage, but it is not a prerequisite for this milestone. | Separate future capability issue |
| 4b | `55-SPARSE-EXPANSION` — Independent category proof | **Conditional** | If samples remain insufficient under the closure review, run the smallest approved non-overlapping ticker set and freeze its answer key before execution. | `55-CLOSURE-REVIEW` |
| 5 | `55-CLOSURE-REVIEW` — Final #55 / PR #74 decision | **Complete — gate not passed** | Review under the accepted scope confirms denominator, quality, severe-miss, FCF safety, and practical-small category acceptance; overall recall generalization remains unestablished. | `55-CLOSURE-DECISION` |
| 6 | `55-RECALL-PROOF-DECISION` — Independent reliability-proof decision | **Complete — scope accepted** | Owner accepts the practical-small sparse-category scope for this milestone; no additional sparse expansion is authorized now. The scope is not a broad statistical reliability claim. | `55-CLOSURE-DECISION` |
| 7 | `55-CLOSURE-DECISION` — Owner closure decision | **Complete — practical scope accepted** | Owner accepted the bounded practical-small scope while broad statistical reliability remained unclaimed; the historical next step was the alignment work in `55-OPERATIONAL-CLOSE`. | `55-OPERATIONAL-CLOSE` |
| 8 | `55-OPERATIONAL-CLOSE` — Bounded #55/PR #74 closure alignment | **Complete** | Closure metadata and docs aligned; focused commit `2a90b64` merged through PR #74; Issue #55 closed with broad reliability explicitly unproven. | `78-BROAD-RELIABILITY` |
| 9 | `78-BROAD-RELIABILITY` — Independent broad-reliability proof | **Active — planning only** | Three-slot holdout coverage proposal is prepared; freeze authoritative baselines and exact claim IDs, preserve #55 artifacts, and stop for owner approval before any live batch. | Future approved calibration batch |

## State transitions

- When `55-GATE-RECONCILE` completes, mark it complete and make
  `55-DENOMINATOR-DECISION` the single active step.
- The `55-GAP-DECISION` is complete: numeric FCF remeasurement is not required
  for #55 closure. It led to the closure review; sparse expansion was considered
  only if independent category samples were insufficient.
- The owner-accepted practical-small scope does not authorize another #55 sparse
  expansion. With the accepted-scope review complete, activate
  `78-BROAD-RELIABILITY` for separate planning work; it must not rewrite or
  reopen #55's bounded result.
- A failed gate does not advance the plan; it records a blocker and creates a
  narrowly scoped offline correction or separately approved live evaluation.

## Guardrails

- NIO's `unavailable_authoritative_evidence` remains excluded from system-miss
  counts unless safe authoritative evidence becomes available.
- Sparse counts remain disclosed as practical samples, not statistical proof.
- Numeric FCF coverage and safe unresolved settlement are separate dimensions;
  numeric coverage is informational for #55 closure, while Limited/Unscored is
  required when authoritative inputs are unavailable or invalid.
- No live calibration is authorized by this document. Any live batch requires
  explicit owner approval and frozen bounds.
- No paid provider or paid OpenAI verification is authorized by this document.
