# Decision log

Record consequential decisions here so future work preserves their context. Keep
entries short and append new decisions rather than rewriting history.

## 2026-08-25 — Assemble Fast from independent identity-gated domains

**Status:** Accepted by product owner

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
results, and explicit domain coverage. Its combined output ceilings total 3,400
tokens across at most five hosted searches. Deep remains the broader full-report
workflow for exhaustive lineage, detailed financial history, corroboration,
analogues/reactions, and conflict resolution. Live latency/cost still require an
approved measured run.

## 2026-08-25 — Separate the Fast latency target from hard cancellation

**Status:** Accepted

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
values with scoring methodology 1.0.0 before final validation. Every score shows
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

**Status:** Accepted

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

**Status:** Accepted

**Decision:** Target a compact decision view in approximately 3–10 seconds and
near or below $0.10 for a normal completed report. Allow deeper research to take
longer or cost more when the user requests it or the case is unusually complex.

**Why:** The tool is used in fast-moving situations, while comprehensive issuer
history and evidence reconciliation may not reliably fit into one synchronous
request.

## 2026-08-24 — Prioritize comparison after trustworthy reports

**Status:** Accepted

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
# 2026-08-25 — Keep deep research deliberate and report operations separately

**Status:** Accepted

**Decision:** Default to a bounded fast request and require an explicit user
action for the larger deep-stage budget. Return latency, provider usage,
web-search count, estimated cost, and budget status outside the versioned report
contract. Keep completion and coverage states authoritative for research
completeness.

**Why:** Automatic escalation can silently increase latency and spend, while an
operationally cheap response is not necessarily evidence-complete. Separate
telemetry makes both dimensions inspectable.

**Consequence:** Fast reports use a 15-second failure deadline and 5,000 output
tokens; deep reports use 60 seconds and 10,000. Neither retries automatically.
Costs use a dated pricing snapshot and become unknown when provider usage is
missing. Live calibration remains subject to explicit bounded approval.
