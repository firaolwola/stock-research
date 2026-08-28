# Issue #55 sparse verification 5 — 2026-08-27

Sparse-5 ran BIOR, MULN, NIO, and TUPBQ exactly once against the unchanged
answer keys. It used normal-budget Fast only, no hosted search, no Deep, and no
retries. All prior artifact hashes were verified before execution.

## Result

| Measure | Sparse-1 | Sparse-2 | Sparse-3 | Sparse-4 | Sparse-5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Material checks | 3/16 (18.75%) | 13/16 (81.25%) | 14/16 (87.5%) | 14/16 (87.5%) | 14/16 (87.5%) |
| Valid reports | 4/4 | 1/4 | 4/4 | 4/4 | 4/4 |
| Score/state checks | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) | 7/18 (38.89%) |
| Explanation fidelity | 0/4 | 0/4 | 0/4 | 1/4 | 3/4 |
| Settlement accuracy | 0/4 | 4/4 | 4/4 | 4/4 | 4/4 |

BIOR passed: its two completed reverse splits are distinct canonical events with
effective dates, corroborating filings no longer create duplicate events, and
lineage/current OTC status remain correct. TUPBQ also passed lineage, Chapter 11,
going concern, current OTC Expert Market status, historical-listing wording,
validation, and safe Limited settlement.

MULN failed. The live filing shape still did not yield the required May 4,
August 11, and December 21, 2023 canonical actions. It emitted numerous undated
or incorrect occurrences, including false 1-for-1 and 1-for-2 events. Current
BINI/OTCID status was correctly separated from historical MULN/Nasdaq context,
but the corporate-action history remains a severe misleading miss.

NIO retained correct ADR/foreign-filer identity and a comparable annual CNY
revenue series for 2022–2025. Net income/loss remained Limited. The new bounded
diagnostic proves why: live Company Facts supplied total, noncontrolling-interest,
or comprehensive-income concepts, but none safely established annual net loss
attributable to NIO ordinary shareholders. No taxonomy rule was broadened and no
unsafe value entered scoring.

## Category recall

- issuer/security/listing: 4/4 (100%);
- completed reverse-split history: 1/2 (50%);
- active or terminal listing pressure: 2/2 (100%);
- going concern: 1/1 (100%);
- foreign issuer/ADR/IFRS: 3/4 (75%);
- OTC or delisted: 2/2 (100%); and
- capital structure/financing: 2/2 (100%).

## Operations

- elapsed time: 1,542–7,677 ms; average 3,790.75 ms;
- measured OpenAI cost: $0.014712 of $0.12 approved;
- Alpha Vantage: 8/8 approved attempts, all provider-quota Limited;
- Twelve Data: unconfigured, 0 requests;
- combined optional-provider attempts: 8/16;
- hosted web search and Deep: zero; and
- all four reports settled partial within the 20-second ceiling.

## Gate

Issue #55 and PR #74 remain open. Overall recall is 87.5%, affected categories
remain below 90%, score/state checks remain 7/18, and two severe misses remain.
The BIOR blocker cleared and explanation fidelity improved to 3/4, but MULN
requires another offline live-shape normalization fix. NIO now has an exact
unavailable-evidence diagnosis; accepting a broader concept would require
evidence or an explicit owner-approved baseline/methodology decision. No further
live or expansion batch is authorized.
