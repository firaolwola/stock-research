# Fast-report operating budgets

**Last reviewed:** 2026-08-27

## Approved policy

Fast is bounded by cost and complete-pipeline elapsed time. It terminates when
either limit is reached:

- end-to-end elapsed-time ceiling: 20 seconds;
- ideal normal cost: approximately $0.01–$0.03;
- normal maximum cost: approximately $0.03; and
- difficult-ticker ceiling: approximately $0.05.

The limits cover SEC retrieval, news or provider lookup, market and price
context, synthesis, scoring, and finalization. They are ceilings rather than
spending or latency targets. Fast should finish earlier and cheaper when the
required evidence is already available.

When a limit is reached, completed trustworthy scores remain available and
unfinished components settle as `Unscored` or `Limited`. The application must
not emit a provisional numeric score or continue open-ended work.

First-useful and per-component latency remain useful telemetry, but no strict
few-second first-score target is an acceptance requirement.

## Current implementation

Production Fast currently retrieves:

- SEC ticker, CIK, and exchange associations;
- issuer submissions and recent filing metadata;
- SEC Company Facts;
- at most six selected primary filing documents, including up to three bounded
  corporate-action/accounting candidates; and
- at most one directly linked material exhibit;
- cached Nasdaq Trader current-symbol and halt data; and
- when a free key is configured, at most one successful provider-neutral news
  and one end-of-day market operation per uncached ticker, with ordered bounded
  fallback attempts, plus at most one
  bounded original-newswire promotion request.

The two Alpha Vantage requests are serialized, market first, with a 250 ms gap.
A live SWVL structural probe confirmed that `TIME_SERIES_DAILY` returns the
expected `Meta Data` and `Time Series (Daily)` shape with `4. close` and
`5. volume`. Concurrent free-tier requests intermittently returned HTTP 200
with an `Information` object for one request, so concurrency was removed. This
adds a small bounded delay while avoiding a false generic no-data result.

SEC issuer/ticker/CIK association is kept separate from security type and active
listing status. Identity-gated Nasdaq data may resolve those fields; unsupported
or conflicting venues remain Limited. Company
Facts normalization derives FCF only from aligned OCF and capital expenditures,
derives total debt only from aligned current and non-current components, and
withholds stale or conflicting liquidity values from current decision use.
Quarter, year-to-date, and annual facts that share an end date remain distinct
periods. Completed split factors normalize shares history; unexplained large
share discontinuities remain Limited.

It caches the ticker map for six hours and issuer data or filing documents for
five minutes, coalesces concurrent requests, declares a User-Agent, and paces SEC
request starts. Nasdaq directory data is cached for 24 hours, halt data for one
minute, and provider ticker results for five minutes. Local counters stop Alpha
Vantage at 25/day and Twelve Data at 8/minute or 800/day; cache hits consume
neither counter. Quota responses trigger an approved fallback or settle the
affected source as Limited. One
request-scoped controller governs the entire Fast path.

Market telemetry records a safe reason such as `provider_quota`,
`premium_endpoint`, `invalid_request_or_symbol`, `provider_information`,
`missing_daily_series`, `invalid_daily_bar`, or `stale_daily_bar`. Daily bars
older than seven calendar days are Limited. Logs include only source category,
response keys, status/reason, and request count—not credentials or response text.
It stops source work after 19.5 seconds, reserving 0.5 seconds for scoring,
validation, telemetry, and response finalization before the 20-second hard
ceiling. The same abort signal reaches SEC pacing waits, queued/shared waits,
`fetch`, filing/exhibit retrieval, and optional tool-disabled synthesis.

The normal controller is fixed at $0.03. A $0.05 difficult controller must be
selected explicitly by an internal caller; normal runs cannot silently escalate.
Before any paid operation begins, it must reserve a finite maximum charge. The
reservation is rejected when consumed plus reserved cost would exceed the active
ceiling. Completion commits actual measured cost; cancellation or failure
releases the reservation. Future provider adapters use this same interface and
must not run when their maximum charge is unknown.

Deep keeps its separate research budget and hosted-search behavior. Its elapsed
telemetry includes any automatic Fast-foundation build. `fast_foundation`
telemetry identifies whether that foundation was built, reused, refreshed for
fast-moving sources, or rebuilt; it also reports age, source freshness,
evidence reused, duplicate retrieval avoided, and unresolved components
targeted. `evidence_lineage` reports preserved Fast claims, new Deep claims, and
explicit revisions. These fields measure reuse but never certify completeness.

## Enforced budget behavior

The implementation provides:

- one monotonic deadline shared across every Fast operation;
- per-operation remaining-time propagation and cancellation;
- a shared cost ledger covering every paid provider;
- a normal-versus-difficult budget policy that cannot silently escalate;
- explicit stopped-by-time and stopped-by-cost outcomes;
- progressive completion that preserves already validated evidence;
- final settlement of every score card; and
- measurements outside the immutable report contract.

Unknown provider usage produces unknown cost, not zero. A path whose cost cannot
be bounded must not be enabled as normal Fast behavior.

Completed evidence survives a stopped source. Unfinished domains stay Limited or
pending in the evidence report, deterministic scoring emits no number without
sufficient evidence, and final operations metadata records `completed`,
`partial_coverage`, `time_ceiling`, `cost_ceiling`, or `cancelled`. Per-source
status and scored/unscored/limited/not-applicable counts accompany the result.

## Measurement

Successful responses should report, when available:

- complete-pipeline latency;
- first trustworthy score latency;
- per-source or per-domain latency and status;
- SEC request and cache activity;
- provider requests or searches;
- input and output tokens;
- estimated provider and total cost;
- applicable cost ceiling;
- whether time or cost stopped the run; and
- score completion, limited, and unscored counts.

Operations metadata remains separate from the versioned research report so
budget behavior cannot change the meaning of stored evidence.

## Current evidence

The checked-in dry evaluation uses fictional reports and synthetic operational
values. Its latency, token, search, cost, coverage, and recall numbers validate
the evaluator and budget calculations only; they are not evidence that the
production evidence-first pipeline meets current targets.

Its executable normal cost target is now $0.03 and its illustrative samples stay
below that ceiling. This validates policy arithmetic only, not live cost.

Historical live findings established:

- monolithic and parallel hosted-search Fast designs did not reliably return
  within their former bounds;
- evidence-first SEC retrieval produced a valid free SWVL structural result;
  and
- one bounded filing-extraction run completed six SEC requests and produced 18
  evidence records in roughly 1.2 seconds without a paid OpenAI call.

That one run does not establish normal latency, cost, score completion, or
material-risk recall. Future real-ticker calibration must record the full policy
fields and use only owner-approved paid bounds.

## Pricing and provider review

`lib/research-budget.js` contains the executable historical OpenAI pricing
snapshot. Pricing and tool fees can change and must be checked against official
provider terms before interpreting or approving a new measured run.

Alpha Vantage and Twelve Data Basic are approved only for personal/internal
market context and ticker/news discovery. Provider summaries, sentiment,
press-release bodies, and article bodies do not enter OpenAI packets or material
scoring. No paid plan is approved;
selecting another provider, paying, scraping, or broadening licensed use still
requires explicit owner approval.
