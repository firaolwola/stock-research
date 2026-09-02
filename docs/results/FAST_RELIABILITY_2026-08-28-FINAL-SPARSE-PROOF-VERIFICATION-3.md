# Issue #55 final sparse-proof verification 3 — 2026-08-28

The approved confirmation ran exactly once for ONFO and once for STN. There
were no retries, Deep runs, hosted searches, difficult-budget escalation, or
bound violations. Both reports were valid partial reports.

## Adjudication

- ONFO passed identity, direct-share security, active Rule 5550(b)(1), resolved
  Rule 5550(a)(2), and the completed 2026-08-10 1-for-50 split checks without
  cross-rule closure.
- STN passed identity, Canadian foreign-private-issuer status, 40-F/6-K,
  IFRS/IASB, CAD, direct common shares, NYSE, and TSX. The linked audited
  annual exhibit supplied the reporting properties; incidental ADS/U.S.-GAAP
  text did not override them.

Overall material-claim recall was 7/7 (100%), valid-report rate 2/2,
explanation fidelity 2/2, settlement accuracy 2/2, and score/state safety 2/2.
There were zero severe misleading misses.

## Operations

Aggregate elapsed time was 3,760 ms; the maximum ticker time was 2,382 ms.
OpenAI cost was $0 because synthesis was blocked at the normal cost ceiling.
Alpha Vantage used 4 requests, Twelve Data used 0, and combined optional-provider
attempts were 4. All approved bounds passed.

The prior Final Sparse Proof, Verification 1, and Verification 2 artifacts
remain unchanged. This verification is recorded separately under
`evaluation/live/2026-08-28-final-sparse-proof-verification-3/`. The two-case
confirmation passed, but Issue #55 still requires a broader reliability and
sample-size decision; no automatic merge or issue closure follows from this
small confirmation.
