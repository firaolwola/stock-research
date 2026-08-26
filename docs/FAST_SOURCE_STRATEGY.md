# Bounded Fast source strategy

**Status:** Proposed for owner approval

**Last reviewed:** 2026-08-26

**Scope:** GitHub Issue #48; no provider is selected or integrated by this document

## Recommendation

Fast should use a small, deterministic source graph instead of broad web search:

1. Resolve and gate the current security and issuer with SEC and exchange data.
2. Retrieve filing-based facts directly from SEC EDGAR.
3. Make at most two bounded requests to one approved data API: one for current
   news discovery and one for market/reference data.
4. Promote a discovered event into material evidence only after following its
   original URL to an issuer release, original newswire release, SEC filing,
   exchange notice, or reputable original report.
5. Score each component only when its independent evidence contract is met.
   Missing, stale, conflicting, or timed-out sources settle as `Unscored` or
   `Limited`; they never become favorable evidence.

No named provider is ready for approval from public evidence alone. **Massive
Stocks Basic** is the strongest technical candidate for a personal-project
pilot: its published individual plans expose ticker news with publisher and
original-article links, historical bars, ticker/reference data, splits, and
float through one REST API, and Basic is listed as free. But its personal market
data terms describe the data as display-only by default and restrict derived
works and third-party use without consent. Fast score derivation and supplying a
normalized packet to OpenAI therefore need written entitlement clarification or
a suitable license before selection. Current-data entitlements can also vary by
endpoint, and OTC/foreign coverage has not been demonstrated.

If those checks fail, **Alpaca Basic** is the fallback pilot candidate. It has a
free individual plan, historical full-market SIP data outside the latest
15-minute window, IEX-only real-time data, and Benzinga-supplied news. The IEX
real-time subset is not sufficient for a current full-market setup assessment,
so Fast would use a timestamped delayed SIP bar or remain Limited. Alpaca also
requires an account and credentials.

**Benzinga Stock News plus Press Releases** is the stronger premium discovery
option if later evaluation shows the free candidates miss small-cap movers. It
publishes broad U.S. ticker coverage and direct company press-release access,
but pricing and redistribution/licensing terms require a sales quote. It cannot
be selected within the current cost evidence.

This recommendation does not approve a subscription, scraping, credentials,
provider integration, or production dependency. There are two separate owner
decisions:

1. Approve this provider-neutral source-responsibility map and bounded
   architecture.
2. After written rights and a small-cap coverage sample are available, select
   one provider: authorize a Massive entitlement inquiry, accept Alpaca's
   delayed-market fallback subject to its own terms check, or authorize premium
   Benzinga/newswire and market-data quotes. #51 must stop for that selection and
   may not silently substitute another vendor.

## Source roles

| Role | Meaning in Fast | May solely support a material score? |
|---|---|---|
| Authoritative/primary evidence | The regulator, listing venue, issuer, original newswire release, or original filing/report that made or documented the fact | Yes, when the evidence contract and identity gate are met |
| Discovery source | Finds a likely event or an original URL quickly | No |
| Corroborating source | Independently confirms or clarifies primary evidence | Not normally; two reputable original reports may support a catalyst when no primary release exists, with Limited coverage |
| Market-data source | Licensed timestamped prices, bars, volume, corporate actions, and reference data | Yes for market observations; no for issuer intent, financing terms, compliance, or financial-statement facts |

An aggregator does not become primary merely because it republishes a release.
Fast stores the original publisher, publication/event date, URL, retrieval time,
and evidence role. AI summaries, sentiment labels, and provider-derived scores
are never material evidence.

## Responsibility map

