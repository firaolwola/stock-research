# Issue #55 final sparse-proof verification — 2026-08-28

ONFO and STN ran exactly once with no retry, Deep request, hosted search, extra
ticker, or difficult-budget escalation. Both reports validated, but the batch
failed at 4/7 bundled material claims (57.14%) with two severe interpretation
defects.

ONFO's internal rule lifecycle is correct: Rule 5550(a)(2) is resolved, its older
events are historical, Rule 5550(b)(1) remains active, and the August 10 1-for-50
split remains a completed action rather than compliance proof. The user-facing
active equity item still repeats the complete mixed-rule paragraph, however, so
resolved bid language remains inside a current warning. An unrelated document
mention also falsely promoted `security_structure` to `ads` despite the confirmed
common-stock identity.

STN correctly promoted Canada, foreign-private-issuer status, 40-F/6-K regime,
CAD, CIK 0001131383, and NYSE. Broad whole-document phrase scans then matched
incidental U.S.-GAAP and ADS language instead of the issuer-level audited IFRS and
direct-share descriptions. The report therefore mislabeled the accounting basis
as U.S. GAAP and failed to settle direct shares plus TSX.

Both failures require offline context binding: accounting framework must bind to
the audited statement-basis declaration; security structure must bind to the
issuer security description; and mixed compliance findings must project
rule-specific explanations rather than duplicate their entire source paragraph.

Operations stayed within every limit: 3,401 ms aggregate, $0 OpenAI, four Alpha
Vantage requests, zero Twelve Data requests, and four combined optional-provider
attempts. The original Final Sparse Proof 1 4/7 result remains unchanged. Issue
#55 stays open and PR #74 is not ready to merge. No further live run is authorized.
