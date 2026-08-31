# Issue #55 milestone review (2026-08-31)

## Decision

Issue #55 does not yet meet the defensible close gate. PR #74 is not ready to
merge. The latest AMC confirmation resolves the known verbose-ratio blocker,
but it does not replace any frozen batch denominator or prove the remaining
category gates.

## Frozen measurements

| Artifact | Result | Interpretation |
| --- | ---: | --- |
| Batch 1 | 57/86 (66.28%) | Failed overall recall and severe-miss gate |
| Batch 2 | 71/86 (82.56%) | Improved, still failed |
| Batch 3 | 83/86 (96.51%) | Recall-only pass; severe/category gates remained open |
| Final same-five confirmation | 82/86 (95.35%) | 5/5 valid and safe settlement, but FCF was 3/5 and historical AMC/NCPL misses remained in this frozen run |
| Sparse-1 through Sparse-5 | 3/16 → 14/16 (18.75% → 87.5%) | Improved but did not meet the gate before independent expansion |
| Sparse Expansion Verification-2 | 20/20 | No severe misses; explanation fidelity 2/3 |
| Final Sparse Proof Verification-3 | 7/7 | No severe misses; explanation and settlement 2/2 |
| AMC verbose-ratio confirmation 8 | 1/1 targeted | Exact `1-for-10`; false `550000000-for-10` absent |

The batches use different denominators and overlapping tickers, so they must not
be arithmetically pooled into a fabricated single recall number. Frozen results
remain unchanged.

## Category and sampling review

| Category | Current practical positive cases | Status |
| --- | ---: | --- |
| Completed reverse splits | 5 | Practical minimum met; AMC targeted blocker now resolved |
| Active listing deficiency | 3 | Practical minimum met, but still a small sample |
| Going concern / bankruptcy | 4 | Practical minimum met, still not broad statistical proof |
| Foreign issuer / ADR / IFRS | 3 | Practical minimum met, still a small sample |
| OTC / delisted | 5 | Practical minimum met |
| Free cash flow trend | 5 expected, 3 detected (60%) in the frozen same-five confirmation | Fails the approximately 90% category gate |

NIO's attributable annual net-loss case is excluded from system-miss counts
prospectively. Bounded authoritative retrieval completed, no safe equivalent
Company Facts concept was available, and the implementation correctly settled
`unavailable_authoritative_evidence` / Limited rather than guessing.

## Severe-miss review

The previously observed AMC reverse-split and NCPL non-reliance mechanisms have
targeted live confirmations after offline correction. ONFO/STN also passed the
final targeted confirmation. No new severe false event appeared in the latest
AMC run. However, the original frozen same-five measurement is not rewritten or
retroactively re-scored, and the remaining FCF recall gap is unresolved for the
milestone gate.

## Required next step

Investigate and correct the remaining SEC-authoritative FCF comparability and
retrieval gap offline, then propose any required bounded live remeasurement under
the zero-token SEC preflight. Do not close #55 or merge PR #74 until a reviewed
aggregate adjudication has a single defensible denominator, FCF meets the
category gate, and no severe misleading miss remains unresolved.
