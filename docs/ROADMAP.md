# Roadmap

**Last reviewed:** 2026-08-27

This roadmap records outcomes, dependencies, and milestone progress rather than
fixed delivery dates. GitHub Issues are the executable backlog. `PRODUCT.md` is
the running product-vision source of truth.

## Current state

### Current #55 closure status (2026-09-02)

The bounded practical-small milestone is operationally complete under the
owner-accepted scope: 14 unique quality-reviewed claims are supported, with
zero current severe misses and safe unresolved FCF settlement. Broad
statistical reliability remains explicitly unproven because historical cohorts
are not safely poolable. The closure artifact reports these as separate
outcomes; numeric FCF coverage is informational, not a closure requirement.
The active follow-up is `55-OPERATIONAL-CLOSE` in `docs/ISSUE_PLAN.md`, which
covers metadata alignment and the final authenticated merge/close workflow.

The application has a strong deterministic foundation: a versioned report
contract, semantic validation, claim-linked sources, distinct evidence states,
deterministic score calculation, a responsive dashboard, token-free mock mode,
and isolated tests.

Production Fast has evolved substantially. It now retrieves SEC identity,
submissions, Company Facts, and a bounded selection of filing documents before
optional tool-disabled synthesis. It streams valid partial reports and preserves
deterministic evidence when retrieval or synthesis fails. One free SWVL
structural run completed six SEC requests and produced a valid report quickly,
but this does not establish real-ticker recall or trustworthy score coverage.

The current implementation has the approved Fast architecture but failed its
first bounded real-ticker reliability calibration on 2026-08-27:

- current Fast evidence normally leaves important scores unresolved;
- current-news and market context now have a bounded free-tier path, but
  coverage and free-quota limits still require evaluation;
- deterministic identity and financial semantics now fail closed on unsupported,
  stale, partial, conflicting, or mismatched evidence, but real-ticker coverage
  still requires calibration;
- scoring methodology 2.1.0 now adds six independent SEC-only financial trend
  components to the seven Fast constructs; 2.0.0 and 1.0.0 remain documented
  historical comparison baselines; and
- the initial AAPL/AMC/NCPL/NXL/SMCI live batch achieved 57/86 adjudicated
  material checks (66.28%), below the 95% overall target;
- severe misses exposed Company Facts duration conflicts, incomplete
  non-reliance/reverse-split extraction, unnormalized shares across corporate
  actions, and stale annual cash-flow scores that contradicted current periods;
  and
- the batch stayed within time, Alpha Vantage, and approved cost bounds, but
  operating compliance does not compensate for failed research quality.

Comparison therefore moves behind a new Fast reliability milestone. Public
deployment remains outside the current personal-tool priority.

## Approved operating and quality targets

- Complete Fast pipeline ceiling: 20 seconds.
- Ideal normal Fast cost: approximately $0.01–$0.03.
- Normal Fast maximum: approximately $0.03.
- Difficult-ticker ceiling: approximately $0.05.
- Overall material-risk recall: approximately 95% or better.
- Adequately sampled critical-category recall: approximately 90% or better.
- Severe misleading misses: none unresolved at milestone completion.
- Numeric scores: emitted only with sufficient trustworthy evidence.
- First-result latency: measured for usability, not a milestone acceptance gate.

Fast stops when either its time or cost ceiling is reached. Unfinished work
settles as `Unscored` or `Limited` rather than continuing open ended.

## Current milestone: Fast reliability

Goal: make the seven priority Fast score components trustworthy enough to guide
the owner's reject-or-continue research decision without producing an automatic
verdict.

### Ordered implementation dependencies

