# Issue #81 FCF gate confirmation (2026-08-31)

This owner-approved confirmation remeasured the five frozen Issue #55 tickers
after bounded SEC filing-table FCF coverage. It does not rewrite any prior
answer key, cohort, or measured denominator.

## Execution

- AAPL, AMC, NCPL, NXL, and SMCI; exactly one Fast run each
- No retries, Deep runs, hosted search, or difficult-budget escalation
- 20-second per-ticker ceiling; five runs completed in 10,507 ms aggregate
- OpenAI maximum $0.15; measured OpenAI requests 0 and cost $0
- Alpha Vantage: 10 requests; Twelve Data: 0; combined optional attempts: 10
- All five reports were valid safe-partial reports

## FCF adjudication

| Ticker | Result | FCF score/state | Settlement |
| --- | --- | --- | --- |
| AAPL | aligned SEC pair | 8.7 / Confirmed | Valid report |
| AMC | no aligned authoritative capex | Limited/Unscored | Valid report |
| NCPL | affected history invalidated by non-reliance | Limited/Unscored | Valid report |
| NXL | no aligned authoritative capex | Limited/Unscored | Valid report |
| SMCI | aligned SEC pair | 0 / Confirmed | Valid report |

Strict usable FCF coverage was 2/5 (40%); safe settlement was 5/5. The three
unresolved cases remained explicitly Limited/Unscored and did not become
favorable evidence. This is a descriptive remeasurement, not a replacement for
the frozen same-five FCF denominator of 3/5 (60%).

## Milestone impact

Issue #55 remains open and PR #74 remains not merge-ready. The FCF category
gate is not satisfied by this confirmation; any future denominator change would
require a new, independently approved cohort and must keep the frozen results
non-overlapping. Full machine-readable details are in
`evaluation/live/2026-08-31-fcf-gate-confirmation-1/summary.json`.
