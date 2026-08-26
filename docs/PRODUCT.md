# Product definition

**Last reviewed:** 2026-08-25

## Product statement

Stock Research is a personal, decision-focused stock research and due-diligence
tool. After an external screener identifies a moving or news-relevant ticker, it
helps the user rapidly assess the current catalyst, historical company risks,
and financial context before deciding whether the setup deserves deeper
consideration.

It provides evidence, uncertainty, and risk signals. It does not execute trades,
recommend entries or exits, provide personalized investment advice, or function
as a trading platform.

## Current product intent

The current priority is optimizing the tool for the owner's personal research
workflow. A public product may be considered only after research quality is
reliably demonstrated. Public access would additionally require authentication,
abuse prevention, privacy review, cost controls, and deployment safeguards.

## Primary workflow

1. A separate screener identifies a ticker with unusual volume, a rapid change
   in volume, a price move, or a possible catalyst.
2. The user enters the ticker in Stock Research.
3. The tool returns a fast, decision-focused view of material red flags,
   catalyst strength, company context, evidence quality, and unknowns.
4. The user rejects the setup or continues with deeper research.

Stock discovery and screening are outside this product. The product is a
post-screening due-diligence gate.

## Product principles

### Prefer risk recall over false reassurance

Missing a material risk is worse than displaying an additional warning or
`Unknown`. Warnings must still be ranked by materiality so critical findings are
not buried beneath minor concerns. Missing evidence must never be interpreted as
low risk or proof that an event did not occur.

### Keep distinct concepts separate

Do not compress unlike concepts into an opaque score. In particular:

- dilution history, likelihood of future dilution, and likely shareholder
  impact must remain visible as separate components;
- near-term catalyst or setup quality must remain separate from longer-term
  company quality and risk; and
- an optional roll-up score must preserve its component values, evidence, and
  explanation.

A weak company can have a strong short-term catalyst, and a strong company can
have an unfavorable near-term setup.

### Follow the issuer, not only the ticker

Material history should follow the underlying issuer across reliably linked
ticker changes, corporate-name changes, and rebrands. Reports should identify
previous names and tickers with effective dates and state the confidence and
evidence supporting each linkage. Uncertain identity relationships must not be
treated as confirmed.

### Make evidence inspectable

Every material factual claim must be traceable to evidence. Important claims
and scores should link directly to their sources or to numbered references in a
clearly organized source list.

### Optimize for fast decisions without hiding incompleteness

The first result should emphasize the most decision-relevant conclusions rather
than reproduce a long research memo. Deeper research may take longer, but the
interface must clearly show which checks are complete, limited, pending, or
unknown.

## Supported security universe

Nasdaq- and NYSE-listed common stocks are the reliability priority, regardless
of market capitalization. The product should support OTC securities, ADRs,
ETFs, warrants, preferred shares, foreign listings, and delisted tickers when
reliable evidence is available.

Every report should identify the security type, issuer, listing venue and
status, and coverage limitations. Sections that do not apply to a security type
should be `Not applicable`; sections with inadequate evidence should be
`Unknown` or `Limited coverage` rather than guessed.

## Report experience

### Fast decision view

Target first useful evidence in approximately 3–10 seconds and normal bounded
Fast completion in approximately 4–10 seconds. Present a compact dashboard containing:

- the most material red flags and unknowns, ranked by importance;
- dilution-risk components and reverse-split risk;
- financial-health and longer-term company-quality context;
- current catalyst strength and near-term setup assessment;
- evidence confidence and coverage status; and
- short explanations with inspectable source references.

The assessment may use probability-style language, but must avoid false
precision and must show the favorable evidence, unfavorable evidence, evidence
quality, and uncertainty behind it. It must not be presented as a personalized
trade recommendation.

Near-term setup quality describes the strength and limitations of evidence over
the next five trading days. It is not a predicted return or numeric probability.
Its catalyst, qualitative implication, and bounded historical-reaction inputs
remain visible and separate from multi-year company quality.

Fast research may defer detailed issuer-specific catalyst analogues and reaction
windows when they do not fit the normal budget. That gap must be visible as
limited or pending coverage, so the full-contract completion status remains
`partial` or `pending`; deliberate Deep research may expand it. Current
catalyst evidence and material-risk checks remain part of Fast.

