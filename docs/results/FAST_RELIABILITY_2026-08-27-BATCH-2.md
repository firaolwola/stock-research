# Fast reliability calibration — 2026-08-27 batch 2

## Outcome

The owner-approved second Issue #55 batch repeated AAPL, AMC, NCPL, NXL, and
SMCI exactly once against the unchanged batch-1 baselines. Recall improved from
57/86 (66.28%) to 71/86 (82.56%), but remains below the approximate 95% gate.
Several adequately sampled categories remain below 90%, severe misses remain,
and SMCI failed application-equivalent report validation. Issue #55 and PR #74
must remain open and unmerged.

No retry, extra ticker, Deep run, hosted web search, or difficult-budget run was
used. Batch 1 remains independently auditable under `evaluation/live/2026-08-27`;
batch 2 is under `evaluation/live/2026-08-27-batch-2`.

## Operating results

| Ticker | Elapsed | Measured OpenAI cost | Result | Termination |
| --- | ---: | ---: | --- | --- |
| AAPL | 6,597 ms | $0.015242 | Valid partial | Partial coverage |
| AMC | 9,779 ms | Unmeasured failed synthesis | Valid partial | Partial coverage |
| NCPL | 1,649 ms | $0 | Valid partial | Cost ceiling before synthesis |
| NXL | 9,501 ms | Unmeasured failed synthesis | Valid partial | Partial coverage |
| SMCI | 1,522 ms | $0 | Invalid partial | Cost ceiling before synthesis |

Average latency was 5,809.6 ms and maximum latency was 9,779 ms; every run was
below 20 seconds. Measured OpenAI cost was $0.015242. Conservatively assigning
the full $0.03 normal ceiling to each of the two unmeasured synthesis failures
produces a maximum possible $0.075242, below the approved $0.15 batch limit.
Alpha Vantage made exactly 10 requests. Market data completed for all five;
news returned provider-quota information for all five and remained Limited.

## Recall comparison

| Category | Batch 1 | Batch 2 |
| --- | ---: | ---: |
| Overall material checks | 57/86 (66.28%) | 71/86 (82.56%) |
| Issuer/security identity | 5/5 | 5/5 |
| Historical dilution/issuance | 3/3 | 3/3 |
| Future dilution evidence | 4/4 | 4/4 |
| Warrants/convertibles | 2/4 | 4/4 |
| Reverse splits | 2/3 | 2/3 |
| Active listing deficiency | 2/2 | 2/2 (sparse) |
| Going concern | 2/2 | 2/2 (sparse) |
| Accounting/restatement/non-reliance | 1/3 | 1/3 |
| Financial health/liquidity | 2/5 | 5/5 |
| Revenue | 0/5 | 2/5 |
| Net income/loss | 0/5 | 3/5 |
| Debt | 5/5 | 5/5 |
| Free cash flow | 3/5 | 3/5 |
| Cash | 5/5 | 5/5 |
| Operating cash flow | 3/5 | 4/5 |
| Shares history | 1/5 | 4/5 |
| Catalyst/news | 4/5 | 4/5 |
| Discovery-only handling | 5/5 | 5/5 |
| End-of-day market context | 5/5 | 5/5 |
| Missing/stale/conflicting settlement | 3/5 | 3/5 |

The 16.28-point absolute recall improvement is real but insufficient. In
particular, reverse splits, accounting invalidity, revenue, net income, FCF,
OCF, shares, catalyst, and uncertainty handling do not all meet the required
threshold.

## Previously severe failures

- **AMC reverse split:** not fixed live. The completed 1-for-10 split remains
  outside selected filing retrieval. The newer post-split share window does
  expose 137.6% genuine growth, improving the dilution view without confusing
  that growth with a split.
- **NCPL non-reliance:** numeric OCF and affected flow scores now fail closed as
  required, but the extracted sentence is generic forward-looking-statement
  boilerplate, not the actual accounting non-reliance event. The safe settlement
  is reached for the wrong reason, so the severe explanation/retrieval miss is
  unresolved.
- **SMCI OCF/FCF:** fixed. Current comparable nine-month OCF and FCF of roughly
  -$7.56B and -$7.69B take precedence over annual history; both trend scores are
  0 instead of the prior favorable 8.4/8.1.
- **SMCI shares:** partially fixed. The unexplained discontinuity becomes
  Limited instead of a false 1035.3% dilution claim, but the stock-split filing
  was not selected and the Limited series retained observations, causing report
  validation to fail.
- **SMCI material weakness:** not fixed live. The warning remains omitted.
- **Duration collision:** fixed where evidence was usable. AAPL and SMCI now
  retain distinct quarterly and YTD facts and receive revenue/net-income scores.
  AMC was subsequently invalidated by the false non-reliance match; NCPL is
  correctly unresolved in principle; NXL revenue remains unavailable for a
  separate fact-selection reason.

## New reproduced defects

1. The non-reliance pattern is too broad. Generic offering and
   forward-looking-statement disclaimers falsely invalidate AMC and NCPL flows.
2. A Limited shares series may retain observations, violating the semantic
   report contract and making SMCI unusable.
3. A restored-compliance statement can be emitted as a current compliance
   warning, as seen for SMCI.
4. Bounded corporate-action selection still misses AMC's older completed split
   and SMCI's forward split.

## Scoring, explanations, and settlement

Using the frozen owner-reviewed score ranges, 21/57 evaluated score expectations
passed (36.84%). Application-invalid SMCI receives no score credit. Batch 1 did
not have a defensible aggregate rate because too many components were missing,
so no retrospective rate was invented.

Explanation fidelity passed for 2/5 tickers (AAPL and NXL). Settlement accuracy
passed for 3/5: AAPL and NXL settled correctly; NCPL reached the required safe
state but for the wrong extracted reason; AMC was falsely over-limited; and
SMCI was application-invalid. No missing evidence became favorable, but safe
failure alone is not sufficient for the reliability milestone.

## Remaining sampling and next step

Completed reverse splits, active listing deficiencies, going concern, foreign
issuers/ADRs/IFRS, and OTC/delisted securities remain sparse or unproven. A third
live batch is premature because this repeat still contains deterministic severe
failures. Correct the reproduced defects first and add offline regressions.

After those corrections, the smallest useful currently baselined candidate set
is BIOR and MULN (additional completed-split/listing cases), NIO (foreign ADR /
20-F), and TUPBQ (OTC/delisted plus going concern). That would be at most four
Fast runs, eight Alpha requests, and a $0.12 OpenAI ceiling. It would improve
coverage substantially but would still leave ADR and OTC categories with small
samples; no run is authorized by this report.
