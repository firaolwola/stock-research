# Issue #55 final same-five confirmation

The fresh bounded confirmation ran AAPL, AMC, NCPL, NXL, and SMCI exactly once
each on 2026-08-28. It used the unchanged Batch-3 baselines and bounds: no
retries, no Deep or hosted search, a 20-second ticker ceiling, ten Alpha
Vantage requests, and a $0.15 aggregate OpenAI cap.

Against the frozen 86-check denominator, the confirmation detected 82 checks
(95.35%). All five reports were valid and all missing components remained
Limited/Unscored. OpenAI cost was $0; Alpha Vantage used ten requests and
Twelve Data was not configured.

The run corrected the AAPL false material-weakness warning, preserved SMCI's
material weakness while treating restored Nasdaq compliance as historical, and
kept NXL's split prospective at the frozen 2026-08-27 cutoff. Two severe live
misses remain: AMC's completed 1-for-10 reverse split is still absent, and the
NCPL Item 4.02/non-reliance event was not surfaced. FCF also remains below its
target category coverage.

The run was completed after the frozen baseline date. The NXL effective
2026-08-28 event was therefore excluded from adjudication against the
2026-08-27 answer key; historical artifacts were not rewritten. NIO's
`unavailable_authoritative_evidence` classification remains unchanged.

The numerical recall target alone is not sufficient: severe-miss and category
gates fail, so Issue #55 remains open and PR #74 is not ready to merge.
