# Fast reliability calibration — 2026-08-27

## Outcome

The approved initial Issue #55 batch did **not** pass the Fast reliability
milestone. Five live Fast runs were completed exactly once for AAPL, AMC, NCPL,
NXL, and SMCI. No extra ticker, retry, difficult-budget escalation, hosted web
search, or Deep run was used.

The adjudicated material-check recall was 57/86 (66.28%), below the approximate
95% overall target. Several categories were below 90%, important categories
remain sparsely sampled, relative score ordering could not be established, and
four severe misleading failure patterns remain unresolved. Issue #55 must stay
open.

The frozen plan is in
`evaluation/plans/fast-reliability-2026-08-27.json`. Raw validated-evidence
artifacts, per-ticker independent reviews, and the machine-readable result are
under `evaluation/live/2026-08-27/`.

## Operating results

| Ticker | Elapsed | Measured OpenAI cost | Synthesis | Alpha market | Alpha news |
| --- | ---: | ---: | --- | --- | --- |
| AAPL | 7,986 ms | $0 | Unavailable | Completed | Provider quota |
| AMC | 7,525 ms | $0.012814 | Completed | Completed | Provider quota |
| NCPL | 9,322 ms | $0 | Unavailable | Completed | Provider quota |
| NXL | 7,949 ms | $0.015171 | Completed | Completed | Provider quota |
| SMCI | 5,796 ms | $0 | Unavailable | Completed | Provider quota |

All runs remained below the 20-second ceiling. Known measured OpenAI cost was
$0.027985. Three failed synthesis attempts returned no usage measurement; even
charging each its complete $0.03 normal-run ceiling gives a conservative maximum
of $0.117985, below the approved $0.15 batch maximum. Alpha Vantage used exactly
10 requests. Its market endpoint returned usable data for all five tickers, but
the news endpoint returned its quota/information response for every case. News
therefore stayed Limited and never affected material scoring.

## Validation note

The first standalone-runner summary labeled the five evidence assemblies
invalid because it validated them before adding deterministic scores. Express
normally calls `calibrateReportScores` before its final validation boundary.
Applying that same application boundary offline made all five retained reports
valid without another network or paid call. The runner now follows the Express
order. This was an evaluation-harness defect, not a live application validation
regression.

## Recall by category

| Category | Detected / expected | Recall | Result |
| --- | ---: | ---: | --- |
| Issuer/security identity | 5/5 | 100% | Initial pass |
| Historical dilution/issuance | 3/3 | 100% | Initial pass; small sample |
| Future dilution | 4/4 | 100% | Initial pass; small sample |
| Warrants/convertibles | 2/4 | 50% | Fail |
| Reverse splits | 2/3 | 66.67% | Fail, sparse |
| Active listing deficiency | 2/2 | 100% | Unproven: sparse |
| Going concern | 2/2 | 100% | Unproven: sparse |
| Accounting/restatement/non-reliance | 1/3 | 33.33% | Fail |
| Financial health/liquidity | 2/5 | 40% | Fail |
| Revenue | 0/5 | 0% | Fail |
| Net income/loss | 0/5 | 0% | Fail |
| Debt | 5/5 | 100% | Initial pass |
| Free cash flow | 3/5 | 60% | Fail |
| Cash | 5/5 | 100% | Initial pass |
| Operating cash flow | 3/5 | 60% | Fail |
| Shares history | 1/5 | 20% | Fail |
| Catalyst/news | 4/5 | 80% | Fail |
| Discovery-only behavior | 5/5 | 100% | Pass |
| End-of-day price/volume | 5/5 | 100% | Pass |
| Missing/stale/conflicting handling | 3/5 | 60% | Fail |

These are owner-reviewed material checks, not independent statistical samples.
Even a 100% row is not declared reliable when its sample is sparse.

## Severe misleading misses

1. **AMC reverse split and shares history.** Fast found the current offering but
   omitted the completed 1-for-10 reverse split. Its shares chart ended before
   the latest issuance and described only 2.5% growth, materially understating
   the known dilution window.
2. **NCPL non-reliance gating.** Fast downloaded the relevant August 18 8-K but
   did not extract the non-reliance event. It then gave operating cash flow a
   numeric score instead of invalidating affected financial trends.
3. **SMCI current cash-flow direction.** Fast gave OCF 8.4 and FCF 8.1 from older
   annual history despite current comparable nine-month OCF of about -$7.56B
   and FCF of about -$7.69B. The unresolved material weaknesses were also not
   surfaced.
4. **SMCI split-adjusted shares.** Fast described a 1035.3% shares-outstanding
   increase without normalizing the 2024 stock split, falsely presenting a
   corporate-action discontinuity as dilution.

The NXL baseline also changed during the evaluation: an August 27 8-K confirmed
that a 1-for-30 reverse split had been effectuated. Fast correctly found this
newer authoritative fact. The review records it as a baseline revision, not a
Fast error.

## Root-cause classification

- **Company Facts normalization:** duration facts with the same filing and end
  date but different starts/frames are treated as contradictory. This caused
  revenue and net income to settle Unknown in all five cases.
- **Bounded filing interpretation:** selected filings were retrieved, but
  explicit non-reliance and some control-warning language were not extracted.
- **Corporate-action normalization:** shares series are not adjusted or
  invalidated across stock splits and may end before a newer issuance.
- **Freshness/calibration:** older annual flow series can produce favorable
  scores even when a current comparable period has deteriorated sharply.
- **Retrieval selection:** a single bounded filing per selection group is not
  sufficient to recover material reverse-split and financing history reliably.

## Score calibration and ordering

The expected score-range and relative-ordering gates did not pass. Most capital
risk scores stayed Limited even when material evidence was retrieved. Revenue
and net-income scores were unavailable across the whole set. Some financial
scores were directionally wrong or outside their reviewed ranges, including the
severe SMCI cash-flow cases. It would be misleading to compute a score-range
pass rate from only the surviving numeric components.

## Required corrective work

Before another live calibration is proposed:

1. Disambiguate Company Facts duration facts by start, end, form/frame, and
   cadence.
2. Add deterministic non-reliance/restatement extraction and propagate those
   conflicts into every affected financial score gate.
3. Retrieve completed reverse-split history independently of the single recent
   corporate-action slot.
4. Normalize or invalidate shares history across splits and require freshness
   after material issuances.
5. Make current comparable OCF/FCF evidence constrain or invalidate older annual
   trend scores.
6. Add deterministic regression cases for AMC, NCPL, NXL, and SMCI shapes.

Any later live batch requires a new explicit owner approval. This batch does not
establish reliability for foreign issuers, ADR/IFRS reporting, OTC/delisted
securities, or the already sparse reverse-split, listing-deficiency, and
going-concern categories.
