# Stock report contract

**Contract version:** 4.0.0

**JSON Schema:** [`schema/stock-report.schema.json`](../schema/stock-report.schema.json)

This contract is the shared boundary for fast and deep reports. The real and
token-free mock research clients now return this object shape, and the server
validates both JSON Schema and cross-record semantics before responding. Reports
are research aids, not personalized investment advice.

Operational telemetry is intentionally outside this contract. A successful
`/api/analyze` response contains `{ ticker, report, operations }`; `operations`
records stage, latency, tokens, web-search calls, estimated cost, pricing
version, and fast-budget status. This keeps performance metadata from changing
the meaning or validity of a stored report. See [PERFORMANCE.md](PERFORMANCE.md).

The live OpenAI request uses a derived provider schema that removes Structured
Outputs composition keywords the Responses API does not support. The repository
schema remains the authoritative contract: the server still applies its full
Draft 2020-12 and semantic validation after parsing, so provider compatibility
does not weaken the application boundary.

That derived schema also omits `scores`: provider-authored scores were redundant
because the server always replaces them. Fast and Deep use separate collection
bounds, and Fast deliberately represents historical catalyst analogues as a
named deep-stage coverage gap. After research, deterministic scoring restores
the required full v4 shape before authoritative validation and browser delivery.

Operational telemetry is intentionally outside this contract. A successful
`/api/analyze` response contains `{ ticker, report, operations }`; `operations`
records stage, latency, tokens, web-search calls, estimated cost, pricing
version, and fast-budget status. This keeps performance metadata from changing
the meaning or validity of a stored report. See [PERFORMANCE.md](PERFORMANCE.md).

## Versioning

Every report must include `schema_version: "4.0.0"`. The schema `$id` also ends
in `4.0.0`. Version 4 makes score methodology, confidence, and visible input
components required; earlier versions remain identifiable but are not accepted
by the current endpoint. Additive
optional changes increment the minor version. Removing a
field, changing a field's meaning, making an optional field required, or changing
an enum incompatibly increments the major version. Saved reports retain the
version with which they were produced.

All object fields are explicit: objects reject unknown properties and fields in
each object's `required` list are mandatory. Nullable values are distinct from
omitted values. Arrays may be empty unless the schema specifies `minItems`.

## Report shape

- `metadata` records the as-of and generation timestamps, `fast` or `deep`
  stage, `complete`, `partial`, or `pending` completion, topic-specific research
  windows, and structured coverage limitations.
- `security` records the current ticker, display name, security type, listing
  venue/status, evidence state, and supporting claims.
- `issuer` records legal identity, optional CIK, identity confidence, and prior
  names/tickers. Confirmed prior identities require both effective dates,
  `high` or `medium` linkage confidence, and sourced confirmed linkage claims.
  An uncertain relationship remains `unknown` or `limited_coverage`; it must not
  be used as confirmed lineage.
- `sections` always contains reverse splits, dilution, dividends, compliance and
  warnings, financial context, and catalysts/news. Section items use a required
  `kind` to distinguish offerings, warrants, convertibles, compliance and
  accounting warnings, financial measures, catalysts, and news. They provide
  dated event summaries and claim references, with optional periods and paired
  numeric value/unit fields where those facts are useful.
- `catalyst_assessment` identifies the current catalyst and classifies its
  recency, specificity, credibility, novelty, and potential significance. It
  keeps favorable evidence, unfavorable evidence, uncertainty, and a
  confidence-qualified near-term implication visible. Issuer-specific historical
  analogues state why they are comparable, their limitations, and sourced stock
  reactions over explicit date windows. When no reliable analogue is available,
  the analogue state is `unknown` with no invented item or reaction.
- `financial_assessment` preserves a dated reporting currency, cash, cash burn,
  revenue, profitability, free cash flow, and debt. Confirmed metrics include a
  value, unit, statement period, and sourced claim. A claimed trend also includes
  the comparison period. Going-concern evidence is explicit, and material
  liquidity, burn, leverage, profitability, accounting, or going-concern
  warnings carry severity and dates for priority ranking. Operating-company
  metrics may be `not_applicable` for securities such as ETFs.
- `scores` keeps dilution historical severity, future likelihood, and potential
  impact separate. Reverse-split risk, financial health, long-term company
  quality, catalyst strength, and near-term setup quality are also separate.
- `claims` contains atomic factual conclusions. `sources` contains evidence and
  links back to every supported claim.

## Evidence states

The following states apply to sections, items, claims, identity, and scores:

- `confirmed`: sufficient evidence supports the stated conclusion.
- `not_found`: the defined research found no evidence of the event. It is a
  bounded search result, not proof that the event never occurred.
- `unknown`: evidence is unavailable, inadequate, conflicting, or unresolved.
- `not_applicable`: the concept does not apply to this security or context.
- `limited_coverage`: some relevant research was possible, but stated gaps make
  a complete conclusion unsafe.

`unknown` is the state for unavailable, inadequate, conflicting, or unresolved
evidence. It is not interchangeable with `not_found`: that state requires a
documented, bounded search and must never be worded as proof that an event never
occurred. `not_applicable` is contextual, normally based on the identified
security type; it contains no invented items, claims, sources, or score value.
Every `limited_coverage` section names its coverage gap.

