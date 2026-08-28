# Issue #55 MULN Verification-4 offline correction

No live or paid request was made. The immutable Verification-4 artifact remains
the regression baseline.

The false 1-for-2 action came from the ratio grammar accepting the short word
`two` before the complete phrase `two hundred fifty`. Ratio parsing now consumes
a complete numeric or number-word token, preserves multi-digit denominators, and
records token completeness and truncation-boundary diagnostics.

Completed canonical actions now require a complete ratio, resolved lifecycle,
safe action date, same-action binding, no unresolved intervening ratio, no
truncated required field, and identity-gated SEC provenance. Canonicalization
rechecks that invariant rather than trusting an extraction diagnostic. The June
1-for-100 action binds to June 2 and cannot borrow the August 4 date from the
intervening 1-for-250 action.

The stored-evidence replay retains these nine supported actions:

- 2023-05-04 — 1-for-25
- 2023-08-11 — 1-for-9
- 2023-12-21 — 1-for-100
- 2024-09-17 — 1-for-100
- 2025-02-18 — 1-for-60
- 2025-04-11 — 1-for-100
- 2025-06-02 — 1-for-100
- 2025-08-04 — 1-for-250
- 2025-09-22 — 1-for-250

Offline adjudication classifies January 24 and October 16, 2024 as restored-
compliance dates rather than corporate-action dates. The Verification-4
1-for-2 on August 1 and 1-for-100 on August 4 are false parser products. The
September 2024, February 2025, April 2025, and September 2025 extras have direct
stored SEC support and are genuine. This prospective correction does not modify
the frozen live measurement or expand its original five-event answer key.

Issue #55 and PR #74 remain open. A final MULN live verification would now be
technically justified, but it requires a fresh explicit owner authorization.
