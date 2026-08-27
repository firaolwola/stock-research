# Decision log

Record consequential decisions here so future work preserves their context. Keep
entries short, place the newest decisions first, and mark superseded decisions
rather than erasing history.

## 2026-08-27 — Interpret controls, listing status, and split timing contextually

**Status:** Accepted from Batch 3 corrective evidence

**Decision:** A control warning requires affirmative ineffective-control,
identified-weakness, or remediation evidence; positive audit language and
negated weakness statements are negative controls. Active listing pressure
requires an exchange notice or explicit issuer disclosure of an active status,
not a financing covenant or hypothetical risk. Corporate actions retain
proposed, authorized, scheduled, completed, or cancelled timing at the report
cutoff. Fast may open a bounded SEC historical-submissions index when the current
submissions block no longer covers the five-year action window.

**Why:** Batch 3 produced false AAPL and SMCI warnings, marked NXL completed one
day early, and missed AMC's older completed split. Each error could materially
change a reject-or-continue decision.

**Consequence:** Explanations and settlement follow normalized contextual state.
Missing aligned OCF/capex periods still leave FCF Limited; recall is not improved
by inventing a derived value.

## 2026-08-27 — Make bounded market/news retrieval interchangeable

**Status:** Accepted, implemented, and approved for the frozen Batch 3 bounds

**Decision:** Preserve SEC and exchange authority while routing optional market
and discovery operations through an ordered provider-neutral pool. Alpha
Vantage and Twelve Data Basic are approved for internal/personal discovery and
end-of-day context only. Operations fall back independently, share the Fast
deadline, cache, and zero-dollar ledger, and expose normalized provenance and
quota telemetry. Twelve Data press-release bodies, and all provider summaries,
sentiment, and article text, are excluded from OpenAI and material scoring.

**Why:** A free-tier provider can be unavailable, malformed, or quota-limited
without making the authoritative SEC/Nasdaq report unusable. An adapter boundary
prevents an outage from becoming an application dependency and permits later
replacement without changing score semantics.

**Consequence:** No paid plan or production dependency is added. Missing optional
context remains Limited. For Issue #55 Batch 3, the owner approved Alpha Vantage
first and Twelve Data fallback, capped at 10 requests per provider and 20
combined optional-provider attempts.

## 2026-08-27 — Make validated Fast evidence the mandatory Deep foundation

**Status:** Implemented by Issue #54

**Decision:** A direct Deep request first builds and validates an identity-gated
Fast snapshot. A Deep request after Fast reuses the in-memory snapshot while it
is fresh; fast-moving exchange/news/market context is refreshed after two
minutes, and the full foundation is rebuilt after five minutes. Deep receives
the calibrated Fast report, normalized evidence, source records, operations,
and an explicit unresolved-first priority plan. Reused claim/source IDs remain
stable. New or conflicting Deep evidence gets distinct IDs, retains the Fast
record, and records revision lineage instead of silently replacing facts.

**Why:** Deep previously received only an opportunistic SEC packet and could
restart research, lose completed score context, or obscure changed evidence.
The validated handoff makes direct and sequential Deep behavior consistent,
reduces needless retrieval, and keeps disagreements inspectable.

## 2026-08-27 — Keep deterministic identity and financial derivations conservative

**Status:** Implemented

**Decision:** Treat SEC ticker/CIK/issuer association separately from unsupported
security type and active-listing conclusions. Preserve dated SEC former-name
metadata, reject cross-domain or returned-ticker identity disagreement, and leave
exhaustive ticker lineage to Deep. Populate free cash flow only from aligned
operating cash flow and capital expenditures. Populate total debt only from
aligned current and non-current components. Stale, conflicting, partial, or
unit-incompatible liquidity inputs remain Limited or Unknown; runway is not
calculated without current comparable cash and positive burn evidence.

**Why:** Calling OCF free cash flow, calling one debt component total debt, or
using stale/partial liquidity as current can falsely reassure the user. These are
evidence-correctness rules; methodology 2.0.0 now consumes them as implemented
by Issue #52.

## 2026-08-27 — Enforce Fast limits with one provider-neutral controller

**Status:** Implemented from the approved operating policy

**Decision:** Every Fast request uses one monotonic controller with a 20-second
hard ceiling, a 500-millisecond finalization reserve, and a shared cost ledger.
Normal runs use $0.03; the $0.05 difficult class requires an explicit internal
choice and is never an automatic escalation. SEC and synthesis receive the same
cancellation signal. Every paid source must reserve a finite maximum charge
before it starts and commit measured cost afterward.

Completed evidence survives cancellation. Unfinished work remains Limited or
Unscored, while operations metadata records the stop reason, remaining time and
money, per-source status, and final score-state counts. Deep retains its separate
budget.

**Why:** Independent per-call timeouts and post-hoc cost estimates could exceed
the product's total limits. A provider-neutral reservation contract lets later
news and market sources participate without coupling orchestration to a vendor.

## 2026-08-26 — Assign bounded Fast sources by evidence responsibility

**Status:** Source responsibilities remain accepted; single-provider selection detail superseded by the 2026-08-27 adapter-pool decision

