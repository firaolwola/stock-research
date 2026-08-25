# Research evaluation set

**Last reviewed:** 2026-08-25

The versioned evaluation set in `evaluation/cases.json` measures whether fast reports surface material risks without prescribing a brittle full answer. Each scenario records why it matters, an explicit `as_of` cutoff, the evidence areas to investigate, and dated known facts that a report should find or handle with the stated uncertainty. Evidence published after the cutoff is invalid for that scenario.

## Coverage

The set includes large-, mid-, small-, and micro-cap issuers plus ADR, ETF, warrant, OTC/delisted, and invalid-identifier cases. Expectations cover security/listing context, issuer lineage, reverse splits, dilution and offerings, warrants/convertibles, dividends, compliance, going-concern/accounting concerns, financial context, strong and weak catalysts, and explicit uncertainty. `ACME` and `XYZ` are fixture-backed calibration cases; they do not describe real issuers.

The cases are evidence expectations, not investment recommendations. Time-sensitive scenarios must be reviewed and re-dated before a new benchmark is reported. Confirmed expectations include a source available on or before the scenario cutoff, with SEC filings, exchange notices, and issuer materials preferred.

## Rubric

- **Material-risk recall:** detected known material facts divided by expected known material facts, reported overall and for every evaluated risk category. The target is approximately 95%; it is not a claim about current performance.
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

Syntax errors, timeouts, configuration failures, malformed upstream responses, and other deterministic application failures are app reliability results. They are reported separately and never counted as missed research facts. A successful report that omits an expected fact is a research-quality miss.

## Token-free dry run

```powershell
npm run evaluate:dry
npm test
```

The dry sample uses only `evaluation/samples/mock-results.json`. It makes no
OpenAI call. Its synthetic operating values exercise the budget logic; they are
not live performance claims. Review every scenario and source date when changing
the set. The validator rejects incomplete coverage and post-cutoff evidence.

## Paid live evaluation boundary

A paid evaluation must never run automatically or as part of routine tests. It
requires explicit owner approval for that run. Before requesting approval,
record the date, model/configuration, exact case IDs (at most five), maximum
budget, and output location. After an approved run, record input/output tokens,
web-search calls, estimated cost, per-case latency, app failures, and the full
rubric results. The evaluator rejects missing approval or measurement fields.
Redact credentials and do not commit sensitive provider payloads.
