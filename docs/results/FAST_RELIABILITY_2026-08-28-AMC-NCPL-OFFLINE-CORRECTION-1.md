# Issue #55 AMC/NCPL targeted offline correction

Date: 2026-08-28  
Mode: deterministic fixtures and stored live-shaped evidence only

## Scope

This pass addressed the two severe misses in the fresh same-five confirmation:
AMC's completed reverse split and NCPL's Item 4.02/non-reliance event. No SEC,
market-provider, hosted-search, or paid OpenAI calls were made, and prior
calibration artifacts were not changed.

## Findings and fixes

| Case | Offline root cause | Correction | Regression |
| --- | --- | --- | --- |
| AMC | The stored live-shaped filing reached ratio extraction, but its effective date and lifecycle wording were not bound strongly enough for canonical promotion. | Bind explicit past effective dates, handle lifecycle wording separated from the ratio, and permit sentence punctuation while retaining alphanumeric/hyphen truncation protection; future dates remain non-completed. | Direct extraction and report-assembly fixtures assert one completed 1-for-10 event on 2023-08-24. |
| NCPL | The authoritative Item 4.02 used “prevent future reliance on affected previously issued financial statements,” which was not covered by the prior exact-phrase matcher. | Recognize that bounded Item 4.02 form, while retaining prospectus-boilerplate and control-warning negative controls; propagate the finding to Limited/Unscored affected financial inputs. | Live-shaped 0001493152-26-038853 fixture asserts a critical non-reliance warning and no OCF score. |

## Verification

- Focused SEC extraction and Issue #55 regression tests: pass (82 tests).
- `npm test`: pass (346 tests).
- `npm run validate:reports`: pass.
- `npm run evaluate:dry`: pass.
- `npm run evaluate:adversarial`: pass (36/36; 12/12 holdout).
- `git diff --check`: pass (line-ending warnings only).

This result is an offline correction, not a new live calibration measurement.
A fresh AMC/NCPL confirmation remains separately owner-approved work; Issue #55
stays open until its frozen reliability and severe-miss gates are met.