**Decision:** Fast uses a provider-neutral bounded source graph. SEC, exchange,
issuer, original-newswire, and original-reporting sources retain authoritative
responsibility for the facts they originate. Approved external adapters may
provide bounded current-news discovery and market data. A material event
found through a secondary service is promoted to an original source when
reasonably available; missing coverage remains `Limited` or `Unscored`.
Open-ended web search remains Deep-only.

Provider selection was intentionally deferred here and later resolved narrowly
for Alpha Vantage and Twelve Data Basic. Massive, Alpaca, Benzinga, TipRanks,
and other candidates still require a separate owner decision.

**Why:** Source responsibility is stable even when vendors change. A small,
known request graph can terminate within Fast's shared limits while preserving
primary attribution and avoiding false reassurance from missing discovery data.
The detailed map and seven score evidence contracts are recorded in
`FAST_SOURCE_STRATEGY.md`.

## 2026-08-26 — Make Fast an evidence-backed seven-score report

**Status:** Accepted by product owner

**Decision:** Fast supports the owner's reject-or-continue research decision by
presenting seven separate priority scores: historical dilution severity, future
dilution likelihood, potential dilution impact, reverse-split risk, financial
health, catalyst strength, and near-term setup quality. It does not produce an
automatic combined verdict. Long-term company quality may remain primarily a
Deep-stage score.

Each numeric score requires sufficient trustworthy evidence. A progressive card
shows `Researching` while work continues and settles as scored, `Unscored`, or
`Limited`; provisional numbers are prohibited.

**Why:** Evidence alone confirmed useful red flags in live work, but the owner
primarily needs concise, trustworthy component scores. A combined verdict would
prematurely encode an unapproved weighting philosophy.

## 2026-08-26 — Preserve detailed scores and simplify Fast presentation

**Status:** Implemented by Issue #53

**Decision:** Keep the internal report and methodology on a 0–10 scale. Convert
Fast cards to a 0–5 star display, including half-stars when useful. More stars
mean more risk on risk cards and stronger quality on financial, catalyst, and
setup cards. Each card leads with a short evidence-based reason; detailed
calculations and sources remain inspectable below.

**Why:** The internal scale preserves calibration and comparison precision while
the star presentation makes the Fast dashboard quickly scannable without
rewriting the report contract solely for visual design.

## 2026-08-26 — Bound the complete Fast pipeline by cost and elapsed time

**Status:** Accepted by product owner

**Decision:** Terminate Fast at the earlier of a 20-second end-to-end ceiling or
the applicable cost ceiling. Target approximately $0.01–$0.03 normally, use
$0.03 as the normal maximum, and allow up to approximately $0.05 for a difficult
ticker. Unfinished components settle unresolved. First-result latency remains a
measured usability signal, not a milestone gate.

**Why:** Predictable spend, trustworthy evidence, and reliable settlement matter
more than forcing a score to appear within a few seconds. The previous limits
did not cover the full evidence-first pipeline.

## 2026-08-26 — Use bounded non-SEC discovery without weakening evidence

**Status:** Accepted by product owner

**Decision:** Keep SEC evidence primary for filing-based risks, but allow bounded
exchange, company, original-newswire, financial-news, search-discovery, and
market-context sources when they improve current catalyst and score coverage.
Discovery services and AI summaries cannot be the sole evidence for a material
score. Evaluate providers for speed, coverage, feed/API availability,
reliability, attribution, cost, licensing, and integration effort before making
a recommendation. Provider selection, payment, scraping, or integration
requires explicit owner approval.

**Why:** SEC-only Fast cannot reliably establish the current catalyst, price
context, or several priority scores, while open-ended web scavenging conflicts
with the approved time and cost limits.

## 2026-08-26 — Recalibrate scoring against evidence and relative risk

**Status:** Implemented by Issue #52

**Decision:** Treat deterministic methodology 1.0.0 as a historical baseline,
not a fixed scoring philosophy. Redesign formulas around Fast's purpose and
evidence limits, then validate material-fact recall, interpretation, explanation
fidelity, owner-reviewed score ranges, and relative ordering across real
tickers. Exact numeric agreement is not required.

The reliability gate is approximately 95% overall material-risk recall,
approximately 90% recall in every adequately sampled critical category, and no
known severe misleading miss. Sparse categories report sample size and
uncertainty.

**Why:** Several initial formulas use convenient proxies or evidence requirements
that do not represent the intended risk construct or fit bounded Fast research.

## 2026-08-26 — Make Deep extend Fast and reorder comparison

**Status:** Accepted by product owner

**Decision:** Deep automatically builds the Fast foundation when needed, reuses
completed Fast evidence, and prioritizes unresolved or low-confidence work.
Comparison remains planned but moves behind a Fast reliability milestone that
establishes stable evidence and scoring behavior.

**Why:** Repeating Fast work wastes time and cost, while building comparison on
provisional scores would harden untrusted semantics into later workflows.

## 2026-08-25 — Keep deep research deliberate and report operations separately

**Status:** Accepted; Fast operating limits superseded on 2026-08-26

