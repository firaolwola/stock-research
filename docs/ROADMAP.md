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

The current implementation is not yet the approved Fast product contract:

- current Fast evidence normally leaves important scores unresolved;
- current-news and market-context coverage is incomplete;
- deterministic identity and financial semantics now fail closed on unsupported,
  stale, partial, conflicting, or mismatched evidence, but real-ticker coverage
  still requires calibration;
- scoring methodology 1.0.0 is a provisional baseline rather than a trusted
  final philosophy; and
- checked-in evaluation results are synthetic calibration, not evidence-first
  Fast reliability results on real tickers.

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
4. [ ] **Next — blocked on owner provider approval:** [#51 — Implement the approved bounded news and market-context strategy](https://github.com/firaolwola/stock-research/issues/51). Provider selection, payment, scraping, integration, and new production dependencies require explicit owner approval.
5. [ ] **Queued — depends on #51:** [#52 — Redesign and version Fast scoring methodology](https://github.com/firaolwola/stock-research/issues/52).
6. [ ] **Queued — depends on #52:** [#53 — Add progressive Fast score cards and approved dashboard hierarchy](https://github.com/firaolwola/stock-research/issues/53).
7. [ ] **Queued — coordinates with #51 and #52:** [#54 — Make Deep build and extend the Fast evidence packet](https://github.com/firaolwola/stock-research/issues/54).
8. [ ] **Final reliability gate — blocked by #49–#54:** [#55 — Calibrate evidence-first Fast reliability on real tickers](https://github.com/firaolwola/stock-research/issues/55).

[#56 — Retire or isolate obsolete hosted-search Fast code](https://github.com/firaolwola/stock-research/issues/56)
is unblocked optional technical cleanup. It may proceed while #51 awaits provider
approval when doing so will not conflict with the milestone implementation.

No milestone implementation issue is currently active. The next implementation
priority is #51, and it is intentionally blocked until the owner explicitly
selects a named provider after licensing, derived-use, coverage, pricing,
attribution, and access evidence is sufficient. The provider-neutral source map
is approved in `FAST_SOURCE_STRATEGY.md`; #49's reusable controls and #50's
corrected evidence semantics are already implemented. If provider approval is
not yet available, #56 is optional technical cleanup rather than a substitute
for or silent expansion of #51.

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
- Provider-neutral Fast source responsibility, end-to-end budgets, and corrected
  deterministic identity/financial semantics (#48–#50).

These completed items are foundations and historical implementation results;
they do not by themselves satisfy the current Fast reliability milestone.
