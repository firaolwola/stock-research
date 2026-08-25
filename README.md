# Stock Research

Stock Research is an early-stage personal due-diligence application. After an
external screener identifies a moving or news-relevant ticker, it is intended to
produce a fast, evidence-backed view of the catalyst, company context, and
material risks before deeper research.

The current prototype requests a validated, versioned stock-report object from
the OpenAI Responses API with web search. The report contract covers identity,
reverse splits, dilution, dividends, warnings, dated financial metrics and trends, structured
catalyst factors and historical analogues, scores, claims, and sources. Catalyst
history includes explicit comparison limits and dated reaction windows, or an
unknown result when no reliable analogue is available. Issuer identity now follows confirmed prior names
and tickers so dated material history is not lost across renames or rebrands.
The browser renders the validated report as a responsive fast-decision
dashboard. Scores are now recalculated server-side with documented deterministic
methodology. Fast/deep stage budgets and per-report usage telemetry are now
implemented; comparison remains active roadmap work.

This application is a research aid, not financial advice.

## Current status

The first end-to-end prototype is working:

1. A user enters a ticker in the browser.
2. The Express server requests JSON Schema output from OpenAI.
3. The server validates the schema and cross-record semantics.
   Material report records must link to dated, typed evidence; secondary sources
   carry reduced confidence, and conflicting evidence remains unknown or limited.
   Unavailable evidence is distinct from a bounded search that found nothing,
   while security-specific inapplicability is reported without implying a gap.
   Confirmed prior identities require sourced linkage claims, effective dates,
   and meaningful confidence. Historical split, dilution, offering, compliance,
   and warning items from those periods reference the linkage explicitly;
   ambiguous predecessors remain unknown or limited coverage.
4. The fast-stage OpenAI request targets 3–10 seconds, permits a bounded
   over-budget grace period, and hard-stops at 30 seconds with no automatic
   retries. It uses at most four low-context web searches and deliberately
   returns visible partial/pending coverage instead of expanding into Deep.
   Stable errors distinguish timeouts, rate limits, provider
   authentication/configuration failures, refusals, malformed responses, and
   temporary service failures without exposing provider details.
5. The application renders ranked warnings and unknowns, a financial-health
   panel with period-aligned metrics and prominent liquidity/debt/going-concern
   warnings, a dedicated catalyst
   assessment with favorable/unfavorable evidence and historical comparisons,
   distinct score groups, all research sections, coverage and issuer context,
   and claim-linked sources in a responsive dashboard.

The repository now includes a dated representative ticker evaluation set and a
token-free score and operating-budget calibration run. Actual live latency and
cost remain unmeasured because no paid verification run was authorized. See
[docs/ROADMAP.md](docs/ROADMAP.md).

## Requirements

- Node.js 18 or newer
- An OpenAI API key

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and add your API key:

   ```text
   OPENAI_API_KEY=your_key_here
   PORT=3000
   ```

   `OPENAI_API_KEY` is required for the real application. Startup fails before
   listening when it is missing or blank. `PORT` is optional and defaults to
   `3000`; set it to an integer from `1` through `65535` to override the real
   app's listening port.

3. Start the application:

   ```powershell
   npm start
   ```

4. Open <http://localhost:3000>.

Never commit `.env` or an API key.

## Manual mock mode

Use mock mode for manual browser and integration checks without an API key or
OpenAI tokens:

```powershell
npm run dev-test
```

Open <http://localhost:3001>. The page displays a **Mock testing mode** banner.
Use these deterministic dummy tickers:

- `ACME` — complete fast report;
- `XYZ` — partial report with unknown, limited-coverage, and
  not-applicable states; and
- `PENDING` — pending report.

These reports are fixture-backed and make no OpenAI request. Other tickers are
intentionally unsupported in this mode.

Press `Ctrl+C` in the terminal to stop the mock server. Use `npm start` for the
normal OpenAI-backed application; mock mode never imports or constructs the
OpenAI client.

The real application remains on <http://localhost:3000>, so both commands can
run in separate terminals at the same time without a port conflict.

## Ticker input syntax

Ticker input is normalized to uppercase after trimming surrounding whitespace.
The server accepts 1–15 letters or digits with optional single periods or
hyphens between segments, such as `ACME`, `BRK.B`, `BF-B`, or `7203`. Leading,
trailing, repeated, or other punctuation and embedded whitespace are rejected
with a stable validation error.

Passing syntax validation only means the identifier is well formed. It does not
prove the security exists, is listed, or is supported by available research.

## Testing

Run the isolated backend and report-contract tests with:

```powershell
npm test
```

The suite uses Node's built-in test runner, injected fake research clients, and
local fixtures, including ticker-change, company-rename, rebrand, delisted, and
ambiguous-lineage cases. Dashboard tests cover complete, partial, limited,
pending, not-applicable, score grouping, finding priority, source references,
keyboard-compatible form submission, and narrow-screen styling. The suite does
not require `OPENAI_API_KEY` and does not make live OpenAI calls. Run
`npm run validate:reports` when you only need to validate the complete and
partial report fixtures.

Run `npm run evaluate:dry` to validate and score the checked-in token-free
evaluation sample. The cases, rubric, date rules, and explicit approval boundary
for any bounded paid run are documented in
[docs/EVALUATION.md](docs/EVALUATION.md). Routine tests and dry runs never make
OpenAI calls.

Automatic SDK retries are disabled for research requests so a failed attempt
cannot silently multiply paid web-search work or extend the defined deadline.
Retry a failed search manually after the displayed error when appropriate.

Fast latency is measured independently from its hard timeout. A usable Fast
report received after 10 seconds is returned with
`within_latency_target=false`; the synchronous provider request is cancelled at
30 seconds if no response object has arrived. Fast keeps its 5,000-token output
ceiling, caps hosted search calls at four, and defers detailed lineage,
financial history, corroboration, and historical catalyst analogues to Deep
with explicit limitations.

The default action runs the fast stage. **Deeper research** is a deliberate
second-stage request with a larger timeout/output budget; the server never
escalates automatically. Successful responses show latency, token use,
web-search calls, estimated cost, and budget status without replacing report
coverage or unknown states. See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Project documentation

- [Product definition](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Stock report contract](docs/REPORT_SCHEMA.md)
- [Research evaluation set](docs/EVALUATION.md)
- [Score methodology](docs/SCORING.md)
- [Performance and stage budgets](docs/PERFORMANCE.md)
- [Decision log](docs/DECISIONS.md)
- [Repository instructions](AGENTS.md)
