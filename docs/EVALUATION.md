# Research evaluation set

**Last reviewed:** 2026-08-27

The versioned evaluation set in `evaluation/cases.json` measures whether fast reports surface material risks without prescribing a brittle full answer. Each scenario records why it matters, an explicit `as_of` cutoff, the evidence areas to investigate, and dated known facts that a report should find or handle with the stated uncertainty. Evidence published after the cutoff is invalid for that scenario.

## Coverage

The set includes large-, mid-, small-, and micro-cap issuers plus ADR, ETF, warrant, OTC/delisted, and invalid-identifier cases. Expectations cover security/listing context, issuer lineage, reverse splits, dilution and offerings, warrants/convertibles, dividends, compliance, going-concern/accounting concerns, financial context, strong and weak catalysts, and explicit uncertainty. `ACME` and `XYZ` are fixture-backed calibration cases; they do not describe real issuers.

The cases are evidence expectations, not investment recommendations. Time-sensitive scenarios must be reviewed and re-dated before a new benchmark is reported. Confirmed expectations include a source available on or before the scenario cutoff, with SEC filings, exchange notices, and issuer materials preferred.

## Rubric

- **Material-risk recall:** detected known material facts divided by expected
  known material facts. Fast reliability requires approximately 95% overall and
  approximately 90% in every adequately sampled critical category; these are
  targets, not claims about current performance.
- **Completeness:** expected evidence areas visibly addressed, including explicit unknown or inapplicable results.
- **Source quality and factual support:** primary-source share, source appropriateness, and whether each detected claim is supported.
- **Issuer lineage:** prior ticker/name history is carried forward only when linkage is evidenced.
- **Uncertainty:** expected `unknown`, `limited_coverage`, and `not_applicable` states are preserved.
- **Operations and clarity:** p50/p95 latency, token use, web-search calls,
  average/maximum estimated cost, budget status, and a reviewer clarity rating
  from 1 through 5 accompany coverage and recall results.
- **Score calibration:** deterministic expected state/value checks are reported
  overall and by material-risk category; unresolved expected inputs must remain
  null rather than pass by becoming favorable numbers.

Score calibration for the redesigned methodology does not require one exact
ground-truth number. Review whether material facts were found and interpreted
correctly, the short explanation matches the evidence, the score lies within an
owner-reviewed reasonable range, and clearly riskier cases generally score worse
than cleaner cases.

Syntax errors, timeouts, configuration failures, malformed upstream responses, and other deterministic application failures are app reliability results. They are reported separately and never counted as missed research facts. A successful report that omits an expected fact is a research-quality miss.

## Token-free dry run

```powershell
npm run evaluate:dry
npm test
```

The dry sample uses only `evaluation/samples/mock-results.json`. It makes no
OpenAI call. Its synthetic operating values exercise the budget logic; they are
not live performance claims. The current sample evaluates two fictional research
reports plus three deterministic invalid-input cases; it does not run the real
ticker scenarios through production evidence-first Fast. Review every scenario
and source date when changing the set. The validator rejects incomplete coverage
and post-cutoff evidence.

The dry evaluator uses the executable $0.03 normal Fast maximum. Its sample costs
are intentionally below that ceiling and do not authorize or predict a live paid
run. The $0.05 difficult ceiling remains an explicit per-run policy rather than
the evaluator's default.

## Fast reliability gate

Critical Fast categories are:

- current security and listing identity;
- reverse splits;
- dilution and offerings;
- warrants and convertibles;
- exchange compliance;
- going-concern and accounting warnings;
- financial context;
- catalysts and news; and
- uncertainty handling.

Deeper issuer lineage remains evaluated, but exhaustive predecessor research is
not subject to the same Fast category gate. Current issuer resolution and obvious
recent identity changes remain critical.

For every category, report detected and expected fact counts, recall, sample
size, important misses, and whether each miss arose from retrieval,
interpretation, or unavailable evidence. A sparse category must disclose its
uncertainty and gather more cases before being declared reliable.

The milestone does not pass when:

- overall recall is below approximately 95%;
- an adequately sampled critical category is below approximately 90%; or
- a known severe misleading miss remains unresolved.

Severe milestone-blocking misses include:

- wrong-issuer or wrong-security evidence;
- false or misattributed current catalyst or news;
- missed recent material dilution, offering, warrant, or convertible overhang;
- missed meaningful reverse-split history relevant to current risk;
- missed active exchange deficiency or delisting risk;
- missed going-concern, restatement, non-reliance, or major accounting warning;
- materially wrong cash, debt, runway, or freshness context that makes an issuer
  appear safer;
- missing or uncertain evidence converted into a favorable score; and
- a scoring or explanation error that materially reverses risk direction.

