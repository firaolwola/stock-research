# Issue #55 offline adversarial correction — 2026-08-28

## Outcome

The minimum offline feedback loop is implemented and passes. It uses 12 reviewed
cases, 20 named invariants, and three deterministic forms of each case, for 36
checks total. All 36 pass. The four untouched holdout cases contribute 12 checks;
all 12 pass. Cross-property contamination is zero in this corpus.

This is prospective parser protection, not a new live reliability measurement.
Final Sparse Proof Verification 1 remains frozen at 4/7. No network, provider, or
OpenAI call was used, and no live rerun is authorized.

## Corrections guided by the loop

- Accounting basis requires an explicit financial-statement-basis declaration.
- ADS or direct-share settlement requires a listed-security description.
- Equal-authority contradictory declarations settle conflicting/unknown.
- Mixed Nasdaq-rule findings receive rule-specific statements and claims before
  lifecycle reconciliation.
- Retrieved issuer-filed exhibits participate in reporting-property extraction.

Each candidate retains issuer/security identity, accession, form, filing date,
source span, authority, date role, lifecycle, property, and contextual qualifiers.

| Family | Passed | Total |
| --- | ---: | ---: |
| Accounting binding | 9 | 9 |
| Security binding | 15 | 15 |
| Compliance projection | 6 | 6 |
| Uncertainty/withholding | 6 | 6 |
| Holdout checks | 12 | 12 |

Corporate-action canonical precision/recall is not remeasured by this focused
corpus. The complete deterministic suite still exercises those frozen Issue #55
shapes and passed. The new command is `npm run evaluate:adversarial` and performs
no network setup.

The offline corrective gate passes: the adversarial command, 340-test complete
suite, report validation, dry evaluation, mock scenarios, and both startup paths
pass. A fresh bounded ONFO/STN live verification is technically justified, but it
requires separate owner approval. Issue #55 and PR #74 remain open.
