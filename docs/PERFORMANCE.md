# Fast-report operating budgets

**Last reviewed:** 2026-08-26

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
- at most four selected primary filing documents; and
- at most one directly linked material exhibit.

It caches the ticker map for six hours and issuer data or filing documents for
five minutes, coalesces concurrent requests, declares a User-Agent, and paces SEC
request starts. It then optionally performs an eight-second tool-disabled
classification over supplied evidence IDs. Deep uses the broader hosted-search
report workflow.

This implementation does **not** yet enforce the approved policy end to end.
Individual SEC fetches lack a shared cancellation deadline, the complete
pipeline is not governed by one cost/time controller, and provider costs outside
the current OpenAI estimate are not represented. The Fast reliability backlog
owns these gaps.

## Required budget behavior

The implementation milestone must provide:

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

A news or market-data provider must be evaluated for speed, coverage,
availability, reliability, source attribution, total cost, licensing, and
integration effort. Evaluation may recommend an option; selecting, paying for,
scraping, or integrating it requires explicit owner approval.
