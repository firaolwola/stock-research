# Issue #55 Sparse Expansion Verification-2 — 2026-08-28

The approved runner executed REKR, ZAPPF, and GMBL exactly once. It made no
retry, Deep request, hosted-search request, extra ticker run, or difficult-budget
escalation. Frozen baselines and Verification-1 artifacts were unchanged.

## Results

- material-risk recall: 20/20 (100%);
- valid reports: 3/3;
- explanation fidelity: 2/3;
- settlement and score/state safety: 3/3 each;
- completed corporate-action recall and precision: 100% each;
- identity success: 3/3; and
- severe misleading misses: zero.

All measured category-recall rows were 100%. REKR retained its passing 6/6
behavior. ZAPPF produced one canonical completed 1-for-20 event, retained its
authorization only as provenance, represented the NT 20-F, and emitted no false
non-reliance. GMBL settled as domestic common stock with exactly its 1-for-100
and 1-for-400 events. Missing or stale financial evidence remained Limited.

Explanation fidelity did not pass completely. ZAPPF's NT 20-F used a generic
fallback instead of preserving its filing-specific delay reason. The unbounded-age
NT selector also surfaced irrelevant 2019 and 2023 NT filings as current material
warnings for REKR and GMBL.

## Operations

- elapsed: REKR 2,159 ms; ZAPPF 1,679 ms; GMBL 6,501 ms;
- aggregate elapsed: 10,348 ms;
- OpenAI cost: $0 of $0.09;
- Alpha Vantage: 6 of 6 requests;
- Twelve Data: unconfigured, zero requests; and
- combined optional-provider attempts: 6 of 12.

All limits passed. Deterministic evidence consumed the normal cost reservation
before optional synthesis, so no OpenAI tokens were used and reports settled
safely partial.

## Gate and next step

The four Verification-1 defects are resolved live. Issue #55 remains open because
NT-form reason/recency explanation fidelity needs offline correction and active-
deficiency plus foreign/IFRS coverage remain only two independent positive cases
each. No further live run is authorized. PR #74 remains open and unmerged.
