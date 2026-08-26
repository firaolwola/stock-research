# Fast-report stages and operating budgets

**Last reviewed:** 2026-08-25

## Stage policy

The default `fast` stage no longer launches hosted-web-search requests. It
retrieves three SEC resources on a cold issuer lookup:

- SEC ticker/CIK/exchange associations;
- issuer submissions and recent filing metadata; and
- SEC Company Facts.

The ticker map is cached for six hours; submissions and Company Facts are cached
for five minutes. Concurrent requests share in-flight work. Requests declare a
User-Agent and are paced at no more than eight starts per second. Cold Fast
normally makes three free SEC requests; a warm same-issuer request makes zero.

Identity is streamed as the first deterministic report, followed by filing and
financial evidence. Optional synthesis uses no tools, has an eight-second bound,
and is limited to 900 output tokens. The deterministic report survives synthesis
failure. First useful evidence still targets 3–10 seconds.

All normalized records carry the resolved ticker, issuer name, and CIK before
they are assembled. The server derives scores and validates each progressive
report. Missing or conflicting retrieval remains Pending/Unknown.

The `deep` stage is requested deliberately with the **Deeper research** control
or `stage=deep`. It permits at most ten medium-context web-search calls, has a
60-second timeout and 10,000-token output ceiling, and
does not claim the fast-stage time or cost targets. It expands named gaps but
does not guarantee completeness. The server never escalates automatically.

Neither stage asks the provider to emit deterministic scores. Fast synthesis
returns only prioritized evidence IDs and bounded category classifications; it
cannot add claims or sources to the report. Fast therefore remains `partial` or
`pending` relative to the full v4 contract. Deep may include up to three
analogues and four reaction windows per analogue.

Fast confirms SEC identity/CIK, former-name metadata with bounded dates, recent
filing discovery, financing-form candidates, and standardized financial facts.
Reverse-split terms, completed issuance, warrant/convertible terms, compliance
text, going-concern/accounting language, dividends, and non-SEC catalysts remain
Limited/Unknown until filing parsing or broader retrieval is approved.

Fast synthesis is expected to send roughly 3,000–8,000 input tokens and return
500–900 output tokens, for an estimated normal cost near $0.01–$0.03. These are
unverified projections. Deep remains bounded at 10,000 output tokens.

## Per-report measurement

Successful API responses include an `operations` object outside the validated
research report. It records first-useful/complete latency, retrieval status,
SEC network count/cache state, synthesis status, tokens, estimated cost, and
target status. Missing provider
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
approximately 26% and 21% smaller. A later clean run then timed out all three
parallel domains at 20 seconds without response objects. This established the
hosted-search mechanism as the remaining bottleneck and led to evidence-first
Fast. Live performance of the new path remains uncalibrated.
A future actual measurement requires explicit
approval and a predeclared sample of at most five case IDs, date, model/config,
maximum budget, output location, and complete operational fields. The evaluator
rejects unapproved, unbounded, or incompletely measured live samples.

## Exceptional behavior

- A progressive report appears after identity resolution and expands as filing
  and Company Facts retrieval settles.
- A retrieval or synthesis failure preserves completed deterministic evidence.
- A complex or incomplete case may be rerun in the deep stage only through an
  explicit user action. Deep-stage latency and cost are reported, not judged
  against fast-stage targets.
- Performance work must not silently improve a metric by weakening evidence,
  material-risk recall, source quality, or uncertainty handling.
- Safe server diagnostics identify stage, lifecycle phase, elapsed time, error
  constructor/name, status/code and nested cause, response receipt/status,
  incomplete reason, and token usage when available. They never log prompts,
  provider messages, response bodies, credentials, or authorization data.
