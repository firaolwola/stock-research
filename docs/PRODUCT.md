# Product definition

**Last reviewed:** 2026-08-27

This document is the running source of truth for product vision, user workflow,
scope, and success criteria. Implementation mechanics belong in the technical
documents linked from the README; milestone ordering belongs in `ROADMAP.md`.

## Product statement

Stock Research is a personal, decision-focused stock research and due-diligence
tool. After an external screener identifies a moving or news-relevant ticker, it
helps the owner rapidly assess the current catalyst, material company risks, and
financial context before deciding whether the setup deserves deeper research.

It provides evidence, uncertainty, and separate risk or quality signals. It does
not execute trades, recommend entries or exits, provide a combined buy/sell or
reject/continue verdict, or function as a trading platform.

## Current product intent

The current priority is making Fast a trustworthy evidence-backed scoring report
for the owner's personal workflow. Comparison, saved history, and change
detection remain planned, but they depend on a stable Fast evidence and scoring
contract. Public access is not a current milestone.

## Primary workflow

1. A separate screener identifies a ticker with unusual volume, a price move, or
   a possible catalyst.
2. The user runs Fast.
3. Fast progressively gathers bounded evidence and displays each score only when
   its evidence threshold is satisfied.
4. The user scans one unified score summary, simple supported financial charts,
   separate explanations, prominent red flags, evidence quality, and unresolved
   work.
5. The user rejects the setup, continues manual review, or requests Deep.
6. Deep reuses Fast's evidence packet and expands unresolved or low-confidence
   components instead of restarting the same research.

Stock discovery and screening remain outside this product. The product is a
post-screening due-diligence gate, while the final combined judgment remains the
user's.

## Product principles

### Evidence quality precedes scoring

A numeric score is useful only when the material evidence beneath it is
trustworthy. Fast must prefer `Researching`, `Unscored`, `Unknown`, or `Limited`
over a weak number that looks more confident than its evidence. Missing or
uncertain evidence must never become a favorable score.

### Prefer risk recall over false reassurance

Missing a material risk is worse than displaying an additional ranked warning
or unresolved state. The most serious failures are those that could make a risky
ticker appear cleaner or safer than the available evidence supports.

### Keep distinct concepts separate

Do not compress unlike concepts into an opaque overall verdict. Historical
dilution severity, future dilution likelihood, potential dilution impact,
reverse-split risk, financial health, catalyst strength, and near-term setup
quality remain separate. Long-term company quality is primarily a Deep-stage
construct when Fast lacks sufficient evidence.

Risk cards and quality cards have intentionally different directions:

- more stars mean more risk for risk constructs; and
- more stars mean stronger quality for financial, catalyst, and setup constructs.

The card title and explanation must make the direction unmistakable.

### Follow the issuer without overclaiming lineage

Fast must resolve the current security and issuer correctly and capture obvious
recent name or ticker changes when reliable evidence is available. Exhaustive
predecessor and issuer-history reconstruction belongs primarily in Deep.
Uncertain identity relationships must not be treated as confirmed.

### Make evidence inspectable

Every material factual claim and score explanation must be traceable to dated
evidence. The top of Fast stays concise; detailed calculations, filings, source
excerpts, and scoring inputs remain available farther down or through expandable
details.

### Bound the work honestly

Fast stops when either its cost ceiling or overall elapsed-time ceiling is
reached. Remaining components settle as unresolved rather than continuing
open-ended research. The budget is a ceiling, not a spending target.

## Supported security universe

Nasdaq- and NYSE-listed common stocks are the reliability priority, regardless
of market capitalization. Other security types and listing states may be
supported when reliable evidence is available, but their limitations and
applicability must be explicit. Syntax acceptance never proves that a security
exists or is supported.

Every report should identify the current security, issuer, venue, listing state,
security type, and coverage limitations. Inapplicable sections use `Not
applicable`; inadequate evidence uses `Unknown` or `Limited` rather than a guess.

## Fast report contract

### Priority score components

Fast should normally attempt to produce trustworthy values for:

1. Historical dilution severity.
2. Future dilution likelihood.
3. Potential dilution impact.
4. Reverse-split risk.
5. Financial health.
6. Catalyst strength.
7. Near-term setup quality.

Long-term company quality may remain unscored more often and be expanded in
Deep. Deterministic methodology 2.0.0 is the current executable contract;
methodology 1.0.0 remains only a historical comparison baseline.

### Progressive score behavior

Each score card progresses independently:

- sufficient trustworthy evidence: show the real score;
- work still in progress: show `Researching`;
- completed pass with inadequate evidence: show `Unscored` or `Limited`.

Do not show provisional numeric scores that may change materially later.

The report contract keeps detailed scores on the existing 0–10 internal scale.
The Fast dashboard converts them to a 0–5 star presentation, allowing half-stars
where useful. A unified row summary keeps only metric names left-aligned and
stars or honest unresolved states right-aligned, without redundant visible
numeric star text. Descriptions, detailed 0–10 values, methodology, inputs,
explanations, and sources remain inspectable in a separate expandable block
below. Financial sub-metrics may reuse a direct methodology 2.0.0
component for display; metrics without a direct score remain Unscored.

