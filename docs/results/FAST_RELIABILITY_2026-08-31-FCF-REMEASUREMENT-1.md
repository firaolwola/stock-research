# Issue #55 FCF remeasurement 1 (2026-08-31)

This was the owner-approved two-run live remeasurement after the offline FCF
period-selection correction in commit `8a6c329`. Historical calibration
artifacts and answer keys remain unchanged.

## Bounds and operations

- Tickers: AMC and NXL, one Fast run each
- No retries, Deep, hosted search, or difficult-budget escalation
- 20-second ceiling per ticker; 40-second aggregate limit
- OpenAI maximum: $0.06; measured cost: $0
- Alpha Vantage maximum: 4; used: 4
- Twelve Data maximum: 4; used: 0 (not configured)
- Combined optional-provider attempts: 4 of 8

Both reports were valid safe-partial reports. AMC completed in 2,505 ms and
NXL in 2,095 ms. Synthesis was cost-blocked before an OpenAI request; no paid
OpenAI tokens were consumed.

## FCF result

| Ticker | OCF | FCF | Settlement | Finding |
| --- | --- | --- | --- | --- |
| AMC | Confirmed through 2026-06-30 | Unknown; no aligned capex | Limited/Unscored | SEC Company Facts did not provide an aligned capital-expenditure input |
| NXL | Confirmed through 2026-06-30 | Unknown; no aligned capex | Limited/Unscored | SEC Company Facts did not provide an aligned capital-expenditure input |

The new aligned-duration logic was not contradicted. Neither live case
contained a usable aligned SEC OCF/capex pair to exercise it. The result is
therefore unavailable authoritative evidence, not a new parser or scoring
failure. OCF was not mislabeled as FCF and no favorable score was inferred.

## Milestone impact

The frozen same-five FCF measurement remains 3/5 (60%), and this remeasurement
does not change that denominator. A future FCF category remeasurement would
require independently authorized cases with authoritative capex evidence (or a
separately approved filing-table extraction enhancement); no additional run is
authorized by this result. Issue #55 remains open and PR #74 remains unmerged.
