# Stock report contract

**Contract version:** 4.0.0

**JSON Schema:** [`schema/stock-report.schema.json`](../schema/stock-report.schema.json)

This contract is the shared boundary for fast and deep reports. The real and
token-free mock research clients now return this object shape, and the server
validates both JSON Schema and cross-record semantics before responding. Reports
are research aids, not personalized investment advice.

Before Deep starts, the server calibrates and validates a complete or safe
partial Fast report and packages it with normalized evidence, sources, identity,
and operations. Deep preserves reused claim/source IDs. Newly found or
conflicting evidence uses distinct IDs; conflicts retain both records, mark the
report partial, and add `deep_revision_lineage` rather than silently replacing
the Fast fact. Handoff freshness and lineage counts remain operations telemetry
outside this versioned report contract.

Operational telemetry is intentionally outside this contract. A successful
`/api/analyze` response contains `{ ticker, report, operations }`; `operations`
records stage, latency, tokens, web-search calls, estimated cost, pricing
version, and fast-budget status. This keeps performance metadata from changing
the meaning or validity of a stored report. See [PERFORMANCE.md](PERFORMANCE.md).

The internal Fast evidence packet may additionally carry `identity_resolution`
with requested ticker, current ticker, resolution status, and authoritative
source URL. This is orchestration metadata, not a v4 report-contract field.
Final live reports cannot retain `completion_status: pending` or Pending coverage
limitations: exhausted, unavailable, or unresolved work settles as a valid
partial report with Limited/Unscored evidence. Progressive intermediate events
and the token-free `PENDING` demonstration may still use Researching/Pending.

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

## Versioning

Every report must include `schema_version: "4.0.0"`. The schema `$id` also ends
in `4.0.0`. Version 4 makes score methodology, confidence, and visible input
components required; earlier versions remain identifiable but are not accepted
by the current endpoint. Additive
optional changes increment the minor version. Removing a
field, changing a field's meaning, making an optional field required, or changing
an enum incompatibly increments the major version. Saved reports retain the
version with which they were produced.

The current executable score methodology is `2.1.0`; stored `2.0.0` reports
remain schema-valid as a historical baseline, while `1.0.0` is documented but
is not accepted by the live v4 endpoint. Fast market context uses confirmed `financial_context` items with
units `price_change_percent` and `volume_ratio`, sourced to a bounded market-data
record. These contextual items cannot establish an issuer event.
Dilution section items may use `evidence_role` to distinguish completed
`actual_issuance`, `registration_capacity`, `potential_issuance`, and
`instrument_overhang`; scoring never infers one role from an offering label.

All object fields are explicit: objects reject unknown properties and fields in
each object's `required` list are mandatory. Nullable values are distinct from
omitted values. Arrays may be empty unless the schema specifies `minItems`.

## Report shape

- `metadata` records the as-of and generation timestamps, `fast` or `deep`
  stage, `complete`, `partial`, or `pending` completion, topic-specific research
  windows, and structured coverage limitations.
- `security` records the current ticker, display name, security type, listing
  venue/status, evidence state, and supporting claims. A confirmed security
  record cannot leave security type or listing status `unknown`. The SEC ticker
  association may confirm issuer/ticker/CIK and venue while the overall security
  record remains `limited_coverage` until an authoritative source establishes
  type and current listing state. Delisted or OTC is a listing state, not a
  security type: authoritative common-stock language may settle
  `common_stock`, while foreign ordinary shares remain
  `foreign_ordinary_share`. Ticker suffixes do not establish either type.
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
  numeric value/unit fields where those facts are useful. Reverse-split items
  may carry `corporate_action_state` to distinguish completed, scheduled,
  authorized, proposed, cancelled, and unresolved actions. Only actions whose
  effective time has passed, or whose source explicitly confirms completion,
  count as completed history; filing date alone is not completion.
- `catalyst_assessment` identifies the current catalyst and classifies its
  recency, specificity, credibility, novelty, and potential significance. It
  keeps favorable evidence, unfavorable evidence, uncertainty, and a
  confidence-qualified near-term implication visible. Issuer-specific historical
  analogues state why they are comparable, their limitations, and sourced stock
  reactions over explicit date windows. When no reliable analogue is available,
  the analogue state is `unknown` with no invented item or reaction.
