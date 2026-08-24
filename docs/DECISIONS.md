# Decision log

Record consequential decisions here so future work preserves their context. Keep
entries short and append new decisions rather than rewriting history.

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

## 2026-08-24 — Maintain approved product context autonomously

**Status:** Accepted

**Decision:** Codex should automatically record explicit owner decisions and
confirmed implementation or evaluation findings in the appropriate repository
documents and GitHub issue priorities or dependencies. Codex must request review
before adopting an unapproved material change to vision, scoring philosophy,
major workflows, or priorities.

**Why:** The repository should remain aligned without requiring separate
documentation requests, while product direction remains owner-controlled.
