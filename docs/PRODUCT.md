# Product definition

## Product statement

Stock Research helps an individual trader quickly identify dilution,
reverse-split, exchange-compliance, dividend, and recent-news risks before
researching a stock more deeply. It provides evidence and risk signals, not
investment advice.

## Initial user

The initial user is an individual, self-directed trader who wants a fast first
pass on a ticker, especially when evaluating unfamiliar or higher-risk stocks.

The product is currently a personal/local tool. Public or multi-user operation
is outside the initial MVP and would require authentication, abuse prevention,
privacy review, and cost controls.

## User problem

Important warning signs are scattered across SEC filings, exchange notices,
company announcements, and news coverage. Finding and reconciling them manually
is slow, and a basic quote page rarely explains financing or listing risk.

The application should reduce that initial research time while keeping every
important conclusion traceable to evidence.

## Primary user outcome

After reading a report, the user should understand:

- whether recent dilution or financing creates material risk;
- whether reverse splits have occurred and appear likely to recur;
- whether the company currently pays a dividend;
- whether material Nasdaq or NYSE compliance issues exist;
- which recent news items are most relevant; and
- which claims are confirmed, uncertain, or unsupported by available evidence.

The report should help the user decide whether to reject the idea, investigate
it more deeply, or add it to a watchlist. It must not tell the user to buy or
sell.

## MVP scope

Every completed report should contain:

1. Reverse splits from the last five years.
2. Major offerings or other material dilution from the last three years.
3. Current dividend status.
4. Major Nasdaq or NYSE compliance issues from the last three years.
5. The three most important news items from the last 30 days.
6. Dilution and reverse-split risk scores with short explanations.
7. An overall recent-news sentiment label.
8. Dates and clickable sources for material claims.
9. Explicit unknown or not-found states where evidence is incomplete.

## Source standard

Use sources in this order when available:

1. SEC filings and official exchange notices.
2. Official company investor-relations releases and filings.
3. Reputable original news reporting.
4. Secondary aggregators only when a stronger source is unavailable.

The report must not claim that an event never occurred merely because search did
not find it. It should state the search scope and uncertainty instead.

## Out of scope for the first MVP

- Personalized investment recommendations
- Price targets or trade signals
- Automated trading or brokerage integration
- Portfolio management
- Real-time quotes or charts
- Comprehensive fundamental valuation
- Social-media sentiment
- Public accounts, billing, and team collaboration

## MVP success criteria

The MVP is usable when:

- the application returns a consistent structured report for valid US tickers;
- material claims have working sources and dates;
- invalid, unavailable, and incomplete results are explained clearly;
- a representative ticker test set produces factually acceptable results;
- API errors do not break the page or expose sensitive details; and
- the application has basic automated coverage for validation and response
  handling.

## Open product questions

- Should the product remain a personal research tool or become public?
- Which securities beyond US-listed common stocks should be supported?
- How should risk scores be calibrated and explained consistently?
- Should completed reports be saved, compared, or exported first?
- What response time and per-search cost are acceptable?
