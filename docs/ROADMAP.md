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
8. [ ] **Active — Batch 3 paused for provider-plan review:** [#55 — Calibrate evidence-first Fast reliability on real tickers](https://github.com/firaolwola/stock-research/issues/55). Two approved batches failed the recall and severe-miss gates; deterministic blockers have offline corrections. Batch 3 is frozen but must not run until the owner approves its provider order and request ceilings after the adapter change.

[#56 — Retire or isolate obsolete hosted-search Fast code](https://github.com/firaolwola/stock-research/issues/56)
remains optional technical cleanup when it will not conflict with milestone work.

Issue #55 remains active. The approved second five-ticker batch improved recall
from 66.28% to 82.56% but did not pass. The reproduced overbroad non-reliance,
AMC/SMCI split retrieval, omitted material-weakness, restored-compliance, and
Limited-series defects now have deterministic regression fixes on PR #74.
The next active step is owner review of the frozen Batch 3 provider plan. The
ticker set and paid budget were already approved, but the new fallback order
and per-provider request ceilings require explicit confirmation. A future approved
sparse-category batch can target completed
splits, listing/going-concern cases, a foreign ADR/20-F, and an OTC/delisted
security. A paid data
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
