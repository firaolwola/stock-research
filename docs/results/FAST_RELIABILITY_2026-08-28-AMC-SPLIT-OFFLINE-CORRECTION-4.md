# Issue #55 AMC split offline correction 4

Date: 2026-08-28  
Mode: deterministic reproduction only; no live or paid-provider calls

## Finding

The latest live AMC diagnostic still showed a recoverable `1-for-10` ratio and
`2023-08-24` date, but `unknown_date_role` and `resolved_lifecycle_required`.
The remaining normalized filing shape was an effective-date relationship such
as “the effective date of which was August 24, 2023”. Nearby-date extraction
could recover the date, while the explicit effective-date role matcher rejected
the intervening relationship words.

## Correction

The bounded effective-date grammar now accepts `of which`, `of the action`, and
similar narrowly scoped relationship wording before `was`, `is`, or `being`.
The same grammar is used by date extraction and role classification, so the
explicit effective-date proof and the completed fallback lifecycle remain bound
to the same local action span. Existing filing-date, authorization, truncation,
competing-ratio, and future-date safeguards remain unchanged.

An inline-XBRL-shaped regression now produces an accepted completed
`1-for-10` event on `2023-08-24`. This correction is offline-only; the failed
live confirmation and all historical calibration artifacts remain unchanged.
Any further AMC live check requires separate owner approval.