**Decision:** Default to a bounded fast request and require an explicit user
action for the larger deep-stage budget. Return latency, provider usage,
web-search count, estimated cost, and budget status outside the versioned report
contract. Keep completion and coverage states authoritative for research
completeness.

**Why:** Automatic escalation can silently increase latency and spend, while an
operationally cheap response is not necessarily evidence-complete. Separate
telemetry makes both dimensions inspectable.

**Consequence:** The original 15-second/5,000-token Fast limits are historical.
The approved Fast policy now covers the complete pipeline and terminates at the
earlier of 20 seconds or its cost ceiling. Deep remains deliberate, but must
build and extend Fast rather than start independently.

## 2026-08-25 — Add bounded filing-text extraction to evidence-first Fast

**Status:** Accepted by product owner

**Decision:** After submissions discovery, open at most four selected primary
SEC filing documents and at most one directly linked material exhibit. Use the
existing stack to normalize HTML text and confirm only explicit material-risk
phrases and terms. Distinguish actual/agreed issuance from shelf registration
capacity, and warn when the newest standardized financial period is over 180
days old.

**Why:** Live SWVL evidence showed that metadata-only discovery was fast and
cheap but left the most decision-relevant filing substance unresolved.

**Consequence:** Cold Fast normally makes up to seven SEC requests, or eight
when a wrapper filing requires one material exhibit. Ambiguous phrasing,
unopened history, complex tables, custom XBRL, and attachment relationships stay
Limited/Unknown. No parser dependency was added and the 95% recall target remains
unclaimed.

## 2026-08-25 — Make Fast evidence-first and keep AI non-authoritative

**Status:** Accepted by product owner

**Decision:** Stop using OpenAI hosted web search for production Fast. Retrieve
SEC identity, submissions, recent filing metadata, and Company Facts directly;
normalize dated evidence records; render deterministic progress; then optionally
run a small tool-disabled classification over only those records. Cache the SEC
ticker map for six hours and issuer data for five minutes, coalesce concurrent
fetches, identify the client, and stay below SEC fair-access request rates. Seed
Deep with the completed Fast packet.

**Why:** After schema reduction, three independent compact SWVL hosted-search
calls all reached the exact 20-second timeout without a response object. Hosted
search—not one domain schema—was the remaining Fast bottleneck.

**Consequence:** Cold Fast normally makes three free SEC requests and warm Fast
makes none. The bounded first phase confirms identity/CIK, filing discovery,
former-name metadata, and standardized financial facts. Filing-text-dependent
risks and non-SEC news remain Limited/Unknown until later evidence supports a
parser or data-provider decision. The 95% recall target remains unclaimed.

## 2026-08-25 — Size Fast domains from compact evidence fixtures

**Status:** Superseded on 2026-08-25 by evidence-first Fast

**Decision:** Keep the parallel identity-gated domains and 20-second hard bound.
Remove repeated full identity objects outside Capital, construct duplicated
catalyst/news and financial-context sections server-side, cap each domain at
four sources, and set output ceilings of 1,800 Capital, 2,200 Catalyst, and
2,000 Financial tokens. Record per-domain usage, searches, and estimated cost,
including incomplete responses that cannot be parsed.

**Why:** The first live parallel run returned Capital and Financial at exactly
1,200 tokens with `max_output_tokens`, while Catalyst timed out. Representative
compact fragments are roughly 774, 1,424, and 1,245 serialized tokens, leaving
35–57% headroom. The API ceiling includes visible and reasoning output, so a
ceiling equal to expected JSON size is unsafe.

**Consequence:** The combined 6,000-token ceiling is a failure boundary, not a
target; normal visible output is expected around 2,500–4,000. Missing,
truncated, timed-out, and identity-conflicting domains remain Pending/Unknown.
Catalyst stays bounded at 20 seconds; one slow hosted search may remain Pending,
and Deep remains the deliberate enrichment path.

## 2026-08-25 — Assemble Fast from independent identity-gated domains

**Status:** Superseded on 2026-08-25 by evidence-first Fast

**Decision:** Replace the single Fast Responses API request with three parallel,
independently bounded evidence calls: identity/capital history,
catalyst/listing risk, and immediate financial risk. Require current ticker,
issuer name, and CIK agreement before merging separate-domain evidence. Build
the v4 report and deterministic scores server-side. Stream each validated
partial assembly when cleanly available. A failed, missing, malformed, or
identity-conflicting domain remains Pending/Unknown and cannot become favorable
evidence. Target first useful output in 3–10 seconds, all domains in 15–20
seconds, and hard-bound each Fast operation at 20 seconds.

**Why:** A clean SWVL request still reached 30 seconds with no response object
after provider score removal, compact Fast schema work, low-context search, and
a four-call search cap. One model-managed request still combined several
dependent searches and thousands of structured tokens, so a single slow phase
discarded every otherwise useful domain.

**Consequence:** Fast makes three provider requests and may cost slightly more
in fixed/search overhead, but gains parallelism, fault isolation, progressive
results, and explicit domain coverage. Its initial combined output ceilings totaled 3,400
tokens across at most five hosted searches. Deep remains the broader full-report
workflow for exhaustive lineage, detailed financial history, corroboration,
analogues/reactions, and conflict resolution. Live latency/cost still require an
approved measured run.