| Fast category | Primary responsibility | Discovery/corroboration | Fast limitation |
|---|---|---|---|
| Current issuer/security identity and CIK | SEC ticker map and submissions metadata; listing venue directory confirms current symbol/venue | Approved reference-data API may locate candidates but cannot override an identity conflict | No cross-domain merge until name, ticker, CIK, venue, and security type agree or the conflict is explicitly resolved |
| Active exchange/listing status | Official exchange symbol directory, halt/status feed, and listing notice; issuer SEC disclosure such as Item 3.01 corroborates a deficiency | Market-data reference endpoint may flag active/inactive status | A directory entry proves current listing association, not absence of an undisclosed deficiency; unsupported venues remain Limited |
| Current catalyst/news | Original issuer release, original newswire release, SEC filing, exchange notice, or reputable original reporting | One bounded ticker/date news endpoint discovers candidates and original URLs | A headline, sentiment field, AI summary, syndicated copy, or absent result cannot solely support catalyst strength |
| Historical/current price context | Licensed market-data API using timestamped adjusted and unadjusted bars as appropriate | Exchange official close may corroborate | Free IEX-only live data is incomplete; delayed or stale data is labeled and may leave near-term setup unscored |
| Share structure/market context | SEC filing cover page and financing terms for shares outstanding and instruments; licensed market data for price/float | Corporate-action/reference API corroborates splits and ticker changes | Market cap or dilution percentages require aligned dates, units, and share classes; provider float is not a substitute for issuer-reported shares |
| Dilution and financing | SEC registration statements, prospectuses, current reports, periodic reports, exhibits, and issuer offering releases | News API discovers a just-announced transaction; market data supplies only price context | Registration capacity is not actual issuance; missing warrant/convertible terms remain Unknown |
| Financial evidence | SEC Company Facts plus the latest primary periodic/current filing, including auditor and going-concern text | Licensed fundamentals may detect a discrepancy but do not override SEC facts | Taxonomy gaps, foreign/private standards, stale periods, currency conflicts, and nonstandard facts remain Limited |
| Reverse splits | Issuer SEC filings/proxy/current reports and official corporate-action notice | Market-data split endpoint corroborates date and ratio | A bounded no-result is not proof of lifetime absence; identity lineage must cover the search window |

SEC's public data APIs need no key, update submissions in near real time, and
provide submissions and standardized XBRL Company Facts. They remain the
authoritative free foundation. Nasdaq's public symbol directory is updated
throughout the trading day and its halt data describes current regulatory and
operational states. Exchange sources outside Nasdaq require a bounded adapter or
remain Limited rather than being replaced by a generic search.

## Seven score evidence contracts

Each contract is evaluated independently after issuer/security identity gating.
“Bounded search” means the configured source set, forms, dates, pagination, and
deadline completed successfully; it never means the wider internet was searched.

### Historical dilution severity

