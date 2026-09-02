# Issue #55 AMC split offline correction 5

Date: 2026-08-28  
Mode: deterministic reproduction only; no live or paid-provider calls

## Finding

The second fresh AMC confirmation still produced a valid Limited report. Its
diagnostic extracted `1-for-10` and `2023-08-24`, but retained
`unknown_date_role` / `resolved_lifecycle_required`. Offline replay showed the
remaining grammar gap was the common wording “with an effective date of DATE”
(and equivalent `effective date thereof` wording). The prior relationship
grammar only accepted an intervening action/split/which token, so it rejected a
direct `of DATE` phrase.

## Correction

The bounded effective-date grammar now accepts direct `of`/`for` date forms and
the `thereof` relationship, while preserving the same local action-span,
issuer, date-role, future-date, filing-date, authorization, truncation, and
competing-ratio protections. The date extractor and role classifier share the
grammar, and the past-effective-date fallback retains its lifecycle proof.

Regression coverage confirms a live-shaped inline-XBRL clause promotes a
completed `1-for-10` event on `2023-08-24`. The failed live confirmation and
all historical baselines remain unchanged. Any further AMC live confirmation
requires separate owner approval.
