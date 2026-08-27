# Issue #55 sparse verification 3 — 2026-08-27

Sparse-3 reran BIOR, MULN, NIO, and TUPBQ exactly once against the unchanged
Sparse-1 answer key. It used normal-budget Fast only, no hosted search, no Deep,
and no retries. Prior artifacts were hash-guarded and preserved.

## Result

| Measure | Sparse-1 | Sparse-2 | Sparse-3 |
| --- | ---: | ---: | ---: |
| Material checks | 3/16 (18.75%) | 13/16 (81.25%) | 14/16 (87.5%) |
| Valid reports | 4/4 | 1/4 | 4/4 |
| Score/state checks | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) |
| Explanation fidelity | 0/4 | 0/4 | 0/4 |
| Settlement accuracy | 0/4 | 4/4 | 4/4 |

BIOR retained the correct CIK, OTC lineage, both required split ratios, and
financing evidence, and its report validated. MULN correctly resolved current
BINI/OTCID state and validated, but the bounded selection still omitted its May,
August, and December 2023 completed splits. NIO retained its ADR/foreign-filer
identity and consistent 2022–2025 CNY revenue series but still did not normalize
the live attributable annual net-loss concept. TUPBQ retrieved accession
`000100865424000068`, retained Chapter 11 and going-concern evidence, represented
OTC Expert Market/delisted state, normalized its catalyst enum, and validated.

Split explanations remain unreliable even where recall passed: BIOR and MULN
contain duplicate/conflicting occurrences across filings, and some `event_date`
values are filing dates instead of disclosed corporate-action effective dates.
No score was forced through an unsatisfied evidence gate, and the NIO 9.6
revenue diagnostic remains a frozen-range issue rather than a Methodology 2.1.0
change.

## Operations

- elapsed time: 2,634–8,162 ms; average 5,282.5 ms;
- measured OpenAI cost: $0.027210 of $0.12 approved;
- Alpha Vantage: 8/8 approved attempts, all provider-quota Limited;
- Twelve Data: unconfigured, 0 requests;
- combined optional-provider attempts: 8/16;
- hosted web search and Deep: zero; and
- all four reports settled partial within the 20-second ceiling.

## Gate

Issue #55 and PR #74 remain open. Overall recall is below 95%; completed-split
and foreign-financial category recall remain below 90%; explanation fidelity and
score calibration fail; and severe misleading misses remain. The next step is
offline correction of the immutable Sparse-3 shapes. An independent expansion
batch is premature, and another live run requires separate owner approval.
