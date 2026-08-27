# Issue #55 sparse-category calibration — 2026-08-27

The owner-approved sparse batch ran BIOR, MULN, NIO, and TUPBQ exactly once. No retries, Deep runs, hosted search, or difficult-budget escalation occurred. All four outputs validated, but the batch failed the research-quality gate.

## Frozen independent baselines

- **BIOR:** Biora Therapeutics/Progenity lineage; completed 1-for-25 (2023) and 1-for-10 (2024) reverse splits; October 2024 issuance and warrants; completed actions must remain distinct from prospective risk.
- **MULN:** Mullen/Bollinger lineage; repeated completed splits (1-for-25, 1-for-9, and multiple 1-for-100 actions); listing pressure; financing and dilution risk.
- **NIO:** NIO Inc., Cayman foreign private issuer; NYSE ADS, one ADS per Class A ordinary share; 20-F/6-K and RMB/IFRS regime; rising annual revenue and widening annual net loss.
- **TUPBQ:** Tupperware Brands Corporation; former NYSE TUP security moved to OTC Expert Market as TUPBQ after Chapter 11; going-concern and late-reporting distress.

The plan remains immutable. A post-freeze primary-source consistency review found two current-status descriptions in it were stale: BIOR had been suspended/delisted to OTC in December 2024, and Mullen changed its name/ticker to Bollinger Innovations/BINI in July 2025. These corrections were not inferred from Fast. They are disclosed in the reviews rather than silently editing the answer key.

## Results

| Measure | Result |
| --- | ---: |
| Material checks | 3 / 16 (18.75%) |
| Valid reports | 4 / 4 (100%) |
| Score-range/state checks | 7 / 18 (38.89%) |
| Explanation fidelity | 0 / 4 |
| Settlement accuracy | 0 / 4 |
| Severe misleading misses | 5 classes |

Category results were 0/2 completed-split cases, 0/2 listing-pressure cases, 0/1 going-concern case, 3/4 foreign-filer checks, 0/2 OTC/delisted cases, and 0/2 capital-structure cases. These small samples still require explicit uncertainty; none is proven.

BIOR, MULN, and TUPBQ were absent from the SEC current ticker map. Fast stopped at identity resolution and returned schema-valid Pending reports with no evidence. Safe non-scoring worked, but terminal settlement did not: completed work remained labeled `Pending`, and the synthesis reason remained `in_progress`.

NIO resolved correctly as an NYSE ADR/ADS and exercised 20-F/6-K retrieval. Its comparable RMB annual revenue series was found, but annual net loss was not. More seriously, explicit language saying controls were effective was falsely labeled a confirmed high-severity material weakness. Its current financial summary also selected an old custom revenue fact through 2023 while its score series used comparable annual revenue through 2025.

## Operations

- Latency: BIOR 235 ms, MULN 6 ms, NIO 6,693 ms, TUPBQ 6 ms; all below 20 seconds.
- Measured OpenAI cost: $0.010853 of the approved $0.12.
- Alpha Vantage: 2 of 8 approved requests. NIO market context completed; news returned quota-limited.
- Twelve Data: not configured, 0 of 8 requests.
- Combined optional-provider attempts: 2 of 16.
- Hosted web search: 0.

Provider limits and failures did not erase SEC evidence. Only NIO reached optional sources because the other tickers did not pass identity resolution.

## Gate and minimum corrective work

Issue #55 and PR #74 remain open. Before another paid run:

1. resolve historical tickers and OTC/delisted securities through identity-gated CIK/lineage evidence when the current ticker map has no row;
2. settle completed unresolved-identity work as terminal Limited/Unavailable rather than Pending;
3. extend the effective-control negative control to foreign 20-F wording;
4. align Company Facts current summaries with the comparable series used by scoring and normalize foreign-filer net-income aliases; and
5. add offline regressions for all four live shapes.

The sparse categories remain inadequately demonstrated. No further live batch is authorized by this result.

## Offline corrective status

The measured batch and frozen answer key remain unchanged. Deterministic tests
now cover exact historical-ticker/CIK fallback for BIOR, MULN/BINI, and
TUP/TUPBQ; OTC/delisted and renamed identity states; multiple completed split
history; financing evidence after lineage; TUP Chapter 11, going concern, and
delisting; NIO positive-control language; compatible IFRS revenue and
profit/loss aliases; and final Limited settlement. The separate correction file
records the two stale frozen identity descriptions without rewriting history.

These fixes make the code ready for owner review, not for a reliability claim.
The 18.75% sparse recall, failed explanation/settlement measures, and category
uncertainty above remain the only measured result until another bounded batch is
explicitly approved.
