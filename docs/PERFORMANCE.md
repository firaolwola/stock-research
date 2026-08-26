# Fast-report stages and operating budgets

**Last reviewed:** 2026-08-25

## Stage policy

The default `fast` stage launches three low-context Responses API requests in
parallel with no automatic retries:

- `capital`: identity, necessary lineage, five-year reverse splits, and
  three-year offerings/dilution/warrants/convertibles; at most two searches and
  1,800 output tokens;
- `catalyst`: current 30-day catalyst, listing/compliance, and major recent
  SEC/accounting warnings; at most one search and 2,200 output tokens; and
- `financial`: latest-filing immediate financial risk, going concern, and
  dividend applicability/status; at most two searches and 2,000 output tokens.

Each request has a 20-second hard timeout. First useful validated output targets
3–10 seconds; all Fast domains target approximately 15–20 seconds. Operations
record both first-useful and complete latency status plus each domain's
completed or pending state.

The SDK timeout covers search, generation, and response parsing for each
individual request. One domain timeout no longer discards the other two.
Completed fragments are assembled server-side only when their current ticker,
issuer name, and CIK agree. The server derives scores, validates each progressive
report, and streams it as newline-delimited JSON. Missing or conflicting domains
stay Pending/Unknown; they never become favorable evidence.

The `deep` stage is requested deliberately with the **Deeper research** control
or `stage=deep`. It permits at most ten medium-context web-search calls, has a
60-second timeout and 10,000-token output ceiling, and
does not claim the fast-stage time or cost targets. It expands named gaps but
does not guarantee completeness. The server never escalates automatically.

The provider contracts are stage-aware. Neither stage asks the provider to emit
the eight deterministic scores or their components; the server derives them
from evidence after the response. Fast uses compact per-domain contracts, keeps
only material claims and at most four strongest sources per domain, and defers
historical catalyst analogues/reaction windows with explicit limited coverage.
Each domain returns an identity fingerprint; Capital alone returns the full
security/issuer objects. The server derives catalyst/news and financial-context
sections instead of asking the provider to repeat that evidence. Fast responses are
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
scores. The monolithic compact Fast contract was still approximately 3,449
tokens. Representative compact fragments measure approximately 774 rough
serialized tokens for Capital, 1,424 for Catalyst, and 1,245 for Financial.
Their ceilings retain approximately 57%, 35%, and 38% headroom because
`max_output_tokens` also includes reasoning output. The combined 6,000-token
ceiling is a failure bound, with normal visible output expected around
2,500–4,000 tokens. Deep remains roughly
4,000–7,500 under a 10,000-token ceiling. These are failure bounds, not targets.

## Per-report measurement

Successful API responses include an `operations` object outside the validated
research report. It records stage, first-useful and complete latency, per-domain
status, latency, token/search/cost telemetry, aggregate input/output/total tokens, counted web-search
calls, estimated cost, pricing version, and target status. Missing provider
usage produces unknown cost, not zero. The dashboard displays these values next
to the report's independent coverage and completion states.

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

The owner observed clean live SWVL Fast requests reach both 15-second and
30-second hard timeouts with `APIConnectionTimeoutError` during `openai_request` and
`response_received=false`. This proves the synchronous search-and-generation
operation exceeded those cutoffs; it does not identify one particular provider
search call or prove that generation had completed. The second failure occurred
after output and search bounds were tightened, establishing that the monolithic
architecture itself was not a reliable Fast boundary. The parallel domain
architecture then completed safely in one live SWVL run, but Capital and
Financial exhausted their 1,200-token limits and Catalyst reached its 20-second
timeout. The received responses used roughly 12k input tokens each. Local
prompts are only about 0.9–1.0k characters and revised schemas about 5.6–6.5k
characters, so hosted-search evidence and provider context—not prompt prose
alone—account for most observed input. Catalyst and Financial schemas are now
approximately 26% and 21% smaller. Live completion remains uncalibrated.
A future actual measurement requires explicit
approval and a predeclared sample of at most five case IDs, date, model/config,
maximum budget, output location, and complete operational fields. The evaluator
rejects unapproved, unbounded, or incompletely measured live samples.

## Exceptional behavior

- A progressive report may appear as soon as one valid domain completes. Domain
  states show which core checks remain pending.
- A domain timeout becomes visible Pending coverage and does not retry
  automatically or discard other completed domains.
- A complex or incomplete case may be rerun in the deep stage only through an
  explicit user action. Deep-stage latency and cost are reported, not judged
  against fast-stage targets.
- Performance work must not silently improve a metric by weakening evidence,
  material-risk recall, source quality, or uncertainty handling.
- Safe server diagnostics identify stage, lifecycle phase, elapsed time, error
  constructor/name, status/code and nested cause, response receipt/status,
  incomplete reason, and token usage when available. They never log prompts,
  provider messages, response bodies, credentials, or authorization data.