## 2026-08-25 — Separate the Fast latency target from hard cancellation

**Status:** Superseded by the 2026-08-26 end-to-end Fast budget decision

**Decision:** Keep 3–10 seconds as the Fast latency target, mark valid later
responses over budget, allow a bounded 20-second grace period, and cancel at 30
seconds. Cap Fast at four low-context hosted web searches and defer exhaustive
lineage discovery, corroboration, detailed financial history, and catalyst
analogues to Deep with explicit partial/pending limitations. Preserve the
5,000-token output ceiling and zero automatic retries.

**Why:** A live SWVL request reached the former 15-second SDK timeout during
`responses.create` with no response object. That timeout covered the complete
hosted search, generation, and body-read operation, while Fast still had an
unbounded search plan spanning seven evidence domains. Five seconds of grace
beyond the product target was not a reliable failure boundary.

**Consequence:** Returning between 10 and 30 seconds does not falsely satisfy
the target: operations metadata records `within_latency_target=false`. An SDK
abort still cannot salvage provider partial output because no response object
has crossed the application boundary. Deep remains deliberate and separately
bounded at 60 seconds and ten medium-context searches.

## 2026-08-25 — Bound provider output by stage and derive scores server-side

**Status:** Accepted

**Decision:** Do not request provider-authored score objects. Bound claim,
source, history, warning, and prose volume in both stages. Fast research defers
detailed catalyst analogues and reaction windows explicitly; Deep may expand
them within larger limits. Preserve the 5,000/10,000 output ceilings.

**Why:** Three failed SWVL requests consumed 19,960 of a possible 20,000 output
tokens. The old complete fixture itself required about 5,846 compact JSON tokens,
including about 2,206 score tokens that the server discarded. The installed SDK
also exposes timeout subclasses with `.name === "Error"`, defeating name-only
classification.

**Consequence:** Normal Fast output is expected around 3,000–4,500 tokens and
Deep around 4,000–7,500, while full deterministic scores remain present in the
validated browser report. Diagnostics classify SDK timeouts by constructor and
record safe lifecycle/response/usage fields without logging provider content.

## 2026-08-25 — Separate provider output constraints from server validation

**Status:** Accepted

**Decision:** Derive the Responses API output schema from the authoritative
report schema by removing composition keywords unsupported by OpenAI Structured
Outputs. Continue validating returned reports against the unchanged full JSON
Schema and semantic rules at the Express boundary.

**Why:** Passing the expanded v4 domain schema directly caused live-only request
rejection, while fixture-backed mock mode bypassed provider schema processing.

**Consequence:** Provider compatibility cannot silently relax application
validation. Safe terminal diagnostics retain only error category, numeric HTTP
status, provider code, and error type; provider messages and request data remain
excluded.

## 2026-08-25 — Recalculate scores deterministically at the server boundary

**Status:** Accepted

**Decision:** Version the report contract at 4.0.0 and replace upstream score
values with a versioned deterministic methodology before final validation. The
current endpoint uses 2.1.0; 2.0.0 and 1.0.0 remain historical baselines. Every score shows
its construct, direction, horizon, confidence, components, weights, explanation,
and evidence links. Required uncertainty leaves a score null. Near-term setup
uses a five-trading-day evidence horizon and excludes long-term company quality.
Optional roll-ups may combine only same-direction scores, expose all components,
and become null when any component is unresolved.

**Why:** Model-authored numbers are not reproducible. Deterministic components
make changes testable and prevent missing evidence or mixed horizons from being
hidden inside a persuasive number.

## 2026-08-25 — Preserve periods and applicability in financial context

**Status:** Accepted

**Decision:** Version the report contract at 3.0.0 and require decision-focused
financial context for cash, cash burn, revenue, profitability, free cash flow,
debt, and going-concern evidence. Confirmed values retain units and statement
periods; trends retain comparison periods. Material liquidity, burn, leverage,
and going-concern warnings carry severity and rank prominently. Missing,
non-comparable, or security-inapplicable data stays null and unscored.

**Why:** Financial numbers without their period or comparison basis can mislead,
while absent operating-company data—especially for nonstandard securities—must
not look like low risk or healthy finances.

## 2026-08-25 — Keep catalyst evidence structured and comparisons bounded

**Status:** Accepted

**Decision:** Version the report contract at 2.0.0 and require a catalyst
assessment that separates recency, specificity, credibility, novelty, and
potential significance from long-term company quality. Historical analogues are
issuer-specific, explain both comparison basis and limitations, and use sourced
reaction windows. No reliable analogue produces an explicit unknown with no
invented history. Near-term implications remain qualitative and confidence
qualified; numeric probability predictions and trade instructions are rejected.

**Why:** A prior price reaction can inform context without establishing a
repeatable outcome. Keeping inputs, limitations, and uncertainty visible avoids
turning a weak comparison into false predictive precision.

## 2026-08-25 — Group the fast dashboard by decision meaning

**Status:** Superseded by the approved Issue #53 hierarchy