## Evidence-first Fast phase-one result

Token-free SEC fixtures verify architecture coverage, not real-ticker recall:

- security/listing identity and CIK: confirmed;
- former-name lineage with bounded SEC dates: confirmed when present;
- recent financing-form discovery: limited coverage;
- standardized cash and revenue facts: confirmed in the fixture;
- recent 8-K/6-K catalyst discovery: limited coverage; and
- reverse-split terms, warrants/convertibles, compliance text,
  going-concern/accounting language, dividends, and non-SEC news: unknown or
  limited coverage.

The bounded filing-text fixture now improves architecture coverage as follows:

- reverse-split ratios: explicit terms produce confirmed items;
- offerings: actual/agreed issuance is confirmed, while registration capacity
  remains limited coverage;
- warrants and convertibles: explicit instrument language produces confirmed
  items;
- going-concern, accounting/restatement, and listing-deficiency language:
  explicit statements produce confirmed warnings;
- current 8-K/6-K substance: a specific material-event sentence produces a
  confirmed current catalyst; and
- stale standardized financial periods: periods older than 180 days produce a
  sourced high-severity freshness warning.

These deterministic phrase fixtures improve category capability but do not
measure recall on the dated real-ticker cases. They do not establish the 95%
recall target. The existing dry evaluator
continues to measure its checked-in report samples. A future approved dated
evaluation must measure the new retrieval path against real case facts.

The deterministic regression suite also preserves the severe shapes discovered
in the 2026-08-27 Issue #55 batch: same-end quarter/YTD Company Facts, AMC-style
completed reverse splits and issuance growth, NCPL-style non-reliance
invalidation, and SMCI-style material weaknesses, recent cash-flow deterioration,
and forward-split share normalization. These tests correct known mechanisms but
do not replace a separately approved live batch or prove recall targets.

The approved same-five-ticker repeat on 2026-08-27 improved recall from 66.28%
to 82.56% but still failed the milestone. Current-flow precedence and the worst
split-as-dilution wording improved, while live evidence exposed overbroad
non-reliance matching, persistent corporate-action selection gaps, an omitted
SMCI material weakness, and an invalid Limited shares series. The independent
result is in `docs/results/FAST_RELIABILITY_2026-08-27-BATCH-2.md`. The same-five
Batch 3 plan was subsequently approved and frozen. The owner then approved the
Alpha Vantage-first/Twelve Data-fallback policy with at most 10 requests per
provider and 20 optional-provider attempts combined. Prior artifacts and the
independent answer key remain unchanged.

Batch 3 completed all five bounded runs and improved recall to 83/86 (96.51%),
with five valid reports. It did not pass the milestone: reverse-split and FCF
category recall remained below 90%; AAPL control language, AMC split history,
NXL split timing, and SMCI listing context produced severe misses; and required
sparse categories remain unproven. The independent result is recorded in
`docs/results/FAST_RELIABILITY_2026-08-27-BATCH-3.md`.

Post-Batch-3 offline regressions now cover the four reproduced severe mechanisms:
positive-control language no longer becomes a weakness; historical submissions
can supply AMC's authoritative completed split; NXL-style future-effective
actions remain scheduled until their cutoff passes; and financing/listing
covenants do not become active exchange deficiencies. True SMCI weakness and
active Nasdaq-notice controls remain detected. These corrections do not change
the measured Batch 3 result and are not another calibration run. AMC/NXL FCF
remains honestly Limited because the stored evidence has no aligned capex fact.

The post-Batch-2 corrective branch now reproduces those mechanisms offline. It
uses dedicated bounded filing slots for Item 4.02, Item 5.03, compliance, and
control disclosures; requires event-specific non-reliance language; separates
resolved exchange history from active deficiencies; clears scoreable
observations when a share series is Limited by an unresolved split; and accepts
additional SEC revenue taxonomy aliases without merging incompatible periods.
The score-range diagnostic at
`evaluation/diagnostics/fast-score-ranges-2026-08-27-batch-2.json` preserves the
measured reports and records every failed owner range with normalized inputs,
periods, sources, formula components, confidence, and a cause classification.
These are regression fixes, not new calibration measurements; 82.56% remains
the latest measured recall and another live batch still requires owner approval.

## Paid live evaluation boundary

A paid evaluation must never run automatically or as part of routine tests. It
requires explicit owner approval for that run. Before requesting approval,
record the date, model/configuration, exact case IDs (at most five), maximum
budget, and output location. After an approved run, record input/output tokens,
web-search calls, estimated cost, per-case latency, app failures, and the full
rubric results. The evaluator rejects missing approval or measurement fields.
Redact credentials and do not commit sensitive provider payloads.
