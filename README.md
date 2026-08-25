# Stock Research

Stock Research is an early-stage personal due-diligence application. After an
external screener identifies a moving or news-relevant ticker, it is intended to
produce a fast, evidence-backed view of the catalyst, company context, and
material risks before deeper research.

The current prototype requests a validated, versioned stock-report object from
the OpenAI Responses API with web search. The report contract covers identity,
reverse splits, dilution, dividends, warnings, financial context, catalysts,
scores, claims, and sources. Evidence population, issuer resolution, scoring
calibration, dashboard rendering, and comparison remain active roadmap work.

This application is a research aid, not financial advice.

## Current status

The first end-to-end prototype is working:

1. A user enters a ticker in the browser.
2. The Express server requests JSON Schema output from OpenAI.
3. The server validates the schema and cross-record semantics.
4. The application displays the resulting report as formatted JSON until the
   dashboard issue is completed.

The current development priority is making reports structured, traceable, and
reliably sourced. See [docs/ROADMAP.md](docs/ROADMAP.md).

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

Open <http://localhost:3001>. The page displays a **Mock testing mode** banner
and tells you to enter the dummy ticker `ACME`. Submitting `ACME` always returns
the same deterministic structured report derived from the validated complete schema
fixture. Other tickers are intentionally unsupported in this mode.

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
local fixtures. It does not require `OPENAI_API_KEY` and does not make live
OpenAI calls. Run `npm run validate:reports` when you only need to validate the
complete and partial report fixtures.

## Project documentation

- [Product definition](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Stock report contract](docs/REPORT_SCHEMA.md)
- [Decision log](docs/DECISIONS.md)
- [Repository instructions](AGENTS.md)
