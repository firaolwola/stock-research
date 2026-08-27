# Stock Research

Stock Research is an early-stage personal due-diligence application. After an
external screener identifies a moving or news-relevant ticker, it is intended to
produce a fast, evidence-backed view of the catalyst, company context, and
material risks before deeper research.

The current application uses two research stages. Fast retrieves and validates
bounded SEC and Nasdaq Trader evidence directly, adds optional Alpha Vantage
free-tier news discovery and end-of-day market context, streams deterministic partial reports, and may
run a small tool-disabled classification over supplied evidence IDs. Deep uses
the OpenAI Responses API with broader web search and must ultimately extend the
Fast evidence packet. The report contract covers identity,
reverse splits, dilution, dividends, warnings, dated financial metrics and trends, structured
catalyst factors and historical analogues, scores, claims, and sources. Catalyst
history includes explicit comparison limits and dated reaction windows, or an
unknown result when no reliable analogue is available. Issuer identity now follows confirmed prior names
and tickers so dated material history is not lost across renames or rebrands.
The browser renders the validated report as a responsive fast-decision
dashboard. One compact progressive score summary converts trustworthy
methodology 2.0.0 values to accessible 0–5 stars without changing the underlying
0–10 values. Financial display rows without an independent methodology score
remain Unscored, and detailed explanations, inputs, and sources live in a
separate expandable block. Comparison remains planned behind the Fast
reliability milestone.

This application is a research aid, not financial advice.

## Current status

The first end-to-end prototype is working:

1. A user enters a ticker in the browser.
2. For Fast, Express retrieves bounded deterministic evidence and optionally
   requests tool-disabled classification from OpenAI. For Deep, it requests
   broader JSON Schema output through the OpenAI Responses API.
3. The server validates the schema and cross-record semantics.
   Material report records must link to dated, typed evidence; secondary sources
   carry reduced confidence, and conflicting evidence remains unknown or limited.
   Unavailable evidence is distinct from a bounded search that found nothing,
   while security-specific inapplicability is reported without implying a gap.
   Confirmed prior identities require sourced linkage claims, effective dates,
   and meaningful confidence. Historical split, dilution, offering, compliance,
   and warning items from those periods reference the linkage explicitly;
   ambiguous predecessors remain unknown or limited coverage.
4. Fast retrieves SEC identity, submissions, Company Facts, and at most four
   selected recent filing documents plus one directly linked material exhibit.
   It normalizes dated evidence, explicit capital/warning/catalyst language, and
   financial freshness before streaming validated deterministic progress.
   Identity agreement is required before evidence is assembled.
   Optional AI synthesis has no tools and may classify only supplied evidence
   IDs. Missing retrieval remains visibly Pending/Unknown rather than favorable.
   Stable Deep/synthesis errors distinguish timeouts, rate limits, provider
   authentication/configuration failures, refusals, malformed responses, and
   temporary service failures without exposing provider details.
5. The dashboard leads with identity, compact research status, current catalyst
   and market context, and one independently settling score summary. It then
   shows clean financial metric charts, a separate explanation block, expandable
   detailed research/coverage, and the source library. All evidence and citations
   remain available without repeating every technical detail at the top.

The repository includes a dated representative ticker evaluation set and a
token-free score and operating-budget calibration run. Its checked-in research
results are fictional and do not establish production Fast recall. A free SWVL
structural run verified bounded SEC extraction, but complete live score quality,
cost, and reliability remain uncalibrated. See
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
   SEC_USER_AGENT=stock-research your-name your-contact-email@example.com
   ALPHA_VANTAGE_API_KEY=your_free_key_here
   ```

   `OPENAI_API_KEY` is required for the real application. Startup fails before
   listening when it is missing or blank. `PORT` is optional and defaults to
   `3000`; set it to an integer from `1` through `65535` to override the real
   app's listening port. Set `SEC_USER_AGENT` to an application name and a
   monitored contact address. The SEC may return HTTP 403 when it cannot
   identify or permit a client; Fast then keeps affected evidence
   Pending/Unknown and logs only safe request metadata. `ALPHA_VANTAGE_API_KEY`
   is optional. With a free key, Fast uses at most two uncached Alpha Vantage
   requests per ticker for discovery and end-of-day context. Without a key, or
   after quota exhaustion, those areas remain Limited while SEC/Nasdaq evidence survives.
   The two free Alpha Vantage calls are deliberately serialized because the
   provider can return HTTP 200 with an informational response when they are
   submitted concurrently. Operations telemetry distinguishes quota, premium
   entitlement, invalid request/symbol, missing series, invalid bar, stale bar,
   timeout, and other provider-information outcomes without logging the key or
   provider message.

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

Fast retrieves SEC identity, submissions, recent filing metadata, Company Facts,
and a bounded set of material filing documents directly, then progressively
renders a deterministic report. Explicit split ratios, actual issuance versus
registered capacity, warrants/convertibles, warning language, and recent filing
events are extracted conservatively; unmatched content stays Limited/Unknown.
Optional AI synthesis has hosted tools disabled and may reference only supplied
evidence record IDs; its failure cannot remove deterministic evidence. Nasdaq
Trader supplies identity-gated current symbol, security-type, listing-status,
and halt context. Alpha Vantage supplies discovery-only news links and
timestamped end-of-day price/volume; its summaries, sentiment, and article text
are never sent to OpenAI and cannot independently support a material score.
Original newswire links are promoted only after issuer identity agrees. All
source work participates in the shared 20-second and cost ceilings. The next
milestone recalibrates scoring against these corrected evidence semantics.

The default action runs the Fast stage. **Deeper research** remains deliberate
and separately budgeted. The approved direction requires Deep to build and reuse
Fast evidence automatically, but the current direct-Deep path does not yet do so
when no in-memory Fast packet exists. Successful responses show operational
telemetry without replacing report coverage or unknown states. See
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Project documentation

- [Product definition](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Stock report contract](docs/REPORT_SCHEMA.md)
- [Research evaluation set](docs/EVALUATION.md)
- [Score methodology](docs/SCORING.md)
- [Performance and stage budgets](docs/PERFORMANCE.md)
- [Decision log](docs/DECISIONS.md)
- [Repository instructions](AGENTS.md)