Fast is evidence-first. The server retrieves SEC ticker/CIK associations,
submissions metadata, recent filing metadata, and standardized Company Facts
directly with fair-access caching, normalizes dated evidence records, and
renders validated deterministic progress before optional AI synthesis. Fast AI
uses no hosted tools and may only classify supplied evidence IDs. A synthesis
failure leaves deterministic evidence intact and marks synthesis unavailable.
Missing retrieval coverage remains Limited/Unknown and cannot produce favorable
evidence or scores. Deep retains broader hosted-web research.

### Deep research view

A deeper report may take longer or be explicitly requested. It should expand
the evidence, history, financial analysis, comparable prior catalysts, and
source detail without changing the meaning of the fast-view scores.
Deep remains the broader workflow for exhaustive lineage, detailed financial
history, secondary corroboration, catalyst analogues and reaction windows, and
conflict resolution.

## Research coverage direction

The complete product direction includes:

- dilution, offerings, warrants, convertibles, and capital-structure risk;
- reverse splits and issuer history;
- cash burn, revenue and profitability trends, free cash flow, debt, and
  going-concern warnings;
- exchange compliance, SEC and accounting issues;
- management behavior and insider activity;
- valuation metrics and dividend history;
- historical price and market-cap behavior;
- recent news and catalysts; and
- historical reactions to similar company news or catalysts.

These capabilities should be delivered in bounded, testable stages. Breadth
must not come at the expense of source traceability, risk recall, latency, or
clear uncertainty.

## Initial trustworthy-report scope

The initial dependable report should establish the shared foundation needed by
both fast and deep views:

1. Security and issuer identity, security type, listing status, and known prior
   names or tickers.
2. Reverse splits from at least the last five years, following reliably linked
   issuer identities.
3. Major offerings and other material dilution from at least the last three
   years, including relevant warrants or convertibles when found.
4. Current dividend status.
5. Major exchange-compliance, going-concern, SEC, or accounting warnings found
   within the defined search scope.
6. The most important recent catalyst and news items, with a clear as-of time
   and search window.
7. Separate risk and quality components with concise evidence-based
   explanations.
8. Dates and claim-linked sources for material conclusions.
9. Explicit `Confirmed`, `Not found`, `Unknown`, `Not applicable`, and
   `Limited coverage` states.

The exact time windows and score calibration must be versioned and documented
in the report contract rather than implied only by prompts.

## Source standard

Use sources in this order when available:

1. SEC filings and official exchange notices.
2. Official company investor-relations releases and filings.
3. Reputable original news reporting.
4. Secondary aggregators only when a stronger source is unavailable.

Secondary evidence must be labeled and carry lower confidence. A material claim
that cannot be reasonably verified must be `Unknown`.

Each source record should include document title, source type, publication or
filing date, direct URL, retrieval or verification time when useful, and the
claims it supports.

## Out of scope

- Personalized investment recommendations
- Entry, exit, position-sizing, or price-target instructions
- Automated trading or brokerage integration
- Initial stock discovery or screening
- Portfolio management
- Public accounts, billing, or team collaboration during the personal-tool phase

## Success criteria

The MVP is successful when:

- it is repeatedly useful during real trading sessions after screener alerts;
- useful Fast evidence begins rendering in approximately 3–10 seconds and the
  bounded evidence-first pipeline normally settles in approximately 4–10 seconds;
- normal API cost is kept near or below $0.10 per completed report, with
  deliberate exceptions for unusually complex research;
- every material conclusion has supporting evidence or is clearly marked
  `Unknown`;
- a dated representative evaluation set achieves approximately 95% or better
  recall of known material risks overall and reports recall by risk category;
- issuer-lineage cases do not appear to have a clean history merely because of a
  ticker or name change;
- invalid, unavailable, partial, and unsupported results are explained clearly;
- API errors do not break the page or expose sensitive details; and
- the workflow reduces several minutes of fragmented manual research to a report
  the user trusts and uses before deeper consideration.

## Follow-on workflow priority

After the trustworthy fast report:

1. Add decision-focused side-by-side ticker comparison.
2. Add saved report history.
3. Add automatic refresh and change detection.
4. Consider watchlists and export when they support demonstrated workflows.

Comparison should emphasize normalized, decision-relevant differences rather
than display complete reports beside one another.

## Open product questions

- Which checks most often require deliberate deep-stage expansion in approved
  live evaluation?
- What source-age and evidence-strength rules should produce `Limited coverage`
  versus `Unknown`?
- Should observed live results support changing the explicit deep-stage control
  or the normal fast budgets?
- When, if ever, has research quality become reliable enough to reconsider
  public access?
