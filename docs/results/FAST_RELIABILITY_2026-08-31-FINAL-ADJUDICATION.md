# Issue #55 final milestone adjudication (2026-08-31)

## Decision

Issue #55 remains open and PR #74 is not ready to merge. This review uses only
the frozen calibration artifacts and the separately recorded targeted
confirmations; it makes no live requests and does not rewrite any historical
answer key or measured result.

The implementation now has deterministic protections for the severe parser
mechanisms found during calibration, and the latest targeted confirmations
show those fixes working for the covered shapes. That is not sufficient to
claim the reliability milestone: the frozen FCF category remains below its
gate, the refreshed offline audit found one AMC filing-table binding gap,
score-range calibration was weak in the last full same-five run, and the
different batches do not share one defensible pooled denominator.

## Results reviewed

| Frozen or targeted record | Result | Use in the gate |
| --- | ---: | --- |
| Batch 1 (AAPL/AMC/NCPL/NXL/SMCI) | 57/86 (66.28%) | Historical baseline; failed |
| Batch 2 (same five) | 71/86 (82.56%) | Historical comparison; failed |
| Batch 3 (same five) | 83/86 (96.51%) | Recall-only pass; reverse split 2/3, FCF 3/5, four severe misses |
| Final same-five confirmation | 82/86 (95.35%) | Descriptive confirmation; two severe misses and FCF 3/5 remained in the frozen denominator |
| Sparse-1 through Sparse-5 | 3/16 → 14/16 (18.75% → 87.5%) | Historical sparse progression; not pooled |
| Sparse Expansion Verification-2 (REKR/ZAPPF/GMBL) | 20/20 (100%) | Independent cohort; valid reports 3/3, zero severe misses |
| Final Sparse Proof Verification-3 (ONFO/STN) | 7/7 (100%) | Independent cohort; valid reports 2/2, zero severe misses |
| AMC verbose-ratio confirmation 8 | 1/1 targeted | Exact completed 1-for-10 and no false ratio |
| AMC/NXL FCF remeasurement | AMC capex table candidate withheld for missing currency context; NXL no candidate | Correct Limited/Unscored; AMC binding gap remains; does not change frozen 3/5 |
| MSFT/RIVN FCF remeasurement 2 | 2/2 aligned SEC OCF/capex pairs | Correct positive and negative FCF derivation; does not rewrite frozen 3/5 |
| Offline reverse-split adjudication (five independent cases) | 15/15 canonical events, 100% precision | Practical category audit pass; historical denominators unchanged |

The same-five batches overlap and use a richer 86-check rubric than the sparse
cohorts. They therefore must not be concatenated into a single claimed overall
recall. The 20/20 and 7/7 cohorts are useful independent confirmations, not a
replacement denominator for the core calibration.

## Gate review

| Requirement | Finding | Status |
| --- | --- | --- |
| Overall material-risk recall ≈95%+ | Batch 3 was 96.51% and the final same-five descriptive run was 95.35%, but no single pooled denominator is defensible | Not established as a milestone result |
| Every adequately sampled critical category ≈90%+ | Frozen FCF is 3/5 (60%); all five cases settle safely Limited/Unscored, but the refreshed audit identifies an AMC filing-table binding gap. The separate reverse-split audit is 15/15 | Safety settlement passes; coverage-limited acceptance remains open and numeric FCF coverage is unproven |
| No unresolved severe misleading miss | AMC, NCPL, AAPL, NXL, SMCI, ONFO, and STN mechanisms were corrected or confirmed in targeted follow-up; historical misses remain frozen for audit | No currently known unresolved covered-shape blocker |
| Explanations accurately reflect evidence | Latest targeted cohorts passed, but Batch 3 was 1/5 and final same-five was 3/5; Sparse Expansion Verification-2 was 2/3 | Not demonstrated broadly |
| Scores within owner-reviewed ranges | Frozen Batch 3 score-range result was 30/57 (52.63%); current offline 2.1.0 matrix is 2/2, but it is not a live reliability denominator | Historical fail; current matrix passes |
| Relative-risk ordering | No complete, non-overlapping adjudication supports a milestone claim | Unproven |
| Time/cost ceilings | Approved runs stayed within their declared limits; no paid OpenAI request was needed for the latest checks | Pass |
| Sparse categories honestly reported | Practical counts are shown below; three-case categories remain small and are not called statistically reliable | Pass |

## Category and sample-size review

| Category | Practical independent positive cases | Latest evidence | Status |
| --- | ---: | --- | --- |
| Completed reverse splits | 5 | Five-case offline audit is 15/15 canonical events with no false completed events | Practical minimum met; audit passes, still small |
| Active listing deficiency | 3 | ONFO, REKR, and the existing core cases are covered | Practical minimum met; still small |
| Going concern / bankruptcy | 4 | Independent sparse cohorts passed their covered claims | Practical minimum met; still small |
| Foreign issuer / ADR / IFRS | 3 | ZAPPF, NIO, and STN coverage; STN passed after correction | Practical minimum met; still small |
| OTC / delisted | 5 | Sparse Expansion Verification-2 covered REKR/ZAPPF/GMBL; prior cases retained | Practical minimum met |
| Free cash flow trend | Frozen 5 expected, 3 detected (60%); current strict audit 2/5; independent MSFT/RIVN controls 2/2 | AMC has a captured table withheld for currency context; NCPL is accounting-invalidated; NXL has no captured candidate. All settle Limited/Unscored without favorable inference. | **Safe settlement passes; coverage-limited acceptance remains open; numeric coverage unproven** |

Three practical cases are a milestone minimum for the sparse listing and
foreign/IFRS categories, not broad statistical reliability. No category should
be described as generally reliable from these small samples alone.

## NIO unavailable-authoritative-evidence treatment

NIO's attributable annual net-loss case is excluded from system-miss counts.
Bounded authoritative retrieval completed, no safe attributable annual
Company Facts concept was available, and no implemented table fallback could
settle it safely. The correct result is
`unavailable_authoritative_evidence` / Limited / Unscored. This is a coverage
limitation, not a parser success or a favorable financial conclusion.

## Severe-miss disposition

The frozen records retain their original severe findings: AMC historical split
omission, NCPL non-reliance retrieval, AAPL effective-control false positive,
NXL future-action timing, SMCI listing-covenant false warning, and the earlier
ONFO/STN binding defects. Offline regressions and the approved confirmations
resolved those mechanisms for their stored/live shapes. The records remain
unchanged so the historical failure trail is auditable. No new unresolved
severe miss is known in the latest targeted evidence, but this does not waive
the FCF and broader calibration gates.

## Required next step

Keep #55 and PR #74 open. The owner-approved coverage-limited policy accepts
safe Limited/Unscored FCF settlements only when no bounded parser/binding gap
remains. The refreshed audit preserves the frozen 3/5 and numeric 2/5
measurements, but identifies an AMC 10-K capex table withheld for missing
currency context. Correct that bounded gap offline before treating the
coverage-limited acceptance gate as passed. Do not claim an overall reliability
pass, merge PR #74, or close #55 until the non-overlapping recall and broad
score/explanation/denominator evidence are defensibly satisfied. Any future
FCF evidence expansion must use the zero-token SEC preflight.

No live run is authorized by this adjudication.