**Decision:** Lead the dashboard with coverage and ranked material findings,
then keep capital-structure risk, longer-term company context, and near-term
catalyst/setup scores in explicitly named groups. Always show state labels and
explanations in text, render all report sections, and resolve claim references
to dated source links.

**Why:** A compact result must speed review without hiding uncertainty or
collapsing unlike score concepts into a visually persuasive but ambiguous
summary.

**Consequence:** Color is supplemental rather than the only state signal.
Unknown, limited, pending, and not-applicable results remain readable and
unscored. The dependency-free browser renderer uses the existing validated
report contract and safe external-link attributes.

**Superseding detail:** The current hierarchy places identity, compact research
status, and current catalyst/market context in a wide-screen left column, with
one unified compact Fast score summary in a right sidebar. The same sections
stack on smaller screens. Honest financial charts, a separate explanation
block, expandable detailed evidence, and the source library. Direct methodology components may be
shown as financial sub-metric stars; revenue, cash, or cash-burn rows remain
Unscored until they have an independent trustworthy score. Long-term company
quality is Deep-oriented rather than a primary Fast row.

**Financial detail refinement:** Financial Health owns the detailed explanation
for revenue, profitability, debt, free cash flow, cash, and cash burn. Those
supporting inputs are not repeated as six independent explanation dropdowns.
Their charts use bounded source-linked observations only when metric definition,
unit, currency, and period length agree; otherwise the chart remains single-period,
Limited, or unavailable.

SEC-reported shares outstanding may appear beside the financial charts as a
display-only capital-structure series. Its point-in-time observations and visible
window change remain distinct from float and potential dilution and do not alter
methodology 2.0.0.

**Grouped annual-chart refinement:** The primary financial display uses Revenue,
Net income / loss, Cash, Total debt, Operating cash flow, Free cash flow, and
Shares outstanding. It groups these into Income statement, Balance sheet, Cash
flow, and Capital structure blocks and prefers up to four source-linked annual
filing periods. Cash burn remains an internal runway/scoring input, not a primary
chart. This presentation change does not alter methodology 2.0.0.

## 2026-08-25 — Require explicit evidence when carrying issuer history

**Status:** Accepted

**Decision:** Resolve the current security and issuer before historical research.
Treat prior ticker/name identities as confirmed only when sourced confirmed
claims provide bounded effective dates and high or medium linkage confidence.
Require dated split, dilution, offering, compliance, and warning items within a
prior-identity period to reference that linkage claim.

**Why:** Searching only the current ticker can hide material history, while
automatically joining a merely similar predecessor can attach another issuer's
risks. The report must make both the history and the join evidence inspectable.

**Consequence:** The server rejects carried history with missing or unresolved
lineage. Ambiguous predecessors remain `unknown` or `limited_coverage`, and the
live research prompt follows the same rule. No new provider or schema version is
required.

## 2026-08-24 — Keep evidence states semantically distinct

**Status:** Accepted

**Decision:** Treat `not_found` as the result of a bounded evidence search,
`unknown` as unavailable, inadequate, conflicting, or unresolved evidence,
`not_applicable` as a security/context-specific exclusion, and
`limited_coverage` as completed work with named gaps. Require partial and pending
reports to declare structured limitations. Numeric scores may use only sourced
confirmed or bounded-not-found claims.

**Why:** Missing or inapplicable evidence must not be presented as historical
absence, zero risk, favorable quality, or false completeness.

**Consequence:** The server rejects invalid state combinations and unsafe score
inputs while accepting semantically valid partial reports. The prompt carries
the same definitions and prefers an explicit partial result to guessing.

## 2026-08-24 — Enforce claim-linked source quality at the report boundary

**Status:** Accepted

**Decision:** Require confirmed and bounded `not_found` report records and scores
to reference sourced atomic claims. Keep claim/source links bidirectional; reject
malformed or impossible source metadata and high-confidence secondary evidence.
Represent materially conflicting evidence as `unknown` or `limited_coverage`
rather than choosing an unsupported conclusion.

**Why:** Schema-shaped citations are not sufficient unless each conclusion is
traceable to dated, typed, inspectable evidence with source quality visible.

**Consequence:** Live output that omits evidence or overstates secondary evidence
fails server validation. The prompt prefers SEC and exchange evidence, requests
web-search source metadata, and instructs the model not to fabricate missing
citations. Automated fact checking remains outside this issue.

## 2026-08-24 — Bound fast-stage provider requests without automatic retries

**Status:** Accepted

**Decision:** Apply a 15-second timeout and zero automatic SDK retries to the
current synchronous fast-stage Responses API call. Map timeout, rate-limit,
authentication, connection/service, refusal, malformed, and unusable outcomes
to stable non-sensitive application errors. No deep-stage request exists yet.

**Why:** A finite deadline keeps the page recoverable, while automatic retries
can extend latency and duplicate paid model and web-search work without knowing
whether the first attempt was charged or still running.

**Consequence:** Users may manually retry after a controlled error. Issue #15
will measure representative latency and cost before changing stage budgets or
introducing any explicitly bounded retry policy.

## 2026-08-24 — Validate structured research at the server boundary