- `financial_assessment` preserves a dated reporting currency, cash, internal
  cash burn, revenue, net income or loss, operating cash flow, free cash flow,
  and debt. Confirmed metrics include a
  value, unit, statement period, and sourced claim. Its optional bounded
  `observations` retain source-linked values in chronological order for honest
  comparisons. Optional `annual_observations` retain bounded comparable annual
  or year-end values for the grouped dashboard charts. Observations share the
  metric definition and unit and use comparable
  period lengths; one observation never implies a trend. A claimed trend also
  includes the comparison period. Going-concern evidence is explicit, and material
  liquidity, burn, leverage, profitability, accounting, or going-concern
  warnings carry severity and dates for priority ranking. Operating-company
  metrics may be `not_applicable` for securities such as ETFs.
- `financial_assessment.shares_outstanding` is an optional display-support
  series of source-linked, chronological point-in-time observations measured in
  `shares`. It is not float or potential dilution and does not participate in
  financial trend scoring. Its optional `annual_observations` drive the
  preferred multi-year capital-structure chart.

Company Facts duration facts retain their full start/end identity. Quarter,
year-to-date, and annual values ending on the same date are not conflicts unless
two values disagree for the same exact period and unit. Shares observations are
normalized across confirmed completed split factors; an unexplained large
discontinuity stays Limited instead of being described as dilution.
When that unresolved discontinuity prevents a trustworthy normalized share
series, the scoreable `observations` and `annual_observations` arrays are empty.
The raw filing evidence remains available through claims and sources; the
contract does not expose unsafe observations as though they were valid score
inputs. Compliance items may carry `resolution_state`; `resolved` history does
not represent an active deficiency.

Fast financial normalization uses conservative derived-value rules. Operating
cash flow is not free cash flow: FCF is populated only when aligned operating
cash flow and capital-expenditure facts share a period and unit. Total debt is
populated only from aligned current and non-current components; one component,
or components with conflicting periods or currencies, leaves total debt limited
and null. Stale decision-critical values retain sourced warnings but are not
exposed as current numeric inputs. Runway stays unresolved unless current,
comparable cash and positive burn inputs are both available.
The semantic validator applies the same boundary to all report producers: a
confirmed monetary metric must use the assessment reporting currency, critical
liquidity metrics more than 180 days old cannot remain confirmed, FCF cannot be
labeled as OCF, and a single current/non-current component cannot be labeled as
confirmed total debt.
- `scores` keeps dilution historical severity, future likelihood, and potential
  impact separate. Reverse-split risk, financial health, long-term company
  quality, catalyst strength, and near-term setup quality are also separate.
  Optional additive fields hold six 2.1.0 supporting trends: revenue, net
  income/loss, debt, free cash flow, cash, and operating cash flow. The server
  deterministically restores all six on current reports. Confirmed financial
  scores may cite SEC Company Facts or SEC-filed evidence only.
- `claims` contains atomic factual conclusions. `sources` contains evidence and
  links back to every supported claim.

## Evidence states

Issuer reporting and security structure are independently settled optional
identity properties. They distinguish jurisdiction, foreign-private-issuer
status, domestic/20-F/40-F filing regime, IFRS or U.S.-GAAP framework,
presentation currency, direct shares versus depositary securities, and additional
venues. Missing financial taxonomy does not erase an explicit SEC-filed
accounting framework, and foreign-private-issuer status never implies ADS.

Exchange-compliance items retain `active`, `resolved`, or `historical` state.
Fast reconciles newer authoritative events within the same venue and listing
rule; closure of one rule cannot close another deficiency.

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

`Researching` is currently a progressive transport and UI state, not a stored
factual evidence state. While Fast continues, the transport identifies unfinished
components. A final validated report settles those components using the existing
`unknown` or `limited_coverage` semantics and null numeric values. A later
implementation may propose a contract change only if transport state cannot
represent the approved behavior safely.

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
Validation also rejects a confirmed security with unresolved type/listing state,
and the HTTP boundary rejects a report whose security ticker differs from the
requested ticker.

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
Lineage provenance is reciprocal: a carried historical claim references a
present source, that source lists the claim, and a historical event references
the applicable dated lineage claim. SEC submissions former-name evidence is not
silently reassigned to a separate historical filing source.

