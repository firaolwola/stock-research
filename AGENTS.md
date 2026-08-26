# Repository guidance

## Product

Stock Research helps an individual trader identify important stock risks and
trustworthy component scores before doing deeper research. It is a research aid,
not financial advice, and does not produce an automatic combined verdict.

Read `docs/PRODUCT.md` and `docs/ROADMAP.md` before making material product or
architecture changes.

## Current architecture

- Node.js and Express backend in `server.js`
- Static HTML, CSS, and browser JavaScript in `public/`
- Evidence-first Fast retrieval through SEC data and bounded filing extraction
- Optional tool-disabled Fast classification over server-supplied evidence
- OpenAI Responses API with broader web search for deliberate Deep research
- Secrets loaded from `.env` and kept on the server

Keep the architecture simple while the product is still being validated.

## Research quality

- Prefer SEC filings, exchange notices, and official company sources.
- Include a source and date for material factual claims when the response format
  supports them.
- Do not treat missing evidence as proof that an event did not happen.
- Clearly distinguish confirmed facts, reasonable inferences, and unknowns.
- Do not emit a numeric Fast score until its evidence threshold is satisfied;
  unfinished or inadequate work remains Researching, Unscored, or Limited.
- Fast is SEC-first but not SEC-only. Discovery services and AI-generated search
  summaries must not be the sole evidence for a material score.
- Do not present output as personalized investment advice.

## Fast operating and reliability rules

- Treat the complete 20-second pipeline ceiling, approximately $0.03 normal
  maximum, and approximately $0.05 difficult-ticker ceiling as approved product
  requirements. Implementation is incomplete until these are enforced across
  every source, synthesis, scoring, and finalization step.
- Preserve separate score constructs and the 0–10 internal scale. The Fast UI
  may convert trustworthy scores to a 0–5 star presentation.
- Do not add an automatic reject/continue, buy/sell, or combined score verdict
  without explicit owner approval.
- Deep must build and reuse Fast evidence, prioritize unresolved components, and
  avoid needless duplicate retrieval.
- Fast reliability requires approximately 95% overall material-risk recall,
  approximately 90% in every adequately sampled critical category, and no known
  severe misleading miss. Report sparse-category sample sizes and uncertainty.

## Working agreements

- Never commit `.env`, API keys, or other secrets.
- Explain the need before adding a production dependency.
- Require explicit owner approval before selecting, paying for, scraping, or
  integrating a news, research, or market-data provider.
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

- Treat `docs/PRODUCT.md` as the running product-vision source of truth; do not
  create a second vision document unless coordination needs demonstrably outgrow
  this structure.
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