1. [x] **Complete:** [#48 — Evaluate and approve the bounded Fast source strategy](https://github.com/firaolwola/stock-research/issues/48).
2. [x] **Complete:** [#49 — Enforce end-to-end Fast time and cost budgets](https://github.com/firaolwola/stock-research/issues/49).
3. [x] **Complete:** [#50 — Correct Fast identity and financial evidence semantics](https://github.com/firaolwola/stock-research/issues/50).
4. [x] **Complete:** [#51 — Implement the approved bounded news and market-context strategy](https://github.com/firaolwola/stock-research/issues/51). The approved free-first stack uses SEC, Nasdaq Trader, original-source promotion, and an interchangeable Alpha Vantage/Twelve Data Basic discovery/EOD layer.
5. [x] **Complete:** [#52 — Redesign and version Fast scoring methodology](https://github.com/firaolwola/stock-research/issues/52). Methodology 2.0.0 replaces misleading proxies, defines score-specific evidence gates, and keeps long-term quality Deep-only.
6. [x] **Complete:** [#53 — Add progressive Fast score cards and approved dashboard hierarchy](https://github.com/firaolwola/stock-research/issues/53), including the owner-approved post-#53 refinement to one compact score summary, honest financial charts, and a separate explanation block.
   The subsequent methodology 2.1.0 refinement makes all six displayed financial
   trends independently scoreable from SEC evidence only.
7. [x] **Complete:** [#54 — Make Deep build and extend the Fast evidence packet](https://github.com/firaolwola/stock-research/issues/54). Direct Deep now builds a validated identity-gated Fast foundation; recent Fast results are reused, stale source classes are refreshed, and conflicts retain evidence lineage.
8. [ ] **Active — bounded operational close preparation:** [#55 — Calibrate evidence-first Fast reliability on real tickers](https://github.com/firaolwola/stock-research/issues/55). The accepted practical-small scope has 14 unique quality-reviewed claims with 14 supported, zero current severe misses, and safe unresolved FCF settlement. Broad statistical reliability remains explicitly unproven because historical cohorts are not safely poolable. NIO attributable annual net loss remains `unavailable_authoritative_evidence`, not a system miss. The next work item is `55-OPERATIONAL-CLOSE` in `docs/ISSUE_PLAN.md`: align metadata, then perform the authenticated PR #74 merge and Issue #55 close with this qualification preserved. No additional sparse expansion is authorized by the current scope decision.

### Issue #55 corrective roadmap

1. [x] **Direction and baseline:** preserve all frozen calibration measurements,
   classify the recurring parser failures, and adopt automated targeted
   adversarial/property testing plus targeted evidence-binding redesign. No
   historical result or answer key changes.
2. [x] **Complete — minimum automated feedback loop:** formalized 12 high-value
   SEC-derived fixtures, 12–20 named invariants, deterministic seeds, reviewed
   distractor injection, semantic-preserving transformations, machine-readable
   output, and a concise offline command. The runner must require zero network,
   provider, or OpenAI access.
3. [x] **Complete — targeted evidence-binding correction:** introduced property-specific
   typed candidates with issuer/security, accession/form, section or block,
   source span, authority, date role, lifecycle, rule ID, and contextual
   qualifiers where applicable. Correct accounting-basis, security-structure,
   mixed-rule compliance, and other recurring binding failures without replacing
   the working retrieval, evidence-record, budget, or report architecture.
4. [x] **Complete — generalization proof:** ran untouched category holdouts and
   mutation combinations that were not copied from production parser rules.
   Report invariant results by family, canonical precision/recall,
   cross-property contamination, false promotion, false suppression, and the
   corresponding sample sizes.
5. [x] **Complete — offline Issue #55 completion gate:** reproduced known severe bug
   class, catch intentionally reintroduced historical defects, retain correct
   Limited/withheld outcomes, pass the complete existing test suite, and pass the
   deterministic adversarial suite within a practical CI runtime. An offline pass
   does not authorize live work, merge PR #74, or close Issue #55.
6. [x] **Complete — evidence-based scope decision:** the minimum suite produced
   actionable failures and is sufficient for this correction. No broad mutation
   framework, second parser, filing archive, or LLM-dependent test system is
   justified. The approved ONFO/STN confirmation is complete; its STN
   false-suppression miss made the next dependency an offline Form 40-F
   reporting-property binding correction, not another blind live rerun. That
   correction is now implemented and covered by a captured 40-F exhibit shape;
   fresh live confirmation remains separately gated.
7. [x] **Complete — targeted AMC/NCPL confirmation:** NCPL's Item 4.02
   correction passed one live case; AMC's historical split remains a live
   retrieval/filing-selection miss. No retries or additional tickers were run.
   Issue #55 stays active pending the smallest offline AMC correction and a
   separately approved confirmation.
8. [x] **Complete — AMC delayed-clause correction:** widened the bounded local
   split span to capture delayed ratio/effective wording without crossing the
   next action. Offline regression passes; a fresh AMC-only live confirmation
   remains separately gated.
9. [x] **Complete — AMC effective-date lifecycle correction:** retained a
   lifecycle proof when an explicit past effective date safely settles a
   completed action. Offline regression passes; the latest live result remains
   the unchanged partial baseline and any further AMC confirmation is gated.
10. [x] **Complete — reproduce remaining AMC live date-role gap:** the approved
   confirmation extracted `1-for-10` / `2023-08-24` but withheld it as
   `unknown_date_role`; the exact normalized relationship shape is now covered
   by an offline regression. No live result or historical measurement changed.
11. [x] **Complete — AMC effective-date relationship correction:** accepted the
   bounded “effective date of which was …” live-shaped grammar with the same
   lifecycle/date binding safeguards. Offline regression passes; another live
   confirmation remains separately gated.
12. [x] **Complete — AMC direct effective-date correction:** accepted bounded
   `effective date of DATE` / `effective date thereof` forms after the second
   live confirmation still showed `unknown_date_role`. Offline regression
   passes; another live confirmation remains separately gated.
13. [x] **Complete — record AMC confirmation 4:** the one approved run remained
   valid and safely Limited but still missed the completed split. The result is
   frozen; no retry was made and the offline direct-form correction is now the
   next gated step.

[#56 — Retire or isolate obsolete hosted-search Fast code](https://github.com/firaolwola/stock-research/issues/56)
remains optional technical cleanup when it will not conflict with milestone work.

Issue #55 remains active. The approved second five-ticker batch improved recall
from 66.28% to 82.56% but did not pass. The reproduced overbroad non-reliance,
AMC/SMCI split retrieval, omitted material-weakness, restored-compliance, and
Limited-series defects now have deterministic regression fixes on PR #74.
The approved Sparse-3 verification also ran and failed. Recall improved from
81.25% to 87.5%, validity improved from 25% to 100%, and settlement stayed 4/4,
but critical retrieval/normalization and explanation defects remained. The
reproduced Sparse-3 shapes received offline regression coverage, but Sparse-4
showed that undated corroborating split occurrences still evaded reconciliation
and that rejected NIO Company Facts metadata was not retained. Sparse-5 cleared
the BIOR reconciliation blocker and made the NIO limitation observable, but
MULN's latest live extraction still failed and NIO remains unavailable under the
exact semantic gate. Both mechanisms now have deterministic offline disposition:
the Verification-4 replay retains nine supported dated MULN actions without its
two severe false events, while NIO remains Limited after explicit candidate
adjudication. Verification-5 confirmed recall but exposed one remaining duplicate
wrong-date action. Verification-6 showed that an overlapping live extraction span
could still invoke the retrospective-history fallback and recreate it. The
captured-shape correction resolves the conflict before canonical acceptance, and
Verification-7 confirmed the nine-event live history without the August 1
duplicate. The sparse-expansion verification reached 17/20 but exposed the
remaining ZAPPF filing-selection/interpretation and GMBL security-settlement
defects. Verification-2 resolved those four defects live and reached 20/20, but
exposed NT-form reason/recency fidelity defects, now corrected offline. The final
ONFO/STN sparse-proof pair then ran within every bound but failed: ONFO needed
current-vs-historical listing-state reconciliation and STN needed authoritative
foreign-filer/accounting-basis promotion. Simplified stored-shape regressions
then passed, but the final verification still measured 4/7: incidental ADS and
U.S.-GAAP language contaminated security/accounting properties, and a mixed-rule
paragraph contaminated ONFO's otherwise correct rule-scoped explanation. The
approved ONFO/STN confirmation then ran exactly once per ticker within all
bounds: ONFO passed its targeted listing/split checks, while STN retained
identity and 40-F/6-K/CAD context but failed to bind supported IFRS/IASB and
direct-common-share/TSX properties. The result was 5/7 targeted claims, 2/2
valid reports, and one severe false-suppression miss. No further live work was
authorized by that approval. The offline correction now inspects a bounded set
of SEC-hosted 99.x exhibits linked from annual 20-F/40-F filings, including the
STN audited exhibit, and has deterministic regression coverage. The fresh
confirmation then passed both ONFO and STN with 7/7 targeted claims and zero
severe misses. The next dependency is independent sample-size/reliability
review; no further live run is authorized automatically. A paid data
subscription remains neither selected nor required and would need separate
owner approval.

### Milestone acceptance criteria

- Current security and issuer identity do not mix evidence across securities.
- Seven priority Fast scores are attempted independently and shown only when
  their evidence thresholds are satisfied.
- Progressive cards distinguish `Researching`, scored, `Unscored`, and `Limited`
  without provisional numbers.
- Material claims and score explanations remain traceable to dated evidence.
- Source discovery does not become sole evidence for a material score.
- The complete pipeline terminates at the earlier of 20 seconds or its cost
  ceiling.
- Overall and category recall gates pass with sample sizes and uncertainty
  disclosed.
- Misses identify retrieval, interpretation, or unavailable-evidence causes.
- Explanations match the evidence and relative scoring is directionally sensible.
- No known severe milestone-blocking miss remains unresolved.
- Deep reuses Fast and prioritizes unresolved work, including when invoked
  directly.

## Next milestone: compare researched candidates

Goal: compare several screener-identified tickers by stable,
decision-relevant component differences rather than full reports side by side.

- [#16 — Compare tickers by decision-relevant differences](https://github.com/firaolwola/stock-research/issues/16)

Issue #16 remains planned but is blocked by successful Fast reliability
calibration. Comparison must preserve score direction, methodology version,
evidence references, security context, and unresolved states.

## Later personal-workflow milestone

Goal: preserve research context and show what materially changed.

- [#17 — Add local saved report history](https://github.com/firaolwola/stock-research/issues/17)
- [#18 — Add report refresh and material change detection](https://github.com/firaolwola/stock-research/issues/18)

Consider watchlists and Markdown or PDF export only when demonstrated workflow
evidence supports them.

## Public-readiness milestone

Public access remains optional and requires a separate owner decision after
research quality is reliable.

- [#10 — Add rate limiting and deployment safeguards](https://github.com/firaolwola/stock-research/issues/10)

Do not expose the application publicly before authentication, privacy, budget,
logging, rollback, and deployment safeguards are approved and implemented.

## Completed foundation

- Structured stock-report schema and semantic validation (#1, #2).
- Claim-linked source quality and evidence states (#3, #5).
- Ticker/configuration boundaries and isolated tests (#6, #7).
- Provider timeout/error handling for the prior hosted workflow (#9).
- Issuer-lineage representation and fixtures (#11).
- Catalyst, financial, score, and evaluation scaffolding (#8, #12–#15).
- Fast dashboard and token-free mock mode (#4, #22, #24).
- Provider-schema, output-bound, timeout, parallel-domain, evidence-first,
  diagnostic, and bounded filing-extraction work delivered through PRs #38–#46.
- Provider-neutral Fast source responsibility, end-to-end budgets, corrected
  deterministic identity/financial semantics, and the approved free-first
  bounded news/market implementation (#48–#51).
- Versioned Fast scoring methodology 2.0.0 with realistic evidence gates and a
  preserved 1.0.0 historical baseline (#52).
- Progressive accessible Fast scoring and the refined decision-first dashboard
  hierarchy: unified summary, financial charts, then explanations (#53 and its
  owner-approved UX follow-up).
- Validated Fast-to-Deep handoff, source-aware snapshot freshness, unresolved-first
  Deep planning, duplicate-retrieval telemetry, and conflict lineage (#54).

These completed items are foundations and historical implementation results;
they do not by themselves satisfy the current Fast reliability milestone.
