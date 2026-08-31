# Issue #55 FCF remeasurement 2 (2026-08-31)

This owner-approved independent two-ticker run tested the corrected SEC period
alignment with one positive and one negative U.S.-GAAP cash-flow case. No retry,
Deep run, hosted search, or difficult-budget escalation occurred. The frozen
Issue #55 baselines remain unchanged.

## Bounds and operations

- Tickers: MSFT and RIVN, exactly one Fast run each
- 20-second ceiling per ticker; 40-second aggregate bound
- OpenAI maximum: $0.06; measured cost: $0
- Alpha Vantage maximum: 4; used: 4
- Twelve Data maximum: 4; used: 0 (not configured)
- Combined optional-provider attempts: 4 of 8
- SEC retrieval completed for both cases; no SEC failures
- First useful latency: MSFT 232 ms, RIVN 205 ms
- Total Fast elapsed: MSFT 2,117 ms, RIVN 1,891 ms

Synthesis was cost-blocked before an OpenAI request. Both outputs were valid
safe-partial reports and all missing optional context remained Limited.

## FCF result

| Ticker | SEC OCF | SEC capex | Derived FCF | Score/state | Finding |
| --- | ---: | ---: | ---: | --- | --- |
| MSFT | $182.935B | $115.948B | $66.987B | 7 / Confirmed | Positive aligned annual pair; comparable FCF observation retained |
| RIVN | -$1.190B | $0.734B | -$1.924B | 1 / Confirmed | Negative aligned six-month pair; comparable FCF observation retained |

Both reports paired OCF and capital expenditures with matching currency and
period cadence. The parser did not infer FCF from OCF alone, mix annual and
quarterly observations, or promote secondary-provider data. The contrasting
scores demonstrate the intended higher-is-stronger FCF direction.

## Milestone impact

This remeasurement validates the corrected FCF path on two independent clean
shapes, but it does not rewrite the frozen same-five denominator. That frozen
category remains 3/5 (60%); AMC, NCPL, and NXL still settle Limited/Unscored
when aligned authoritative capex is unavailable or invalidated. Consequently,
FCF remains below the approximately 90% category gate and Issue #55 stays open.

The run does not authorize another live batch, merge PR #74, or close Issue #55.
