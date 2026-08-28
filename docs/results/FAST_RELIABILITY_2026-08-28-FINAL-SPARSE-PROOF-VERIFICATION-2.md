# Issue #55 final sparse-proof verification 2 — 2026-08-28

The approved confirmation ran exactly once for ONFO and once for STN. There were
no retries, Deep runs, hosted searches, difficult-budget escalation, or bound
violations. Both reports were valid and safe partial reports.

## Adjudication

- ONFO passed the targeted confirmation: identity and direct-share security were
  correct; Rule 5550(b)(1) remained active; Rule 5550(a)(2) was resolved without
  cross-rule closure; and the completed 2026-08-10 1-for-50 split remained a
  completed action.
- STN passed identity, Canada, foreign-private-issuer, 40-F/6-K, CAD, and NYSE
  context. Its selected live filing text produced no typed IFRS/IASB or
  direct-common-share/TSX candidate, so those supported properties remained
  unresolved. This is a deterministic interpretation/normalization failure, not
  unavailable authoritative evidence. No false ADS or U.S.-GAAP promotion occurred.

Overall material-claim recall was 5/7 (71.43%), valid-report rate 2/2,
explanation fidelity 1/2, settlement accuracy 1/2, and score/state safety 2/2.
There was one severe false-suppression miss (STN). The reliability gate therefore
remains failed and Issue #55 remains open.

## Operations

Aggregate elapsed time was 3,597 ms; the maximum ticker time was 2,456 ms. OpenAI
cost was $0 because synthesis was blocked at the normal cost ceiling. Alpha
Vantage used 4 requests, Twelve Data used 0, and combined optional-provider
attempts were 4. All approved bounds passed.

The prior Final Sparse Proof 1 and Verification 1 artifacts remain unchanged.
This verification is recorded separately under
`evaluation/live/2026-08-28-final-sparse-proof-verification-2/`. No further run is
authorized by this approval. The remaining work is offline correction of the live
Form 40-F reporting-property binding, followed by a new owner decision if live
confirmation is still necessary.
