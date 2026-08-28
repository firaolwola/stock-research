# Issue #55 Verification-6 overlapping-span correction — 2026-08-28

This offline correction uses the frozen Verification-6 MULN artifact as its
regression baseline. It makes no SEC, provider, OpenAI, Deep, or hosted-search
request and does not alter any historical evaluation artifact.

Verification-6 exposed two overlapping interpretations of the same August 1,
2025 certificate reference. A broad retrospective-history span labeled the date
as completion while the more direct certificate span correctly labeled it as a
filing date. The inferred occurrence passed the old segment-local invariant
before the two interpretations were compared, creating a false completed event
beside the real August 4 effective action.

Extraction now assigns every dated split occurrence a stable source-reference
identity from its accession, source document, ratio, date, and absolute text
position. Before canonical acceptance, overlapping interpretations of that
reference are resolved by evidence specificity:

1. explicit effective, completion, or split-adjusted-trading language;
2. explicit certificate or amendment filing language;
3. explicit authorization, scheduled-effective, or announcement language;
4. resolved lifecycle context; and
5. retrospective or generic fallback inference.

A unique stronger role suppresses the weaker interpretation. Equal-strength
different roles remain withheld. In particular, explicit filing provenance is
negative evidence against an inferred completion date for the same source
reference. Explicit effective evidence still establishes the canonical event
date and outranks filing provenance.

The stored-live regression now produces the nine supported MULN actions:

- 2023-05-04 — 1-for-25
- 2023-08-11 — 1-for-9
- 2023-12-21 — 1-for-100
- 2024-09-17 — 1-for-100
- 2025-02-18 — 1-for-60
- 2025-04-11 — 1-for-100
- 2025-06-02 — 1-for-100
- 2025-08-04 — 1-for-250
- 2025-09-22 — 1-for-250

August 1 remains filing provenance and merges into the August 4 event. It no
longer appears as a user-facing Completed action. BIOR canonical split behavior,
the one-case runner lifecycle, recursive plan resolution, and application versus
evaluator score-before-validation parity remain covered by deterministic tests.

Internal diagnostics now retain occurrence and source-reference IDs, absolute
source ranges and ratio/date positions, evidence strength, competing overlapping
occurrence IDs, the winning role, losing interpretation, conflict reason, and
whether retrospective fallback was suppressed. They remain outside the report.

Offline verification passed: 57 focused Issue #55 regression checks, all 313
repository tests, report-fixture validation, the token-free dry evaluation,
application/evaluator parity, ACME/XYZ/PENDING mock flows, real-app startup
without research, and `git diff --check`.

No additional live MULN run is authorized. One fresh bounded confirmation is
technically justified because Verification-6 proved that its captured live shape
reached a branch that earlier stored fixtures did not reproduce exactly; it still
requires separate owner approval.
