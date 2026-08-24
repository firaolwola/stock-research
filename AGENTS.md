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
- Do not close an issue until its acceptance criteria are satisfied. Update the
  roadmap when completing work that changes milestone status.

## Documentation ownership

- Update `docs/PRODUCT.md` when the user, problem, scope, or success criteria
  change.
- Update `docs/ROADMAP.md` when priorities, milestones, or task status change.
- Update `docs/DECISIONS.md` after consequential product or technical decisions.
- Update `AGENTS.md` only when durable instructions for future work change.

Avoid routine documentation edits for changes that do not affect these areas.

## Verification

- Run the relevant automated tests after code changes when tests exist.
- Manually verify the main ticker-search flow after frontend or integration
  changes.
- Add or update tests when changing backend behavior.
- Do not make a live paid API call solely for verification unless it is necessary
  and within the user's requested scope.

## Definition of done

A change is complete when its implementation, error handling, relevant tests,
and affected documentation have been addressed. Report any verification that
could not be performed.
