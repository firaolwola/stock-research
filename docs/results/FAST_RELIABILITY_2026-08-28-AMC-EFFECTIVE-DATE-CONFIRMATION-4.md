# Issue #55 AMC effective-date confirmation 4

Date: 2026-08-28  
Mode: one approved live Fast run; no retry, Deep, hosted search, or paid OpenAI
synthesis

The report was valid and safely partial in about 2.5 seconds, but the live
diagnostic still extracted `1-for-10` and `2023-08-24` as
`unknown_date_role` and withheld the event as `resolved_lifecycle_required`.
Targeted recall was 0/1; no false event reached the report.

OpenAI spend was `$0` because synthesis was cost-blocked before request. Alpha
Vantage made two bounded attempts; Twelve Data made none. The result is
preserved unchanged and does not authorize another live run. The remaining
work is offline reproduction of the direct effective-date relationship shape.