Reports are immutable snapshots, but later research may produce a new report
with a changed state. An initial `unknown` may become `confirmed`, bounded
`not_found`, `not_applicable`, or `limited_coverage` as evidence and applicability
become clear. `confirmed` or `not_found` may be downgraded to `unknown` or
`limited_coverage` when conflict or a coverage gap is discovered.
`not_applicable` changes only when the security or context classification changes.
Consumers must compare report timestamps and evidence; they must not infer that
one state silently transitions in place.

Unknown, not-found, not-applicable, and limited-coverage scores must have a
`null` value. Only `confirmed` scores carry a numeric value. Consequently,
missing evidence cannot silently become zero risk or favorable quality.
Every claim supporting a confirmed score must itself be sourced and either
`confirmed` or bounded `not_found`; unresolved claims cannot help produce a
numeric score.

## Scores

All scores use an explicit 0–10 scale, direction, time horizon, explanation,
confidence, methodology version, visible components, and supporting claim IDs.
Risk constructs use `higher_is_more_risk`; quality constructs use
`higher_is_better`. The server deterministically replaces upstream score values
using [the documented methodology](SCORING.md) before validating and returning a
report. Consumers must display the construct, direction, horizon, state,
confidence, explanation, components, and claims alongside a value. They must not
calculate an opaque roll-up from unlike dimensions.

## Claims and sources

Claim IDs start with `claim-`; source IDs start with `source-`. A material
confirmed or not-found claim must cite at least one source. Each relationship is
bidirectional: a claim lists `source_ids`, and each source lists the same claim
in `supported_claim_ids`.

Sources require a useful title, direct HTTPS URL, publication or filing date,
source type, confidence, retrieval timestamp, and supported claims. Source types
distinguish SEC filings, exchange notices, company evidence, original reporting,
and secondary evidence. Confidence is explicit rather than inferred from type;
secondary evidence cannot be assigned `high` confidence, and a source cannot be
retrieved before its stated publication date.

Every `confirmed` or `not_found` identity, section, section item, and score must
reference at least one corresponding sourced claim. Unsupported material facts
are rejected at the server boundary. When available sources materially conflict,
the conclusion remains `unknown` or `limited_coverage` and any score remains
unscored rather than selecting or inventing a favorable conclusion.

For reverse splits, dilution and offerings, exchange compliance, and warnings,
a dated item inside a confirmed prior-identity period must reference that
identity's linkage claim. This makes the carried history inspectable. A
confirmed item may not reference an unresolved predecessor linkage. Invalid or
reversed effective-date ranges are rejected.

## Validation

Install dependencies and run:

```powershell
npm test
```

`npm test` validates every JSON file in `fixtures/reports/` against Draft
2020-12 and then checks cross-record semantics: unique IDs, resolvable claim
references, bidirectional claim/source links, evidence requirements for
confirmed/not-found claims, evidence references on material report records,
reduced confidence for secondary sources, source-date ordering, and consistency
between complete status and coverage limitations.

The complete fixture demonstrates all initial trustworthy-report sections,
confirmed lineage, dated SEC, exchange, company, original-news, and secondary
evidence, an explicit unresolved source conflict, and distinct score dimensions.
The partial fixture demonstrates a listed warrant, deep/partial status,
unresolved lineage, limited coverage, unknown evidence, a security-specific
`not_applicable` dividend check, and deliberately null scores. Partial and
pending reports must include at
least one structured coverage limitation; they remain valid and usable when all
other semantic checks pass.

The isolated lineage fixtures and tests cover a ticker change, company rename,
combined name/ticker rebrand, delisted common stock, and ambiguous predecessor.
They verify both successful carried history and rejection when the linkage is
missing or unresolved.

An upstream Responses API result marked `incomplete` may still contain a safe,
parseable partial report. Such output proceeds through the same full server
validator and is returned only if the contract and semantic checks pass. Empty,
malformed, or unsafe incomplete output remains a controlled failure.

Schema validation is necessary but does not establish factual correctness,
source quality, scoring calibration, or research completeness. Those remain
separate implementation and evaluation responsibilities.

Deep supplies this contract as a JSON Schema response format with API-level
strict mode disabled because the contract uses Draft 2020-12 features beyond
the API strict subset. Fast instead requests three compact domain schemas and
assembles this same v4 contract server-side. Separate Fast fragments are merged
only when ticker, issuer legal name, and CIK agree; failed or conflicting domains
produce explicit pending/unknown placeholders. Every progressive and final
assembly must pass the complete server validator, so API formatting alone is
never treated as sufficient. Requests include
`web_search_call.action.sources` so provider search metadata remains available
while typed, dated, claim-linked source records are constructed.

Catalyst validation additionally requires confirmed catalysts to have a date,
classification, sourced claims, and meaningful confidence. Confirmed analogues
must include a date, comparison limitations, and valid reaction windows;
unresolved reaction windows cannot contain a numeric price change. The server
rejects unsupported numerical probability language and advisory wording in the
catalyst assessment.

Financial validation rejects confirmed metrics without values, units, periods,
or sourced claims; invalid period ordering; unresolved metrics containing
numeric values; and confirmed financial-health scores built from an unresolved
assessment. Confirmed going-concern evidence must also appear as a dated material
warning. A wholly inapplicable assessment contains no dates, currency, evidence,
or warnings and marks every financial component `not_applicable`.
