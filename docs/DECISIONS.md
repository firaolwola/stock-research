# Decision log

Record consequential decisions here so future work preserves their context. Keep
entries short and append new decisions rather than rewriting history.

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
