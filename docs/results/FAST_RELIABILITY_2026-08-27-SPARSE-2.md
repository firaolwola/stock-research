# Issue #55 sparse-category verification 2 — 2026-08-27

The owner-approved repeat ran BIOR, MULN, NIO, and TUPBQ exactly once from the
separately frozen plan. It made no retries, Deep requests, hosted searches, or
difficult-budget escalation. Sparse-1 and all earlier artifacts remained
unchanged.

## Result

| Measure | Sparse-1 | Sparse-2 |
| --- | ---: | ---: |
| Material checks | 3/16 (18.75%) | 13/16 (81.25%) |
| Valid reports | 4/4 | 1/4 |
| Score/state checks | 7/18 (38.89%) | 7/18 (38.89%) |
| Explanation fidelity | 0/4 | 0/4 |
| Settlement accuracy | 0/4 | 4/4 |

Retrieval and terminal settlement improved substantially, but the batch failed.
BIOR found both completed splits and financing. MULN resolved to BINI and found
recent splits, financing, and listing pressure, but omitted the required 2023
split history and retained stale listing semantics. NIO no longer produced the
false material weakness and aligned its 2022–2025 CNY revenue series, but still
missed comparable annual net loss. TUPBQ found Chapter 11 and going concern, but
the seeded delisting filing returned 404.

BIOR and MULN failed claim/source and lineage semantic validation. MULN also
failed confirmed security semantics and historical-item lineage checks. TUPBQ
failed schema validation because deterministic assembly used `accounting` as a
catalyst classification. Only NIO produced a valid report. These are severe
application blockers even where underlying evidence was retrieved.

## Operations

- elapsed time: 2,846–7,925 ms; average 4,540.25 ms;
- measured OpenAI cost: $0.011011 of $0.12 approved;
- Alpha Vantage: 8/8 approved requests;
- Twelve Data: unconfigured, 0 requests;
- combined optional-provider attempts: 8/16; and
- all reports settled partial without Pending/in-progress workflow state.

Alpha market calls completed. News calls returned provider quota and remained
Limited, as allowed. Optional-provider behavior did not erase SEC evidence.

## Gate

Issue #55 and PR #74 remain open. Overall recall is below 95%, multiple category
rates are below 90%, three reports are invalid, explanation fidelity is 0%, and
severe blockers remain. No new expansion batch should run yet. The next step is
offline deterministic correction of the stored Sparse-2 shapes, followed by a
separately approved same-four verification. Sparse sampling remains inadequate
even after those cases pass.
