# Repository guidance

## Product

Stock Research helps an individual trader identify important stock risks before
doing deeper research. It is a research aid, not financial advice.

Read `docs/PRODUCT.md` and `docs/ROADMAP.md` before making material product or
architecture changes.

## Current architecture

- Node.js and Express backend in `server.js`
- Static HTML, CSS, and browser JavaScript in `public/`
- OpenAI Responses API with web search
- Secrets loaded from `.env` and kept on the server

Keep the architecture simple while the product is still being validated.

## Research quality

- Prefer SEC filings, exchange notices, and official company sources.
- Include a source and date for material factual claims when the response format
  supports them.
- Do not treat missing evidence as proof that an event did not happen.
- Clearly distinguish confirmed facts, reasonable inferences, and unknowns.
- Do not present output as personalized investment advice.

## Working agreements

- Never commit `.env`, API keys, or other secrets.
- Explain the need before adding a production dependency.
- Keep API credentials and OpenAI calls server-side.
- Validate untrusted input at the server boundary.
- Preserve unrelated user changes in the working tree.
- Update documentation when product behavior, scope, architecture, or operating
  rules materially change.

## GitHub issue workflow

- Treat `docs/ROADMAP.md` as the milestone-level plan and GitHub Issues as the
  executable backlog.
- When asked to complete an issue, read the full issue and related issues before
  editing code.
- Work on one issue per branch unless the issue explicitly requires otherwise.
- Use a `codex/` branch name that includes the issue number and a short topic.
- Stay within the issue scope. Record useful follow-up work as a separate issue
  instead of expanding the current task.
- Reference the issue in the commit or pull request and include verification
  results in the pull-request description.
- After implementation, run all relevant checks and review the complete diff
  against the issue acceptance criteria.
- When every acceptance criterion is satisfied and all required checks pass,
  push the branch, open a pull request, merge it into `main`, close the issue,
  and update the roadmap when milestone status changes. Routine completion does
  not require manual approval.
- Do not merge or close the issue when a required check fails, acceptance
  criteria remain incomplete, or the implementation contains unresolved
  uncertainty. Leave the branch and pull request available and report the exact
  blocker.

## Manual approval boundaries

Require explicit user approval before merging changes that:

- deploy to a production or publicly accessible environment;
- add, rotate, expose, or change handling of secrets or credentials;
- change authentication, authorization, billing, payments, or account access;
- perform destructive or irreversible data or infrastructure operations;
- materially expand product scope beyond the selected issue; or
- add a production dependency whose need and risk were not already accepted in
  the issue.

Documentation, tests, internal refactors, and ordinary in-scope application
changes may be merged autonomously when their checks and acceptance criteria
pass.

## Documentation ownership

- Update `docs/PRODUCT.md` when the user, problem, scope, or success criteria
  change.
- Update `docs/ROADMAP.md` when priorities, milestones, or task status change.
- Update `docs/DECISIONS.md` after consequential product or technical decisions.
- Update `AGENTS.md` only when durable instructions for future work change.

When the project owner explicitly answers a product-vision question, approves a
durable product decision, or confirms an implementation or evaluation finding,
update the affected repository documents and GitHub issue priorities or
dependencies without waiting for a separate documentation request.

Do not independently invent or materially change the product vision, scoring
philosophy, major workflows, or priorities. When implementation evidence suggests
an unapproved product-direction change, propose it for owner review instead of
silently adopting it.

Avoid routine documentation edits for changes that do not affect these areas.

## Verification

- Run the relevant automated tests after code changes when tests exist.
- Manually verify the main ticker-search flow after frontend or integration
  changes.
- Use `npm run dev-test` at <http://localhost:3001> with ticker `ACME` for manual
  frontend and integration checks that do not require live research. This mode
  must remain token-free; the real app stays on <http://localhost:3000>.
- Add or update tests when changing backend behavior.
- Do not make a live paid API call solely for verification unless it is necessary
  and within the user's requested scope.

## Definition of done

A change is complete when its implementation, error handling, relevant tests,
and affected documentation have been addressed. Report any verification that
could not be performed.
