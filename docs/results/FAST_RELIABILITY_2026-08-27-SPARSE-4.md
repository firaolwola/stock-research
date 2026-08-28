# Issue #55 sparse verification 4 — 2026-08-27

Sparse-4 ran BIOR, MULN, NIO, and TUPBQ exactly once against the unchanged
Sparse-1 answer key. It used normal-budget Fast only, no hosted search, no Deep,
and no retries. All prior artifact hashes were verified before execution.

## Result

| Measure | Sparse-1 | Sparse-2 | Sparse-3 | Sparse-4 |
| --- | ---: | ---: | ---: | ---: |
| Material checks | 3/16 (18.75%) | 13/16 (81.25%) | 14/16 (87.5%) | 14/16 (87.5%) |
| Valid reports | 4/4 | 1/4 | 4/4 | 4/4 |
| Score/state checks | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) |
| Explanation fidelity | 0/4 | 0/4 | 0/4 | 1/4 |
| Settlement accuracy | 0/4 | 4/4 | 4/4 | 4/4 |

BIOR retained both completed split ratios with correct effective dates, lineage,
and current OTC Pink/delisted state, but undated duplicate occurrences survived.
MULN exposed 1-for-25 and 1-for-9 text but did not associate the required May 4
and August 11, 2023 dates; the December 21, 2023 1-for-100 action remained absent
and an unsupported 1-for-60 occurrence appeared. NIO retained its correct ADR,
foreign-filer, CNY, cadence, and revenue treatment, but attributable annual net
loss remained unknown and the unmatched Company Facts concept metadata was not
preserved in the artifact. TUPBQ passed its lineage, Chapter 11, going-concern,
terminal OTC Expert Market status, historical-listing wording, validation, and
safe Limited-score checks.

## Category recall

- issuer/security/listing: 4/4 (100%);
- completed reverse-split history: 1/2 (50%);
- active or terminal listing pressure: 2/2 (100%);
- going concern: 1/1 (100%);
- foreign issuer/ADR/IFRS: 3/4 (75%);
- OTC or delisted: 2/2 (100%); and
- capital structure/financing: 2/2 (100%).

## Operations

- elapsed time: 1,995–6,748 ms; average 3,643.5 ms;
- measured OpenAI cost: $0.011590 of $0.12 approved;
- Alpha Vantage: 8/8 approved attempts, all provider-quota Limited;
- Twelve Data: unconfigured, 0 requests;
- combined optional-provider attempts: 8/16;
- hosted web search and Deep: zero; and
- all four reports settled partial within the 20-second ceiling.

## Gate

Issue #55 and PR #74 remain open. Overall and affected category recall remain
below target, explanation fidelity is only 1/4, score/state checks remain 7/18,
and severe misleading split and foreign-financial misses remain. The next step
is offline correction of undated split reconciliation and capture of rejected
Company Facts concept metadata. Another same-four run or independent expansion
requires separate owner approval.
