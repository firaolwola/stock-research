# Roadmap

This roadmap records outcomes and priorities, not fixed delivery dates. Update it
as evidence changes.

GitHub Issues are the executable backlog. This file remains the source of truth
for milestone goals, ordering, and overall progress.

## Current state

The end-to-end ticker search has been manually confirmed. The application still
returns an unstructured text report, and source traceability, validation, tests,
and production safeguards remain incomplete.

## Current milestone: trustworthy reports

Goal: make every report consistent, understandable, and traceable to evidence.

### Next up

- [ ] Define a structured server response for all required research sections.
- [ ] Include source title, URL, publication or filing date, and source type for
      material claims.
- [ ] Render structured results as readable sections and risk indicators.
- [ ] Represent unknown, not found, and not applicable as distinct states.
- [ ] Validate results against a representative set of at least 10 tickers.

### Acceptance criteria

- Each required section is present in every successful response.
- Material claims can be traced to a clickable source.
- Risk scores include concise evidence-based explanations.
- Missing evidence is not presented as proof that no event occurred.
- The UI remains understandable when one or more sections are incomplete.

## Milestone 2: reliable application

Goal: make the local MVP predictable and safe to operate.

- [ ] Validate ticker syntax and provide a useful invalid-ticker response.
- [ ] Detect missing configuration during server startup.
- [ ] Add request timeout and appropriate upstream-error handling.
- [ ] Prevent duplicate submissions while a request is running.
- [ ] Add automated tests for validation, response shape, and error handling.
- [ ] Make the listening port configurable.
- [ ] Add basic request and API-usage logging without recording secrets.
- [ ] Add rate limiting before any public deployment.

## Milestone 3: useful research workflow

Goal: help the user work with reports after the first search.

- [ ] Decide whether saved search history or stock comparison has greater value.
- [ ] Implement the selected workflow based on that decision.
- [ ] Add export only if it supports a demonstrated workflow.
- [ ] Improve accessibility and responsive layout.
- [ ] Define deployment, authentication, cost, and privacy requirements.
- [ ] Deploy only after public-access safeguards are in place.

## Later ideas

These are possibilities, not commitments:

- Watchlists
- Report refresh and change detection
- Side-by-side ticker comparison
- PDF or Markdown export
- Additional fundamental research
- Portfolio or brokerage integrations

## Completed

- [x] Create the initial Express server and static frontend.
- [x] Connect the server to the OpenAI Responses API with web search.
- [x] Confirm the end-to-end ticker search works locally.
- [x] Establish repository product, roadmap, decision, and agent documentation.
