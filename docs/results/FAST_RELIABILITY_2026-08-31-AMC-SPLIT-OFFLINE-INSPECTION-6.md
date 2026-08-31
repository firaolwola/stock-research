# Issue #55 AMC split offline inspection and correction 6

Date: 2026-08-31  
Mode: deterministic captured-artifact inspection; no live or paid-provider calls

## Finding

The frozen confirmation-4 diagnostic contains one relevant occurrence from
accession `0001104659-23-090981` / `tm2323643d1_8k.htm`. The bounded SEC span
correctly extracted the written ratio `one-for-ten` (`1-for-10`) and the date
`2023-08-24`, with the date before the ratio (`source_date_position=8615`,
`source_ratio_position=8705`). Its date role remained `unknown_date_role`, so
the canonical safety invariant withheld the event as
`resolved_lifecycle_required`.

The captured artifact does not retain filing-body text, so the exact source
sentence cannot be reproduced verbatim. The positional shape identifies the
remaining unsupported form: a date-first clause that identifies the date as
the effective date of the reverse split (for example, “DATE was the effective
date of the one-for-ten reverse stock split”).

## Correction

The shared SEC date extractor and date-role classifier now accept this narrowly
bounded date-first relationship only when it remains adjacent to a reverse
split reference. Past dates can then settle as completed through the existing
safe lifecycle fallback. Filing dates, authorization ranges, future dates,
undated mentions, truncated ratios, and competing actions remain ineligible
for completed canonical acceptance.

The new regression uses HTML markup and written `one-for-ten` wording and
asserts one completed `1-for-10` event on `2023-08-24`. No live result or
historical calibration baseline changed. A new live confirmation still
requires separate owner approval.