**Status:** Accepted

**Decision:** Request stock report version 1.0.0 through the Responses API JSON
Schema format with API strict mode disabled, then require the repository's full
Draft 2020-12 and semantic validator before returning success. Represent
refused, incomplete, malformed, and otherwise unusable provider output with
stable non-sensitive application errors.

**Why:** Contract v1 uses schema features beyond the API strict subset, while
the server, browser, comparison, and saved-history work still require one
authoritative validated object boundary.

**Consequence:** Both real and mock research clients return report objects, not
display strings. The browser renders temporary formatted JSON until the fast
dashboard is implemented. Later source-quality and evidence-state issues refine
report contents without changing this validation boundary.

## 2026-08-24 — Validate ticker syntax and real-app configuration at boundaries

**Status:** Accepted

**Decision:** Accept normalized ticker identifiers containing 1–15 letters or
digits with single period or hyphen separators. Treat this as syntax only, not
proof of listing or support. Require a nonblank `OPENAI_API_KEY` before real-app
startup and allow its default port 3000 to be overridden by a validated `PORT`.
Keep token-free mock mode independently fixed at port 3001.

**Why:** Predictable boundary validation prevents malformed requests and
apparently healthy but unusable startup while preserving the broad security
universe and simultaneous mock testing.

**Consequence:** Later identity research must distinguish valid-but-unknown
securities from malformed input. Startup and request errors must remain stable
and must never echo credentials.

## 2026-08-24 — Keep manual mock mode separate from OpenAI startup

**Status:** Accepted

**Decision:** Run manual mock testing through `npm run dev-test` on local port
3001, a dedicated entry point that injects the validated `ACME` fixture and never
imports or constructs the OpenAI client. Keep the real application on local port
3000, and expose non-sensitive runtime metadata so the UI can identify mock mode
and its supported ticker.

**Why:** Frontend and integration work needs a deterministic browser flow that
cannot spend tokens accidentally, can run beside the real server, and clearly
communicates that its data is fictional test data.

**Consequence:** Future response-contract changes must keep the `ACME` demo path
aligned with the live endpoint shape while preserving strict startup separation.

## 2026-08-24 — Isolate backend tests through dependency injection

**Status:** Accepted

**Decision:** Create the Express application separately from process startup,
inject the research client, use Node's built-in test runner, and expose report
validation and fixture loaders as reusable modules.

**Why:** Backend behavior must be testable without API credentials, paid calls,
external network access, or lingering server processes. The built-in runner is
sufficient and avoids another test dependency.

**Consequence:** Later endpoint tickets should pass fakes through the research
client boundary and use the shared report fixtures and validator. Actual timeout
and provider-error policy remains owned by its dedicated issue.

## 2026-08-24 — Version reports with an explicit JSON Schema contract

**Status:** Accepted

**Decision:** Use JSON Schema Draft 2020-12 and a semantic validation pass for
stock-report contract version 1.0.0. Keep all initial report sections present,
make evidence states explicit, require null values for unscored states, preserve
distinct scoring constructs and horizons, and use bidirectional claim/source
references.

**Why:** The server, prompt, frontend, comparison, and saved-history work need a
stable boundary that cannot confuse missing evidence with low risk or confirmed
absence.

**Consequence:** Breaking semantic or required-field changes require a major
contract version. Schema-valid output still requires factual, evidence-quality,
and calibration evaluation in later issues.

## 2026-08-24 — Keep planning documentation in the repository

**Status:** Accepted

**Decision:** Maintain the product definition, roadmap, decision log, and Codex
instructions as version-controlled Markdown files beside the code.

**Why:** The project is early and maintained by a small team. Repository-local
documents are easy to review with code, retain change history, and avoid the
administrative cost of a separate planning system.

**Consequence:** If coordination needs later outgrow Markdown, individual roadmap
items may move to an issue tracker while product and architectural context remain
in the repository.

## 2026-08-24 — Separate roadmap content from Codex instructions

**Status:** Accepted

**Decision:** Use `AGENTS.md` for durable engineering and research-quality rules.
Use `docs/ROADMAP.md` for priorities and status.

**Why:** Codex reads `AGENTS.md` as instructions before work. Frequently changing
backlog content would make those instructions noisy and harder to maintain.

## 2026-08-24 — Prioritize trustworthy reports

**Status:** Accepted

**Decision:** Structured results, source traceability, dates, and explicit
uncertainty are the first milestone after proving the search flow.

**Why:** Saved searches, comparison, and visual polish are less valuable until
the underlying research is consistent and verifiable.

## 2026-08-24 — Keep the initial product non-advisory

**Status:** Accepted

**Decision:** Present evidence and risk signals without personalized buy, sell,
position-sizing, or price-target recommendations.

**Why:** The immediate product problem is faster evidence gathering. Investment
advice introduces a different product promise and additional safety, legal, and
trust considerations.

## 2026-08-24 — Use GitHub Issues as the executable backlog

**Status:** Accepted

**Decision:** Keep milestone direction in `docs/ROADMAP.md` and manage bounded,
actionable work as GitHub Issues. Each implementation issue should define its
outcome, scope, acceptance criteria, exclusions, dependencies, and verification.

