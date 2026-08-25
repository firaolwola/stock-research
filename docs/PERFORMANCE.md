# Fast-report stages and operating budgets

**Last reviewed:** 2026-08-25

## Stage policy

The default `fast` stage is one Responses API request with no automatic retry,
a 15-second provider timeout, and a 5,000-token output ceiling. Its normal
evaluation targets are 3–10 seconds end to end and approximately $0.10 or less.
The timeout is a failure boundary, not the latency target. Required evidence is
never discarded merely to meet a budget: unfinished work must produce a
`partial` or `pending` report with named coverage limitations.

The `deep` stage is requested deliberately with the **Deeper research** control
or `stage=deep`. It has a 60-second timeout and 10,000-token output ceiling and
does not claim the fast-stage time or cost targets. It expands named gaps but
does not guarantee completeness. The server never escalates automatically.

The provider contracts are stage-aware. Neither stage asks the provider to emit
the eight deterministic scores or their components; the server derives them
from evidence after the response. Fast mode limits evidence collections, keeps
only material claims and strongest sources, and defers historical catalyst
analogues/reaction windows with explicit limited coverage. Fast responses are
therefore `partial` or `pending` relative to the full v4 contract rather than
claiming false global completeness. Deep mode may include
up to three analogues and four reaction windows per analogue and uses larger—but
still bounded—claim, source, history, and warning collections.

The complete fixture is approximately 5,846 compact JSON tokens under the old
provider contract, including approximately 2,206 tokens of discarded provider
scores. Under the new contract it is approximately 3,449 tokens in Fast and
3,638 in Deep before the server restores scores. Real reports vary with evidence;
the expected normal ranges are roughly 3,000–4,500 Fast output tokens and
4,000–7,500 Deep output tokens. The existing 5,000/10,000 ceilings remain failure
bounds, not output targets.

## Per-report measurement

Successful API responses include an `operations` object outside the validated
research report. It records stage, end-to-end provider latency, input/output/
total tokens, counted web-search calls, estimated cost, pricing version, and
whether the fast targets were met. Missing provider usage produces unknown cost,
not zero. The dashboard displays these values next to the report's independent
coverage and completion states.

Cost is estimated from versioned model and tool-call rates in
`lib/research-budget.js`. The 2026-08-25 snapshot uses the configured `gpt-5.1`
rates and $0.01 per web-search call. Pricing must be checked against the
[official OpenAI pricing page](https://developers.openai.com/api/docs/pricing)
before interpreting a new paid run. Estimates may differ from invoices because
provider billing, cached/search-content tokens, or rates can change.

## Evaluation and current finding

`npm run evaluate:dry` reports p50 and p95 latency, average and maximum per-case
cost, input/output tokens, web-search calls, coverage, material-risk recall, and
score calibration together. The checked-in two-report calibration is entirely
synthetic and token-free: p50 4.2 seconds, p95 8.5 seconds, average $0.07375,
maximum $0.08, 22,000 input tokens, 8,000 output tokens, four searches, full
fixture coverage, and 100% fixture recall. These values test budget logic; they
are not evidence that live provider performance meets the targets.

No paid live sample was run for Issue #15 because the owner prohibited paid
calls solely for verification. A future actual measurement requires explicit
approval and a predeclared sample of at most five case IDs, date, model/config,
maximum budget, output location, and complete operational fields. The evaluator
rejects unapproved, unbounded, or incompletely measured live samples.

## Exceptional behavior

- A fast report outside either target remains usable when valid, but the budget
  miss is visible and must be reviewed with coverage and recall.
- A timeout or provider failure returns the existing controlled error and does
  not retry automatically.
- A complex or incomplete case may be rerun in the deep stage only through an
  explicit user action. Deep-stage latency and cost are reported, not judged
  against fast-stage targets.
- Performance work must not silently improve a metric by weakening evidence,
  material-risk recall, source quality, or uncertainty handling.
- Safe server diagnostics identify stage, lifecycle phase, elapsed time, error
  constructor/name, status/code and nested cause, response receipt/status,
  incomplete reason, and token usage when available. They never log prompts,
  provider messages, response bodies, credentials, or authorization data.
