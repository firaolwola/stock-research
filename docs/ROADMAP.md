# Roadmap

**Last reviewed:** 2026-08-25

This roadmap records outcomes, ordering, and milestone progress rather than fixed
delivery dates. GitHub Issues are the executable backlog.

## Current state

The end-to-end ticker search now requests and validates the versioned structured
stock-report contract before returning a complete or safe partial report. The
browser now renders a responsive fast dashboard with ranked material findings,
distinct score groups, visible evidence states and coverage, every report
section, and safe claim-linked sources. Structured material claims require dated, typed,
bidirectionally linked sources with primary-source preference and explicit
conflict handling. Evidence states now distinguish bounded absence searches,
unavailable evidence, security-specific inapplicability, and named coverage gaps
without converting unknowns into favorable scores. Current security context and
confirmed prior ticker/name lineage now carry dated material issuer history
forward with sourced linkage confidence; unresolved predecessors cannot be used
as confirmed history. A dated representative evaluation set now spans the
capitalization bands, nonstandard securities, issuer lineage, core risk
categories, catalysts, uncertainty, and deterministic failures. Its token-free
dry run reports category and overall recall with source, support, latency, cost,
and clarity measures. Scoring calibration, broader automated tests, live
latency-budget measurement, and production safeguards remain incomplete.
Fast-stage requests now terminate after a defined
timeout and map major provider failures to controlled responses. A token-free
mock mode supports repeatable manual frontend and integration checks.

The product is currently a personal post-screening due-diligence tool. Public
deployment is not a current milestone.

## Operating targets

- Normal fast report: approximately 3–10 seconds.
- Normal completed-report API cost: near or below $0.10.
- Material claims: sourced or explicitly `Unknown`.
- Material-risk recall: approximately 95% or better overall on the dated
  evaluation set, with results also reported by risk category.
- Risk posture: prefer a ranked warning or uncertainty over false reassurance.

These are evaluation targets, not claims about current behavior.

## Current milestone: trustworthy fast reports

Goal: produce a compact, evidence-backed report that can be used repeatedly
after an external screener identifies a moving or news-relevant ticker.

### Priority order

1. [#12 — Add catalyst strength and historical-reaction assessment](https://github.com/firaolwola/stock-research/issues/12)
2. [#13 — Add decision-focused financial health context](https://github.com/firaolwola/stock-research/issues/13)
3. [#14 — Calibrate component scores and near-term setup assessment](https://github.com/firaolwola/stock-research/issues/14)
4. [#15 — Meet fast-report latency and cost budgets](https://github.com/firaolwola/stock-research/issues/15)

Issues with satisfied dependencies may be reordered when implementation evidence
supports it, but dependency changes must remain explicit in the affected issues.

### Milestone acceptance criteria

- Security type, issuer, listing status, and coverage limits are explicit.
- Reliably linked ticker and name changes carry material issuer history forward.
- Material claims and score explanations are traceable to inspectable sources.
- Primary sources are preferred; secondary evidence is labeled and lower
  confidence.
- Historical severity, future likelihood, and potential impact remain distinct.
- Near-term setup quality remains separate from longer-term company quality.
- Unknown evidence never silently becomes a favorable conclusion.
- The fast dashboard ranks important red flags without hiding partial coverage.
- Category-level evaluation identifies material-risk recall gaps.
- Latency and cost measurements are reported alongside coverage and recall.

## Next milestone: compare researched candidates

Goal: compare multiple screener-identified tickers by their most
decision-relevant differences rather than reading full reports side by side.

- [#16 — Compare tickers by decision-relevant differences](https://github.com/firaolwola/stock-research/issues/16)

Comparison must preserve score definitions, time horizons, evidence references,
security-type context, and unknown states.

## Later personal-workflow milestone

Goal: preserve research context and show what materially changed.

- [#17 — Add local saved report history](https://github.com/firaolwola/stock-research/issues/17)
- [#18 — Add report refresh and material change detection](https://github.com/firaolwola/stock-research/issues/18)
- Improve accessibility and responsive behavior based on observed use.
- Consider watchlists and Markdown or PDF export only when they support a
  demonstrated workflow.

## Public-readiness milestone

Public access remains optional and requires an explicit owner decision after
research quality is reliable.

- [#10 — Add rate limiting and deployment safeguards](https://github.com/firaolwola/stock-research/issues/10)
- Define authentication, privacy, budget monitoring, logging, and rollback.
- Do not expose the application publicly before the safeguards and approval
  boundaries in `AGENTS.md` are satisfied.

## Broader research direction

After the trustworthy-report foundation, expand coverage in bounded issues for:

- warrants, convertibles, and deeper capital-structure analysis;
- management behavior and insider activity;
- valuation metrics and dividend history;
- historical price and market-cap behavior; and
- deeper financial and accounting analysis.

Create these tickets only when their outcome, evidence standard, dependencies,
and place in the fast or deep stage are clear.

## Completed

- [x] [#8 — Create a representative ticker evaluation set](https://github.com/firaolwola/stock-research/issues/8).
- [x] [#4 — Render the fast decision dashboard](https://github.com/firaolwola/stock-research/issues/4).
- [x] [#11 — Resolve issuer identity and prior ticker/name lineage](https://github.com/firaolwola/stock-research/issues/11).
- [x] [#5 — Handle unknown, unavailable, incomplete, and inapplicable evidence](https://github.com/firaolwola/stock-research/issues/5).
- [x] [#3 — Attach dated, typed sources to material claims](https://github.com/firaolwola/stock-research/issues/3).
- [x] [#9 — Add request timeouts and upstream API error handling](https://github.com/firaolwola/stock-research/issues/9).
- [x] [#1 — Define the structured stock-report schema](https://github.com/firaolwola/stock-research/issues/1).
- [x] [#2 — Return validated structured research from the server](https://github.com/firaolwola/stock-research/issues/2).
- [x] [#6 — Add ticker validation and startup configuration checks](https://github.com/firaolwola/stock-research/issues/6).
- [x] [#7 — Create the isolated backend test foundation](https://github.com/firaolwola/stock-research/issues/7).
- [x] [#22 — Add a manual mock/demo testing mode](https://github.com/firaolwola/stock-research/issues/22).
- [x] [#24 — Run manual mock mode on port 3001](https://github.com/firaolwola/stock-research/issues/24).
- [x] Create the initial Express server and static frontend.
- [x] Connect the server to the OpenAI Responses API with web search.
- [x] Confirm the end-to-end ticker search works locally.
- [x] Establish repository product, roadmap, decision, and agent documentation.
- [x] Establish GitHub Issues as the executable backlog.
- [x] Record the owner-approved product vision, quality targets, and workflow
      priorities.