**Why:** Issues can be selected and launched from a phone, discussed without
changing the repository, and linked directly to branches, commits, and pull
requests. Separating them from the roadmap avoids maintaining two detailed
backlogs.

**Consequence:** Material changes to milestone progress must still be reflected
in the roadmap when the corresponding issues are completed.

## 2026-08-24 — Autonomously merge routine completed tickets

**Status:** Accepted

**Decision:** Codex may implement a bounded issue on a dedicated branch, verify
it, review the completed diff, open a pull request, and merge it without manual
review when all acceptance criteria and checks pass.

**Why:** The project owner wants work to continue remotely without needing to
approve every routine code change. A pull request still provides an audit trail
and a clean rollback point.

**Exceptions:** Manual approval remains required for production deployment,
secrets, authentication or authorization, billing, destructive data or
infrastructure operations, unapproved production dependencies, and material
scope expansion. Failed checks, incomplete acceptance criteria, or unresolved
ambiguity block an autonomous merge.

## 2026-08-24 — Optimize for a personal post-screening research workflow

**Status:** Accepted

**Decision:** Build Stock Research primarily as a personal, post-screening
due-diligence tool. It should help the owner investigate a ticker flagged by an
external volume or catalyst screener and decide whether to reject it or continue
deeper research. It will not discover stocks, execute trades, or recommend
entries and exits.

**Why:** The time-sensitive problem is not finding candidates. It is rapidly
reconciling catalyst quality, company history, financial context, and material
risks after a candidate appears.

## 2026-08-24 — Prefer material-risk recall and explicit uncertainty

**Status:** Accepted

**Decision:** Optimize research behavior to avoid missing material risks. Prefer
an additional ranked warning, `Unknown`, or `Limited coverage` over false
reassurance. Require material factual conclusions to be traceable to evidence.

**Why:** Missing dilution, reverse-split patterns, going-concern warnings,
compliance trouble, accounting issues, or comparable material risks is more
harmful than requiring the user to inspect an additional warning.

## 2026-08-24 — Separate scoring dimensions and time horizons

**Status:** Accepted

**Decision:** Keep historical severity, future likelihood, and potential impact
as visible risk components. Keep near-term catalyst or setup quality separate
from longer-term company quality. Optional roll-ups must preserve components,
evidence, uncertainty, and explanations.

**Why:** Combining unlike concepts hides important tradeoffs and can produce
misleading confidence. Weak companies can have strong short-term catalysts, and
strong companies can have poor near-term setups.

## 2026-08-24 — Follow issuer history across identity changes

**Status:** Accepted

**Decision:** When reliable evidence connects prior and current identities,
carry material issuer history across ticker changes, company-name changes, and
rebrands. Show prior identities, effective dates, evidence, and linkage
confidence.

**Why:** A company must not appear to have a clean history merely because its
public identifier changed.

## 2026-08-24 — Use a fast view with optional deeper research

**Status:** Superseded by the 2026-08-26 Fast operating policy

**Decision:** Target a compact decision view in approximately 3–10 seconds and
near or below $0.10 for a normal completed report. Allow deeper research to take
longer or cost more when the user requests it or the case is unusually complex.

**Why:** The tool is used in fast-moving situations, while comprehensive issuer
history and evidence reconciliation may not reliably fit into one synchronous
request.

## 2026-08-24 — Prioritize comparison after trustworthy reports

**Status:** Refined on 2026-08-26; comparison remains next after Fast reliability

**Decision:** After the trustworthy fast report, prioritize decision-focused
side-by-side ticker comparison, followed by saved report history and automatic
refresh or change detection.

**Why:** The external screener can surface several candidates simultaneously.
Normalized comparison of their most important differences is more valuable than
placing complete reports side by side.

## 2026-08-25 — Evaluate dated facts and app reliability separately

**Status:** Accepted

**Decision:** Maintain a versioned representative set of dated, fact-level
evidence expectations rather than exact report prose. Report material-risk
recall overall and by category with source quality, factual support, issuer
lineage, uncertainty, clarity, latency, and cost. Track deterministic application
failures separately from successful reports that miss research facts. Paid live
runs require explicit approval and a predeclared bound; token-free fixtures are
the routine calibration path.

**Why:** Stable evidence expectations can reveal regressions without rewarding
one phrasing or hiding operational failures inside research-quality scores.

## 2026-08-24 — Maintain approved product context autonomously

**Status:** Accepted

**Decision:** Codex should automatically record explicit owner decisions and
confirmed implementation or evaluation findings in the appropriate repository
documents and GitHub issue priorities or dependencies. Codex must request review
before adopting an unapproved material change to vision, scoring philosophy,
major workflows, or priorities.

**Why:** The repository should remain aligned without requiring separate
documentation requests, while product direction remains owner-controlled.

## 2026-08-27 — Use a free-first bounded Fast source stack

**Status:** Accepted and implemented by Issue #51

