# Issue #55 MULN Verification-5 offline correction — 2026-08-28

This correction uses the immutable Verification-5 artifact as its regression
baseline and does not change the frozen live result. No SEC, market-data,
OpenAI, Deep, or hosted-search request was made.

Verification-5 treated the August 1, 2025 certificate-amendment filing date as
a completed action date even though authoritative corroboration identified
August 4, 2025 as the effective date of the same 1-for-250 reverse split. The
extractor now classifies dates by role. A filing date is supporting provenance
and cannot independently satisfy the Completed event-date invariant.

Canonicalization reconciles a certificate filing reference only when exactly
one event for the same issuer, direction, and ratio has an effective,
completion, trading-effective, or passed scheduled-effective date within seven
calendar days. The effective event supplies the canonical date; the filing
claim and source remain attached as corroboration. Zero or multiple matches stay
withheld. Events with materially separated effective dates remain distinct.

The stored-live deterministic replay now yields these nine actions:

- 2023-05-04 — 1-for-25
- 2023-08-11 — 1-for-9
- 2023-12-21 — 1-for-100
- 2024-09-17 — 1-for-100
- 2025-02-18 — 1-for-60
- 2025-04-11 — 1-for-100
- 2025-06-02 — 1-for-100
- 2025-08-04 — 1-for-250
- 2025-09-22 — 1-for-250

The August 1 duplicate is absent. Internal diagnostics retain the extracted
date, date role and evidence, chosen canonical date, merge target and reason,
and the filing/effective reconciliation disposition. These diagnostics remain
outside the user-facing report.

Deterministic tests cover a filing-only certificate, explicit same-day filing
and effectiveness, the exact August 1/August 4 pair, separated same-ratio
actions, all supported date roles, and the full nine-action history. A final
bounded MULN live verification is technically justified to confirm that the
current SEC filing shape follows this tested path, but it requires a new owner
authorization and is not needed to establish the offline fix.
