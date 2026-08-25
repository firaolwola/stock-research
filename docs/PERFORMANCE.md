# Fast-report stages and operating budgets

**Last reviewed:** 2026-08-25

## Stage policy

The default `fast` stage is one Responses API request with no automatic retry,
at most four low-context web-search calls, a 30-second hard provider timeout,
and a 5,000-token output ceiling. Its normal evaluation targets remain 3–10
seconds end to end and approximately $0.10 or less. The lifecycle is tiered:
10 seconds is the target boundary, the next bounded 20 seconds are an
over-budget grace period, and 30 seconds is the hard cancellation boundary. A
valid response returned during the grace period remains usable but records
`within_latency_target=false`.

The hard timeout is a failure boundary, not a claim that the latency target was
met. The OpenAI SDK timeout covers the complete synchronous request, including
hosted web search, generation, and response-body parsing. If it aborts before
`responses.create` resolves, the application receives no provider response
object and cannot inspect partial output or usage. A provider-returned
`incomplete` response can still be inspected and accepted when it contains a
parseable partial/pending report. Required evidence is never guessed merely to
meet a budget: unfinished work must produce a `partial` or `pending` report
with named coverage limitations.

The `deep` stage is requested deliberately with the **Deeper research** control
or `stage=deep`. It permits at most ten medium-context web-search calls, has a
60-second timeout and 10,000-token output ceiling, and
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

Fast work is intentionally narrower than Deep. It establishes the current
security and catalyst, combines material split/dilution/compliance/accounting/
going-concern checks around primary SEC and exchange records, and uses the
latest relevant filing for concise financial context. Exhaustive predecessor
discovery, secondary-source corroboration, detailed financial history, and all
catalyst analogues are deferred with visible coverage limitations. This keeps
material-risk checks in Fast without asking it to complete the Deep research
plan.

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

The owner later observed a live SWVL Fast request reach the former 15-second
hard timeout with `APIConnectionTimeoutError` during `openai_request` and
`response_received=false`. This proves the synchronous search-and-generation
operation exceeded that cutoff; it does not identify one particular provider
search call or prove that generation had completed. The former cutoff allowed
only five seconds beyond the target and the prompt did not cap hosted searches.
The revised workload and 30-second bound are verified with mocks only, so live
latency remains uncalibrated. A future actual measurement requires explicit
approval and a predeclared sample of at most five case IDs, date, model/config,
maximum budget, output location, and complete operational fields. The evaluator
rejects unapproved, unbounded, or incompletely measured live samples.

## Exceptional behavior

- A fast report over 10 seconds but within the hard bound remains usable when valid, but the budget
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
