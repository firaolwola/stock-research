# Fast reliability calibration — 2026-08-27 batch 3

## Outcome

The approved same-five verification produced 83/86 material checks (96.51%),
up from 66.28% in Batch 1 and 82.56% in Batch 2. All five reports validated and
the prior NCPL and SMCI deterministic blockers improved. The milestone still
fails because four severe misleading misses remain, FCF and reverse-split
category recall remain below 90%, and several critical categories are sparse.
Issue #55 and PR #74 remain open and unmerged.

## Operating results

| Ticker | Elapsed | OpenAI cost | Result |
| --- | ---: | ---: | --- |
| AAPL | 1,763 ms | $0 | Valid partial |
| AMC | 9,210 ms | $0.015160 | Valid partial |
| NCPL | 2,352 ms | $0 | Valid partial |
| NXL | 1,744 ms | $0 | Valid partial |
| SMCI | 1,788 ms | $0 | Valid partial |

Average latency was 3,371.4 ms and maximum latency was 9,210 ms. Total measured
OpenAI cost was $0.015160. Alpha Vantage used exactly 10 requests; Twelve Data
was not configured and used zero. All five market operations completed, while
news discovery remained Limited after Alpha Vantage quota responses. No retry,
Deep run, hosted search, difficult-budget escalation, or extra ticker was used.

## Recall comparison

Batch 1 was 57/86 (66.28%), Batch 2 was 71/86 (82.56%), and Batch 3 was 83/86
(96.51%). Batch 3 reached 100% in every measured category except reverse splits
(2/3, 66.67%) and free cash flow (3/5, 60%). Recall alone therefore exceeded the
overall target, but the category and severe-miss gates did not pass.

## Severe-blocker status

- **NCPL:** fixed for the baseline. The actual Item 4.02 event was retrieved and
  affected financial scores stayed Limited/Unscored.
- **SMCI material weakness and flows:** fixed. The warning surfaced, and recent
  OCF/FCF deterioration still controlled the scores.
- **SMCI split/shares:** fixed. The forward split normalized correctly and the
  valid shares series reports 2.7% growth rather than 1035.3% dilution.
- **AMC split:** unresolved. The completed 1-for-10 split remains omitted.
- **AAPL:** new severe false positive. Clean-control audit language was labeled
  as a confirmed material weakness.
- **NXL:** new severe temporal error. A split effective August 28 was classified
  completed on August 27.
- **SMCI listing:** unresolved/new false positive. A bank covenant requiring
  continuous Nasdaq listing was labeled an active exchange warning.

## Scores, explanations, and settlement

Frozen score ranges passed 30/57 (52.63%), versus 21/57 (36.84%) in Batch 2.
No score formula or answer key was changed. Explanation fidelity passed for 1/5
tickers and settlement accuracy for 2/5 because the false confirmed warnings and
future-action classification are not honest settlement.

## Remaining sampling and next step

Completed reverse splits, active listing deficiencies, going concern, foreign
issuers/ADRs/IFRS, and OTC/delisted securities remain sparse or unproven. First
fix the reproduced AAPL warning-context, AMC older-split retrieval, NXL effective
date, and SMCI listing-context defects with deterministic regressions. After
that, the smallest previously proposed expansion remains BIOR, MULN, NIO, and
TUPBQ (at most four Fast runs, eight optional-provider operations, and $0.12
OpenAI). That expansion is not authorized.

## Corrective-work status (post-measurement)

The measured 96.51% result above is unchanged. Offline regressions now fix the
four reproduced mechanisms without another live run:

- effective-control audit language is a negative control, while explicit SMCI-
  style ineffective-control/material-weakness language remains detected;
- bounded historical SEC submissions retrieval supplies an older authoritative
  AMC-style Item 5.03 split filing when it has rolled out of the current block;
- future-effective NXL-style actions remain `scheduled` before the effective
  cutoff and become `completed` only afterward; and
- a financing covenant requiring continued listing is informational, while an
  actual Nasdaq deficiency notice remains active evidence.

The two Batch 3 FCF misses were reproduced. Both have OCF but no aligned SEC
capex fact for the same cadence, so they remain Limited/Unscored. No secondary
value or unsupported taxonomy proxy was introduced. This corrective status is
not a fourth batch and does not prove the remaining sparse categories.