An upstream Responses API result marked `incomplete` may still contain a safe,
parseable partial report. Such output proceeds through the same full server
validator and is returned only if the contract and semantic checks pass. Empty,
malformed, or unsafe incomplete output remains a controlled failure.

Schema validation is necessary but does not establish factual correctness,
source quality, scoring calibration, or research completeness. Those remain
separate implementation and evaluation responsibilities.

Deep supplies this contract as a JSON Schema response format with API-level
strict mode disabled because the contract uses Draft 2020-12 features beyond
the API strict subset. Production Fast assembles the same v4 contract from
server-retrieved evidence and validates every progressive and final report.
Current Fast retrieval combines authoritative SEC evidence, bounded public
Nasdaq Trader context, optional provider-neutral free-tier discovery/end-of-day
context, original-source promotion, and optional tool-disabled classification.
Provider formatting or discovery summaries are never treated as authoritative
validation or sole material evidence.

Optional source provenance fields identify `provider_name`, `data_type`,
`freshness`, and `evidence_role`. They distinguish provider discovery, market
observations, and promoted original evidence without changing claim authority.

Catalyst validation additionally requires confirmed catalysts to have a date,
classification, sourced claims, and meaningful confidence. Confirmed analogues
must include a date, comparison limitations, and valid reaction windows;
unresolved reaction windows cannot contain a numeric price change. The server
rejects unsupported numerical probability language and advisory wording in the
catalyst assessment.
Deterministic parser labels are normalized before validation into the v4
classification enum; internal labels such as accounting, bankruptcy, or
delisting never appear directly in a report.

Corporate-action section items may carry `source_filing_date`, `announced_date`,
`effective_date`, and `completed_date`. `event_date` represents the best supported
action date, not the publication date of a corroborating filing. Optional action
dates may be null when the filing does not support them. Multiple sources can
link to one normalized event through its claim references; differing filing
dates alone do not create duplicate corporate actions.
An identity-gated retrospective periodic filing may confirm that an earlier
authorized action completed and supply its effective date; the authorization
remains provenance and does not independently establish completion.

Raw split mentions are not separate corporate-action section items. Fast first
reconciles them into canonical lifecycle events; their source-linked claims may
remain as corroborating provenance, but ambiguous undated mentions cannot appear
as extra completed actions. The internal Fast evidence packet may retain
corporate-action diagnostics with raw span and logical segment IDs, candidate
date/lifecycle source segments, inheritance attempt and rejection reason,
competing-ratio flag, and final canonical disposition. These diagnostics never
enter user-facing evidence. The packet may also carry
`normalization_diagnostics` for rejected SEC
Company Facts concepts. These bounded structural records are deliberately outside
report v4 and cannot become claims, evidence, sources, or score inputs.
Security type may be supported by direct authoritative wording in any selected,
identity-gated filing record. A terminal listing excerpt need not repeat that
wording, but an OTC venue or ticker suffix alone cannot settle security type.
The internal evidence packet may also carry `nt_filing_diagnostics` describing
form/period selection, expected periodic form, superseding filings, active-delay
state, exclusion reason, and bounded reason-source ranges. These diagnostics are
not report claims or user-facing evidence.

Financial validation rejects confirmed metrics without values, units, periods,
or sourced claims; invalid period ordering; unresolved metrics containing
numeric values; and confirmed financial-health scores built from an unresolved
assessment. Confirmed going-concern evidence must also appear as a dated material
warning. Chart observations must be chronological, source-linked, unit-aligned,
period-comparable, and include the metric's current reported value. A wholly
inapplicable assessment contains no dates, currency, evidence,
or warnings and marks every financial component `not_applicable`.
Annual observations must be chronological and either approximately annual in
duration or point-in-time year-end balances. They need not duplicate the latest
quarterly metric value and are kept out of the provider-facing Fast schema.
When present, confirmed shares-outstanding observations must be unique,
chronological point-in-time values using the literal `shares` unit. Unresolved
series cannot carry observations.
