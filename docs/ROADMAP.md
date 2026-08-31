# Roadmap

**Last reviewed:** 2026-08-31

This roadmap records outcomes, dependencies, and milestone progress rather than
fixed delivery dates. GitHub Issues are the executable backlog. `PRODUCT.md` is
the running product-vision source of truth.

## Current state

Issues #76, #77, and #78 are complete as bounded offline milestones. The active
implementation priority is now #81; the #55 reliability gate remains open and
PR #74 is not merge-ready.

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
8. [ ] **Active — final reliability/sample-size adjudication:** [#55 — Calibrate evidence-first Fast reliability on real tickers](https://github.com/firaolwola/stock-research/issues/55). The offline adversarial/property loop passes; AMC, NCPL, ONFO, and STN targeted corrections are confirmed for their covered shapes; and practical samples reach 5 completed splits, 3 active deficiencies, 4 going-concern/bankruptcy cases, 3 foreign/ADR/IFRS cases, and 5 OTC/delisted cases. The final review still cannot close the milestone: frozen same-five FCF remains 3/5 (60%), although the independent MSFT/RIVN remeasurement now passes clean positive/negative aligned SEC pairs; score-range calibration was 30/57 (52.63%) in Batch 3, and overlapping rubrics do not support a single pooled recall number. NIO attributable annual net loss remains `unavailable_authoritative_evidence`, not a system miss. The bounded SEC filing-table FCF coverage in #76 is complete; the active implementation dependency is now #77 (score/explanation calibration), followed by #78 (final adjudication); PR #74 remains not merge-ready. See `docs/results/FAST_RELIABILITY_2026-08-31-FINAL-ADJUDICATION.md`.
9. [x] **Complete — zero-token SEC connectivity gate:** [#75 — Add zero-token SEC connectivity preflight before live verification](https://github.com/firaolwola/stock-research/issues/75). All approved live-verification runners now perform one bounded SEC ticker-map check before constructing research clients. HTTP, timeout, and network-denial failures stop before Fast/provider/OpenAI work and report only safe diagnostics. This prerequisite is complete; any future Issue #55 FCF-focused live remeasurement must pass it, and no live batch is implied by this item.

### Next scoped priorities after the #55 review

1. [x] **Complete — [#76 — Restore bounded SEC filing-table coverage for Fast free cash flow](https://github.com/firaolwola/stock-research/issues/76).** Fast now inspects a bounded set of already-retrieved SEC 10-K/10-Q/20-F/40-F tables for explicit, unit- and period-aligned capex when Company Facts is incomplete. Accepted facts retain accession/date provenance; ambiguous, stale, conflicting, unsupported, or accounting-invalid inputs remain Limited/Unscored. No live run or paid provider was used.
2. [x] **Complete — [#77 — Calibrate Fast score ranges, explanations, and relative ordering](https://github.com/firaolwola/stock-research/issues/77).** A deterministic offline matrix now checks Methodology 2.1.0 score direction/ranges, evidence-linked explanations, honest unresolved states, and company-relative ordering without changing frozen #55 measurements.
3. [x] **Complete — [#78 — Complete final Issue #55 reliability adjudication and closure gate](https://github.com/firaolwola/stock-research/issues/78).** The reproducible frozen-artifact review keeps #55 open because FCF remains 3/5, pooled recall is not defensible, and the broad score/explanation gate is not established; NIO remains correctly classified as unavailable authoritative evidence.
4. [ ] **Active priority — [#81 — Resolve final Fast FCF reliability gate and non-overlapping denominator](https://github.com/firaolwola/stock-research/issues/81).** Reconcile the frozen FCF denominator with bounded filing-table evidence and prepare any further live remeasurement only under separate owner approval.

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
14. [x] **Complete — inspect AMC confirmation-4 span and correct date-first
   effective wording:** captured diagnostics showed the date preceding the
   written ratio with an explicit effective-date relationship that was not in
   the role grammar. A bounded date-first rule and HTML regression now cover
   this shape; the live result remains frozen and another confirmation still
   requires separate approval.
15. [x] **Complete — record AMC date-first confirmation 5 attempt:** the
   approved single run was blocked by environment `EACCES` on the SEC
   ticker-map request before retrieval. The safe partial report and diagnostics
   are frozen; the parser target remains unevaluated and any retry requires
   separate approval after network access is restored.
16. [x] **Complete — inspect AMC confirmation 6 and correct verbose SEC ratios:**
   SEC access succeeded, but the authoritative filing used “one share ... for
   every ten shares,” which was not recognized by the compact-ratio parser. A
   bounded verbose-ratio rule and regression now cover the shape; the live
   result remains frozen and another confirmation requires separate approval.

17. [x] **Complete — record AMC verbose-ratio confirmation 7:** SEC access and
    the expected `1-for-10` split succeeded, but the live report also promoted
    a severe false `550000000-for-10` completed event by joining an authorized
    share count to the later verbose ratio phrase. The result is frozen and
    remains a severe precision miss.
18. [x] **Complete — correct AMC verbose-ratio binding offline:** verbose
    share-for-every extraction now requires an explicit `ratio of` cue, so
    authorized-share counts cannot become split numerators. A deterministic
    regression covers the confirmation-7 filing shape. A fresh live check,
    if desired, still requires separate owner approval.
19. [x] **Complete — confirm AMC verbose-ratio correction live:** the approved
    one-run check produced exactly the expected completed 2023-08-24 `1-for-10`
    event and eliminated the false `550000000-for-10` event. The targeted live
    blocker is resolved; Issue #55 remains active for broader reliability and
    sample-size gates.
20. [x] **Complete — correct FCF period selection offline:** the frozen same-five
    confirmation remains unchanged at 3/5. FCF now selects the newest aligned
    SEC OCF/capex pair when independently selected facts have different latest
    durations (for example, quarterly OCF beside YTD capex), while preserving
    Limited/Unknown for missing or mismatched capex. The approved MSFT/RIVN
    remeasurement then confirmed clean positive/negative aligned pairs, while
    AMC/NXL remained unavailable-authoritative-evidence shapes. The resulting
    aggregate review is recorded in #78's dependency chain; no frozen result
    changed.

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
severe misses. The independent sample-size/reliability review is now recorded
in the #76 → #77 → #78 dependency chain; no further live run is authorized
automatically. A paid data
subscription remains neither selected nor required and would need separate
owner approval.

The final review now has an explicit offline-first dependency chain: #76 (FCF
evidence coverage), then #77 (score/explanation calibration), then #78 (final
adjudication). No additional live calibration is implied by creating these
issues; any paid or provider-backed run still requires a separate bounded owner
approval.

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
