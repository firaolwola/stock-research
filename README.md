# Stock Research

Stock Research is an early-stage personal due-diligence application. After an
external screener identifies a moving or news-relevant ticker, it is intended to
produce a fast, evidence-backed view of the catalyst, company context, and
material risks before deeper research.

The current prototype researches reverse splits, dilution, dividends,
exchange-compliance issues, and recent news using the OpenAI Responses API with
web search. Broader financial, issuer-lineage, catalyst, and comparison work is
planned but not yet implemented.

This application is a research aid, not financial advice.

## Current status

The first end-to-end prototype is working:

1. A user enters a ticker in the browser.
2. The Express server sends a focused research request to OpenAI.
3. The application displays the resulting report.

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
   ```

3. Start the application:

   ```powershell
   npm start
   ```

4. Open <http://localhost:3000>.

Never commit `.env` or an API key.

## Project documentation

- [Product definition](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Stock report contract](docs/REPORT_SCHEMA.md)
- [Decision log](docs/DECISIONS.md)
- [Repository instructions](AGENTS.md)