Financial Health is the main financial explanation container. Revenue,
profitability, debt, free cash flow, cash, and cash burn appear as compact
supporting rows and charts rather than six repeated score explanations. Charts
use only source-linked observations with matching definitions, units,
currencies, and comparable period lengths. A single observation is labeled as
such and never presented as a trend.

### Dashboard order

On wide screens, identity, research status, and catalyst content form the left
column while the compact score summary occupies a right sidebar. Medium and
narrow screens stack those sections. After that responsive top region, the
preferred content order is:

1. Stock name and identity.
2. Research, budget, and completion status.
3. Current news and catalyst.
4. Unified score summary.
5. Financial metric charts, limited to trustworthy reported values.
6. Separate score and financial explanations.
7. Detailed research and evidence.
8. Source library and technical supporting detail.

### Source strategy

Fast is SEC-first for filing-based risks, but not SEC-only when another bounded
source is better for current news or market context.

The approved source-responsibility map and score-level evidence contracts are
maintained in `FAST_SOURCE_STRATEGY.md`. The implemented free-first stack uses
SEC and Nasdaq Trader as authoritative public sources and Alpha Vantage's free
tier for discovery and end-of-day market context. No paid subscription is
approved.

Use sources in this order when available:

1. SEC filings and official exchange notices.
2. Official company releases and original newswires.
3. Reputable original financial reporting.
4. Financial-news or research services as discovery and secondary evidence.
5. Broad search only in deliberate Deep research, not Fast.

Services such as Seeking Alpha, TipRanks, or search-based discovery may identify
what happened and where to look, but an AI-generated search summary or discovery
service must not be the sole evidence for a material score. A dedicated provider
may be considered only after evaluating speed, ticker coverage, API/feed
availability, reliability, attribution, cost, licensing, and integration effort.
Selecting, paying for, scraping, or integrating a provider requires explicit
owner approval.

### Operating limits

Fast stops at the earlier of:

- 20 seconds for the complete pipeline; or
- the applicable per-run cost ceiling.

The complete pipeline includes SEC retrieval, news/provider lookup,
market/price context, synthesis, scoring, and finalization. Normal runs should
finish earlier when possible.

Initial cost policy:

- ideal normal cost: approximately $0.01–$0.03;
- normal maximum: approximately $0.03; and
- difficult-ticker ceiling: approximately $0.05.

Fast should not routinely approach $0.10. That ceiling may be reconsidered only
after evidence shows that the additional spend consistently produces material
decision value.

## Deep research contract

Deep extends Fast. It uses the completed Fast evidence packet as authoritative
seed evidence, prioritizes unresolved score components, and expands broader
history, corroboration, non-SEC news, historical catalyst reactions, complex
financing, and issuer-lineage questions. A direct Deep request first builds the
necessary Fast packet automatically.

Deep may produce a broader comprehensive report, but it should not discard or
needlessly repeat completed Fast research. Deep remains deliberately requested
and separately budgeted.

## Reliability and success criteria

The Fast reliability milestone succeeds only when:

- overall material-risk recall is approximately 95% or better;
- every adequately sampled critical category reaches approximately 90% recall;
- sparse categories report sample size and uncertainty rather than a falsely
  precise percentage;
- important misses are classified as retrieval, interpretation, or unavailable
  evidence failures;
- material facts are interpreted correctly;
- score explanations accurately match their supporting evidence;
- scores fall within reasonable owner-reviewed ranges;
- clearly riskier cases generally score worse than cleaner cases;
- cost and elapsed-time ceilings are enforced end to end; and
- no known severe misleading miss remains unresolved.

Critical Fast categories are current identity/listing, reverse splits,
dilution/offerings, warrants/convertibles, exchange compliance,
going-concern/accounting warnings, financial context, catalysts/news, and
uncertainty handling.

Automatic milestone blockers include wrong-issuer evidence, a false or
misattributed catalyst, missed material financing or overhang, missed meaningful
reverse-split history, missed active listing deficiency, missed going-concern or
major accounting warnings, financial errors that make an issuer look safer,
uncertainty converted into a favorable score, or a material reversal of the
real risk direction.

Exact numeric agreement is not the objective. Trustworthy evidence, correct
interpretation, correct direction, useful explanations, and sensible relative
scoring are.

## Out of scope

- Personalized investment recommendations
- Automatic reject/continue, buy/sell, or combined score verdicts
- Entry, exit, position-sizing, or price-target instructions
- Automated trading or brokerage integration
- Initial stock discovery or screening
- Portfolio management
- Public accounts, billing, or team collaboration during the personal phase

## Follow-on workflow priority

After the Fast reliability milestone:

1. Add decision-focused side-by-side ticker comparison.
2. Add local saved report history.
3. Add automatic refresh and material change detection.
4. Consider watchlists and export only when demonstrated workflow evidence
   supports them.

Comparison is postponed, not canceled. It should compare stable, trustworthy
components rather than provisional scoring behavior.
