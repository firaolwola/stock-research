# Roadmap

**Last reviewed:** 2026-08-27

This roadmap records outcomes, dependencies, and milestone progress rather than
fixed delivery dates. GitHub Issues are the executable backlog. `PRODUCT.md` is
the running product-vision source of truth.

## Current state

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
8. [ ] **Active — await owner approval for post-Sparse-5 verification:** [#55 — Calibrate evidence-first Fast reliability on real tickers](https://github.com/firaolwola/stock-research/issues/55). Batch 3 reached 83/86 material checks (96.51%). Sparse-5 remained at 14/16 (87.5%) with 4/4 valid reports and 4/4 safe settlement. Offline regressions now correct the reproduced MULN live shape and expose packet-only occurrence diagnostics. NIO remains correctly Limited because none of its captured Company Facts candidates is semantically equivalent to attributable ordinary-shareholder loss; no unsafe alias or table fallback was added. No additional live run or expansion is authorized.

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
MULN's live extraction still failed and NIO remains unavailable under the exact
semantic gate. Both mechanisms now have deterministic offline disposition: the
MULN live-shaped regression yields the three dated 2023 actions without orphan
events, while NIO remains Limited after explicit candidate adjudication. The next
active step is owner review of whether another same-four verification is worth
the bounded cost; no new live run or expansion batch is authorized. A paid data
subscription remains neither selected nor required and would need separate owner
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
