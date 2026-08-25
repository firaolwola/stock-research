# Stock report contract

**Contract version:** 1.0.0

**JSON Schema:** [`schema/stock-report.schema.json`](../schema/stock-report.schema.json)

This contract is the shared boundary for fast and deep reports. The real and
token-free mock research clients now return this object shape, and the server
validates both JSON Schema and cross-record semantics before responding. Reports
are research aids, not personalized investment advice.

## Versioning

Every report must include `schema_version: "1.0.0"`. The schema `$id` also ends
in `1.0.0`. Additive optional changes increment the minor version. Removing a
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
  names/tickers. A prior identity includes effective dates when known, linkage
  state and confidence, and evidence claims. An uncertain relationship remains
  `unknown`; it must not be used as confirmed lineage.
- `sections` always contains reverse splits, dilution, dividends, compliance and
  warnings, financial context, and catalysts/news. Section items use a required
  `kind` to distinguish offerings, warrants, convertibles, compliance and
  accounting warnings, financial measures, catalysts, and news. They provide
  dated event summaries and claim references, with optional periods and paired
  numeric value/unit fields where those facts are useful.
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

Unknown, not-found, not-applicable, and limited-coverage scores must have a
`null` value. Only `confirmed` scores carry a numeric value. Consequently,
missing evidence cannot silently become zero risk or favorable quality.

## Scores

All scores use an explicit 0–10 scale, direction, time horizon, explanation, and
supporting claim IDs. Risk constructs use `higher_is_more_risk`; quality
constructs use `higher_is_better`. Values are contract placeholders until the
separate calibration work is completed. Consumers must display the construct,
direction, horizon, evidence state, explanation, and claims alongside a value.
They must not calculate an opaque roll-up from unlike dimensions.

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
The partial fixture demonstrates an ADR, deep/partial status, unresolved lineage,
limited coverage, unknown evidence, and deliberately null scores.

Schema validation is necessary but does not establish factual correctness,
source quality, scoring calibration, or research completeness. Those remain
separate implementation and evaluation responsibilities.

The OpenAI request supplies this contract as a JSON Schema response format with
API-level strict mode disabled because contract v1 uses Draft 2020-12 features
beyond the API strict subset. Successful output must still pass the complete
server validator; API formatting alone is never treated as sufficient.
The request also includes `web_search_call.action.sources` so provider search
source metadata remains available while the model constructs the contract's
typed, dated, claim-linked source records.
