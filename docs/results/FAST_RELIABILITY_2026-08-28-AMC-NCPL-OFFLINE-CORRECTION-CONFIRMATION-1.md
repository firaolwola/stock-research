# Issue #55 AMC/NCPL targeted live confirmation

Date: 2026-08-28  
Mode: exactly one live Fast run each for AMC and NCPL; no retries, Deep, or hosted search

## Outcome

NCPL's Item 4.02 correction is confirmed on the live SEC path. The report
surfaces a critical non-reliance warning and settles affected revenue, income,
cash-flow, and other historical financial inputs Limited/Unscored.

AMC's completed 2023-08-24 1-for-10 split remains absent. The live report is
valid and safe (reverse-split coverage remains Limited), but this is still a
severe retrieval/filing-selection miss for the frozen targeted baseline.

## Measurements

| Measure | Result |
| --- | ---: |
| Targeted checks | 1 / 2 (50%) |
| Valid reports | 2 / 2 |
| Settlement safety | 2 / 2 |
| Explanation fidelity | 1 / 2 |
| OpenAI cost | $0 recorded; synthesis was cost-blocked before request |
| Alpha Vantage | 4 requests (approved maximum) |
| Twelve Data | 0 requests (not configured) |
| Elapsed | AMC 2.65s; NCPL 2.51s |

No historical calibration artifact or answer key was changed. Issue #55 and
PR #74 remain open/not ready: AMC requires an offline fix to bounded filing
selection/discovery before any separately approved AMC-only confirmation.
