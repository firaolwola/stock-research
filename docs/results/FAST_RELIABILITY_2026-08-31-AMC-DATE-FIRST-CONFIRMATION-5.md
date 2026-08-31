# Issue #55 AMC date-first effective-date confirmation 5

Date: 2026-08-31  
Mode: one approved live attempt; no retry

## Result

The bounded runner produced a valid safe-partial report in 97 ms, but the
environment denied the first SEC ticker-map network request before any SEC
response, optional provider request, or OpenAI synthesis. Safe diagnostics
reported:

`phase=sec_ticker_map_request; endpoint_category=ticker_map; constructor=TypeError; cause=AggregateError; cause_code=EACCES; response_received=false; cache_state=miss; request_count=1`

The report therefore contained no issuer or reverse-split evidence and settled
all dependent areas as Limited. Report validation passed. No false corporate
action was emitted, but the AMC `2023-08-24 — 1-for-10` target was not
evaluated, so this run cannot resolve the live parser blocker.

OpenAI cost was $0 and no optional-provider requests were made. The attempt
was not retried; a future live confirmation requires a separate approval after
network access is available.
