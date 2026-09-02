# Fast broad-reliability coverage proposal (Issue #78)

Status: planning only. No SEC, provider, hosted-search, or paid OpenAI calls
were made.

## Starting point

The accepted #55 milestone is closed under its bounded practical-small scope.
Its frozen non-overlapping denominator contains 14 unique claim IDs, all 14
supported after quality review. Historical artifacts and answer keys remain
immutable. `unavailable_authoritative_evidence` (including NIO's attributable
annual net-loss case) is not a system miss when bounded authoritative retrieval
completes but no safe concept or fallback exists.

The full claim list and evidence lineage are recorded in
`evaluation/diagnostics/fast-reliability-canonical-claim-matrix-2026-09-01.json`.

## Current category map

The current practical counts are: completed reverse splits 5, active listing
deficiency 3, going concern/bankruptcy 4, foreign issuer/ADR/IFRS 3, OTC/delisted
5, and FCF trend 5 (with only 3 detected in the frozen same-five cohort). These
are planning counts, not statistical proof. Active listing, going-concern, and
foreign/IFRS remain under-sampled against the planning minimum of five
independent positive cases.

## Smallest proposed holdout

The smallest useful design is three previously untested primary cases, selected
only after an authoritative SEC/exchange/issuer baseline is prepared:

1. active listing deficiency + going concern;
2. foreign issuer/ADR/IFRS + OTC/delisted;
3. active listing deficiency + foreign issuer/ADR/IFRS.

These are coverage slots, not ticker approvals or expected-answer substitutions.
Each slot receives a claim ID only after its independent baseline is frozen. If
the required fact cannot be safely established, the slot remains unobserved or
`unavailable_authoritative_evidence`; it is not converted into a positive case.

If approved later, the template is exactly three Fast runs, no retries or Deep,
20 seconds per ticker, 60 seconds aggregate, $0.09 OpenAI maximum, six Alpha
Vantage requests, six Twelve Data requests, and twelve combined optional-provider
attempts. No live run is authorized by this document.

## Gate and next action

The existing gate remains unchanged: approximately 95% overall recall,
approximately 90% in every adequately sampled category, and zero unresolved
severe misleading misses. Small samples must remain explicitly practical-small.

Next action: prepare authoritative baselines for the three coverage slots and
freeze exact claim IDs and evidence references. Stop for owner approval before
any live execution.