**Decision:** Keep SEC, Nasdaq Trader, issuer filings/exhibits, and attributable
original releases authoritative. Use Alpha Vantage's free API only for personal
deterministic end-of-day market context and ticker-specific news discovery.
Provider summaries, sentiment, and article bodies are not supplied to OpenAI.
Discovery alone cannot support a material score; missing, failed, or
quota-blocked work remains Limited or Unscored. No paid plan is approved.

**Why:** The owner prefers public authoritative sources and a free non-AI data
layer when practical, while allowing bounded OpenAI cost for classification.
This preserves predictable termination and avoids a recurring data subscription
before evaluation demonstrates that paid coverage is necessary.

## 2026-08-27 — Version Fast scoring around evidence-sufficient constructs

**Status:** Accepted and implemented by Issue #52

**Decision:** Replace executable scoring methodology 1.0.0 with 2.0.0 while
preserving 1.0.0 as a documented comparison baseline. Score actual dilution from
share-base change rather than registrations, potential dilution from supported
share terms and a denominator rather than proceeds versus cash, catalyst strength
only from promoted primary/original evidence, and near-term setup from catalyst
plus bounded EOD price/volume context rather than historical analogues. Keep
long-term company quality primarily Deep and unscored in Fast.

**Why:** A number whose inputs do not match its label can falsely reassure or
materially alter a reject-or-continue decision. Strict evidence gates are more
useful than broad score coverage built from misleading proxies.

**Consequence:** Fast will show more Limited/Unscored results until retrieval
provides quantified share terms, current comparable financials, promoted
catalysts, and sufficient EOD baselines. Issue #53 changed their presentation
without changing these meanings; Issue #55 must measure real-ticker coverage before reliability
targets are claimed.

## 2026-08-27 — Score financial trends only from comparable SEC evidence

**Status:** Accepted and implemented as methodology 2.1.0

**Decision:** Add independent higher-is-stronger revenue, net-income/loss, total
debt, free-cash-flow, cash, and operating-cash-flow trend scores. Each compares
the issuer only with its own compatible SEC-reported history and requires at
least two observations; three or more increase confidence. Company Facts and
SEC-filed reports/exhibits are the only score-authoritative financial sources.
Alpha Vantage remains news discovery and EOD market context only. Shares
outstanding remains capital-structure evidence for dilution constructs, not a
generic higher-is-stronger score. The overall Financial Health formula remains
the 2.0 construct and does not consume the six sub-scores, avoiding circularity.

**Why:** Borrowing stars from overall-health components obscured the difference
between current condition and independent trend. Secondary financial values or
one observation could also create false confidence. Version 2.1.0 makes the UI
semantics explicit while preserving the stricter 2.0 philosophy and baseline.

## 2026-08-27 — Fail closed across reporting durations and corporate actions

**Status:** Accepted corrective implementation from Issue #55 calibration

**Decision:** Treat facts with different start dates or durations as distinct
even when they share an end date and filing. Prefer newer comparable interim
financial flows over older annual trends without mixing cadences. A later SEC
non-reliance or restatement invalidates affected flow scores. Historical share
series must be normalized with confirmed completed split factors; proposed or
authorized reverse splits do not count as completed history, and unexplained
large share discontinuities remain Limited. Fast may inspect a bounded set of
SEC documents, using dedicated category slots with an overall limit of twelve, to retain
corporate-action and accounting coverage.

**Why:** The initial real-ticker calibration showed that duration collisions,
stale annual precedence, missed accounting invalidation, and unadjusted stock
splits could omit material facts or create severe false reassurance. These rules
preserve the existing evidence-first methodology while making its deterministic
inputs match the economic events they describe.

## 2026-08-27 — Use event-specific filing semantics and one scoreable-series contract

**Status:** Accepted corrective implementation after Issue #55 Batch 2

**Decision:** A non-reliance event requires Item 4.02 or explicit prior-period
invalidation/restatement language; control weakness, estimates, and
forward-looking boilerplate are separate evidence classes. Completed splits
require an authoritative action statement and ratio. Resolved exchange
deficiencies remain historical evidence and do not create active listing
pressure. When an unresolved corporate action makes a normalized shares series
unsafe to score, its observations are removed from the scoreable series rather
than retained under a contradictory Limited state.

**Why:** Batch 2 showed that broad language matching and mixed settlement
semantics could both erase valid financial history and make a safe partial
report invalid. Dedicated bounded retrieval slots improve the chance of opening
older event filings without introducing open-ended search.

## 2026-08-27 — Resolve stale tickers through a bounded SEC identity registry

**Status:** Accepted corrective implementation from Issue #55 sparse calibration

**Decision:** When the current SEC ticker map has no exact match, Fast may use a
curated SEC-backed mapping from an exact requested ticker to one CIK, current
security identity, and dated authoritative filing seeds. No fuzzy name matching
or cross-issuer inference is allowed. The evidence packet records requested and
current tickers plus `current`, `renamed`, or `otc` resolution state. Delisted
and OTC listing states remain explicit. Unmapped identifiers terminate as
Limited rather than Pending.

**Why:** Current ticker maps intentionally omit many former, delisted, and OTC
symbols. A small reviewed registry preserves the hard identity gate and bounded
retrieval while making corrections auditable.