- **Required evidence:** three years (or the issuer's shorter public history) of
  SEC registration/prospectus, periodic/current-report, and material exhibit
  coverage; actual issuances separated from registrations; dated shares or
  proceeds; obvious predecessor identity included when confirmed.
- **Sufficient to score:** the bounded filing window completed and every found
  offering, ATM draw, warrant exercise, convertible issuance, or other material
  share issuance is linked to primary evidence. A sourced bounded no-result may
  support “not found in the reviewed window,” never “never diluted.”
- **Otherwise:** `Limited` or `Unscored`; news is discovery only.

### Future dilution likelihood

- **Required evidence:** current shelf/ATM capacity, announced financings,
  outstanding warrants/convertibles and material terms, recent issuance history,
  latest cash/operating-cash-flow pressure, debt maturities, and filing freshness.
- **Sufficient to score:** current financing capacity/instrument state and the
  required financial-pressure inputs are primary-sourced, dated, and internally
  consistent. Unknown active capacity or material instruments blocks a number.
- **Otherwise:** `Limited` or `Unscored`; absence of news is never favorable.

### Potential dilution impact

- **Required evidence:** maximum or expected issuable shares from primary
  financing/instrument terms and a dated, class-consistent shares-outstanding
  denominator. Price/proceeds proxies must be labeled and cannot masquerade as
  an ownership-dilution percentage.
- **Sufficient to score:** the numerator, denominator, dates, units, assumptions,
  and instrument conditions are reproducible. Unbounded conversion terms or a
  mismatched share class block a number.
- **Otherwise:** `Limited` or `Unscored`.

### Reverse-split risk

- **Required evidence:** five-year filing/corporate-action coverage, exact split
  ratios and effective dates, current price context, and current listing-pressure
  evidence. Confirmed predecessor securities are included only after lineage
  gating.
- **Sufficient to score:** the split window completed and listing pressure is
  either evidenced or explicitly unresolved. A split API can corroborate but
  cannot override the issuer/exchange record.
- **Otherwise:** `Limited` or `Unscored`; no split result alone is not low risk.

### Financial health

- **Required evidence:** latest available cash, debt, revenue, profitability,
  operating cash flow, and filing-period/freshness context, plus going-concern,
  non-reliance/restatement, and major accounting warnings from primary filings.
- **Sufficient to score:** the latest relevant period is retrieved, units and
  currencies agree, required metrics are comparable, and narrative warnings were
  checked in the filing. Staleness is explicit and may block or weaken coverage.
- **Otherwise:** `Limited` or `Unscored`; taxonomy absence is not zero debt or a
  clean audit.

### Catalyst strength

- **Required evidence:** a specific current event, event/publication date,
  identity match, original source, and enough primary text to assess recency,
  specificity, credibility, novelty, and potential significance.
- **Sufficient to score:** an issuer/SEC/exchange/original-newswire source supports
  the event, or two independent reputable original reports support it when no
  primary release exists. The latter is labeled Limited. Syndicated copies do
  not count as independent reports.
- **Otherwise:** `Limited` or `Unscored`; discovery-provider sentiment is ignored.

### Near-term setup quality

- **Required evidence:** a scored current catalyst, active listing/security
  identity, and licensed timestamped price/volume context sufficient to compare
  the current move with recent baselines. Adjustments and session boundaries must
  be explicit.
- **Sufficient to score:** catalyst evidence is sufficient and the market source
  provides an appropriately current prior close plus bounded recent price/volume
  history. Delayed data may support a labeled end-of-day context but not a
  real-time setup claim.
- **Otherwise:** `Limited` or `Unscored`; price movement alone is not a catalyst.

## Architecture options

| Option | Expected latency and requests | Cost fit | Recall and reliability | Decision |
|---|---|---|---|---|
| A. No new provider: SEC + public exchange/issuer endpoints | Usually 4–12 seconds cached/normal; SEC requests plus exchange lookups; issuer IR retrieval varies | Free and comfortably bounded | Strong filing risk; weak standardized current-news discovery and market context; issuer sites are heterogeneous | Keep as graceful fallback, not the complete strategy |
| B. Search-based discovery | Historically exceeded Fast bounds; query count and context are variable | Tool/token cost can approach ceilings unpredictably | Broad reach but nondeterministic, hard to license/attribute, and unsafe as sole score evidence | Reject for normal Fast; reserve broad search for Deep |
| C. Bounded data API + primary-source promotion | Target 5–12 seconds normal, hard stop at 20 seconds; at most one news and one market/reference request in parallel with SEC | A free pilot can fit only if intended derived/AI use is licensed; paid fixed fees require allocation and owner approval; optional synthesis must keep total under $0.03 normal/$0.05 difficult | Best predictable discovery/market coverage while primary evidence remains authoritative; gaps remain explicit | Recommend the provider-neutral architecture; named provider pending rights and coverage evidence |

The 20-second controller must reserve time for validation and finalization rather
than giving every source its own 20 seconds. A practical initial allocation for
#49/#51 is: SEC and exchange work up to 12 seconds, provider calls up to 4 seconds
each in parallel, original-source promotion up to the remaining shared deadline,
and at least 1 second reserved for scoring/validation. Cache hits should finish
earlier. No retry may cross the shared deadline.

Normal direct retrieval has no per-token charge. A subscription's fixed monthly
fee is not “zero”; operations metadata must allocate or report it as an unknown
per-run cost until usage is known. Optional tool-disabled OpenAI synthesis may
run only on normalized evidence and only if the remaining ledger keeps the whole
run at or below $0.03 normally and $0.05 for an explicitly difficult run.

## Provider comparison

Public information was reviewed on 2026-08-26. Pricing, entitlements, and terms
can change; #51 must repeat the final check before credentials or code are added.

| Candidate | API/feed and latency | Coverage/attribution | Pricing, limits, and licensing | Fit |
|---|---|---|---|---|
| Massive Stocks | REST news, market bars/snapshots, reference, splits, and float; no public response-time SLA found, so the adapter must settle Limited at four seconds; direct article URLs and publisher metadata | Broad U.S. stock API surface; small-cap, OTC, foreign/ADR news recall needs measurement | Individual Basic shown as free; paid tiers shown at $29/$79/$199 monthly. Personal terms default to display-only and restrict derived works/third-party use, so scoring and synthesis require written clarification or another license | Strongest technical candidate; not selectable yet |
| Alpaca | REST/WebSocket market data and Benzinga news; no public REST response-time SLA found, so the adapter must settle Limited at four seconds | U.S. stocks/ETFs; news averages 130+ items/day. Free real-time is IEX only; full SIP is delayed 15 minutes | Basic free with account, 200 historical calls/minute; Algo Trader Plus $99/month. Credentialed market-data agreements and derived/AI use need confirmation | Strong fallback for delayed price context; thinner stated news volume |
| Benzinga | REST/TCP/RSS Stock News and Press Release APIs; advertises sub-0.1-second API delivery, but Fast still enforces four seconds | Wilshire 5000 plus stated additional popular/Canadian tickers; press releases are direct company communications and include attribution | Pricing and rate limits are quote-based; embedding/use is licensed | Best premium discovery candidate, but cannot be approved against current cost evidence |
| TipRanks Enterprise | Market News and broad research/data APIs; no public SLA found | Enterprise-oriented news and proprietary analytics; original-source promotion and small-cap recall are not documented sufficiently | Contact-sales enterprise product; no public API price, rate limit, or personal-project entitlement found | Do not select without quote, sample, terms, and coverage test |
| Seeking Alpha | No official self-service developer news API located | Useful editorial/discovery site and syndicated releases, but not a bounded documented feed for this project | Consumer subscription is not API or redistribution permission; scraping is not approved | Do not use in Fast; optional manual/Deep discovery only |
| Original newswires (Business Wire, GlobeNewswire, PR Newswire) | Licensed feeds/APIs/RSS exist; ticker-normalized access varies | Excellent primary issuer-release content and attribution, including global issuers | Custom feeds generally require media/partner arrangements and quote-based terms; public RSS is not evidence of application rights | Promote original release URLs; consider a licensed direct feed only if discovery pilot misses materially |

### Official references

- [SEC EDGAR data APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Nasdaq symbol directory definitions](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs)
- [Nasdaq current symbol lookup](https://nasdaqtrader.com/trader.aspx?id=symbollookup)
- [Nasdaq trading-halt definitions](https://nasdaqtrader.com/Trader.aspx?id=TradeHaltCodes)
- [Massive stocks API and individual pricing](https://massive.com/docs/rest/stocks)
- [Massive ticker-news response contract](https://massive.com/docs/rest/stocks/news)
- [Massive personal market-data terms](https://massive.com/legal/market-data-terms-of-service)
- [Alpaca market-data plans and entitlements](https://docs.alpaca.markets/us/docs/about-market-data-api)
- [Alpaca historical news coverage](https://docs.alpaca.markets/us/docs/historical-news-data)
- [Alpaca IEX versus SIP limitations](https://docs.alpaca.markets/us/docs/market-data-faq)
- [Benzinga Stock News API](https://www.benzinga.com/apis/in/cloud-product/stock-news-api/)
- [Benzinga Press Release API](https://docs.benzinga.com/api-reference/news-api/press-releases/overview)
- [TipRanks Enterprise API overview](https://enterprise.tipranks.com/)
- [GlobeNewswire licensed/custom feeds](https://www.globenewswire.com/newswire-press-release-content)
- [PR Newswire content API/feed options](https://www.prnewswire.com/contact-us/prnewswire-partners/)
- [Business Wire media feed options](https://www.businesswire.com/help-center)

## Coverage and evaluation gates

The strategy is not a claim that Fast meets its recall targets. Before the
provider graduates from pilot status, the representative evaluation set must
report category-level sample size, overall recall, and misses by retrieval,
interpretation, or unavailable evidence. It must include small-cap movers,
foreign issuers/ADRs, OTC and delisted securities, ticker/name changes, stale
filers, and securities with sparse IEX activity.

Automatic failure conditions include wrong-issuer promotion, a discovery
headline treated as material evidence, a missed severe financing/listing/
accounting warning that creates false reassurance, unlicensed/stale market data
presented as current, any source exceeding the shared deadline, or unknown cost
treated as free. OTC, unsupported foreign venues, and delisted securities remain
explicitly Limited unless an approved source proves coverage.

## Deep-only evidence

Fast deliberately does not perform exhaustive predecessor-lineage research,
broad open-web corroboration, historical catalyst analogue/reaction studies,
full multi-year financial reconstruction, difficult cross-source conflict
resolution, or a search for every secondary report. Those tasks remain Deep.
Fast still surfaces any material risk it finds, records unresolved categories,
and passes its complete evidence packet and source attempts to Deep so the wider
workflow does not repeat successful bounded retrieval.

## Handoff to dependent issues

- **#49:** enforce one shared 20-second deadline and shared cost ledger across
  SEC, exchange, provider, original-source promotion, optional synthesis,
  scoring, and finalization.
- **#51:** after the architecture approval and a separate explicit named-provider
  selection, implement only that candidate, the two-call provider ceiling,
  attribution, identity gating, primary-source promotion, cache policy, and
  graceful fallback to completed SEC evidence.
- **#52:** encode the seven evidence-sufficiency contracts; no numeric score may
  appear merely because a provider field exists.
- **#55:** measure the real-ticker evaluation set and decide whether the pilot's
  small-cap/news/venue gaps justify a paid newswire or dedicated news service.
