import assert from "node:assert/strict";
import test from "node:test";
import { createBoundedFastSourceClient } from "../lib/bounded-fast-sources.js";
import { calibrateReportScores } from "../lib/scoring.js";
import { createReportValidator } from "../lib/report-validation.js";
import { createFastBudgetController } from "../lib/fast-budget-controller.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const schema = await loadReportSchema(); const validate = createReportValidator(schema);
const baseReport = await loadReportFixture("partial");
baseReport.security.ticker = "ACME"; baseReport.security.name = "ACME Corp"; baseReport.security.listing_venue = "Nasdaq";
baseReport.issuer.legal_name = "ACME Corp"; baseReport.issuer.cik = "0000123456";
const deterministic = { report: baseReport, evidence_records: [], operations: { stage: "fast" }, evidence_packet: { ticker: "ACME", records: [], sources: [] } };
const listed = "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\nACME|ACME Corp Common Stock|S|N|N|100|N|N\nFile Creation Time: 0827202612:00||||||||";
const other = "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol\n";
const halts = "<rss><channel></channel></rss>";
const news = { feed: [{ title: "ACME announces a contract", url: "https://example.com/acme", time_published: "20260827T120000", ticker_sentiment: [{ ticker: "ACME" }], summary: "must never be copied" }] };
const market = { "Time Series (Daily)": {
  "2026-08-26": { "4. close": "2.50", "5. volume": "1500000" },
  "2026-08-25": { "4. close": "2.25", "5. volume": "1000000" },
  "2026-08-24": { "4. close": "2.20", "5. volume": "1000000" },
  "2026-08-21": { "4. close": "2.15", "5. volume": "1000000" },
  "2026-08-20": { "4. close": "2.10", "5. volume": "1000000" },
  "2026-08-19": { "4. close": "2.05", "5. volume": "1000000" }
} };
const twelveMarket = { values: Object.entries(market["Time Series (Daily)"]).map(([datetime, bar]) => ({ datetime, close: bar["4. close"], volume: bar["5. volume"] })) };
const twelveNews = { press_releases: [{ id: "release-1", datetime: "2026-08-27T10:00:00-04:00", title: "ACME announces a bounded release", body: "must never reach the report or OpenAI" }] };

function fixtureFetch({ issuer = "ACME", failAlpha = false, original = false } = {}) {
  return async (url) => {
    if (url.includes("nasdaqlisted")) return { ok: true, async text() { return listed.replaceAll("ACME Corp", `${issuer} Corp`); } };
    if (url.includes("otherlisted")) return { ok: true, async text() { return other; } };
    if (url.includes("rss.aspx")) return { ok: true, async text() { return halts; } };
    if (url.includes("globenewswire")) return { ok: true, async text() { return original ? "ACME Corp announces a contract" : "Different issuer"; } };
    if (failAlpha) return { ok: false, status: 503 };
    if (url.includes("NEWS_SENTIMENT")) return { ok: true, async json() { return structuredClone(news); } };
    return { ok: true, async json() { return structuredClone(market); } };
  };
}

test("bounded sources add identity-gated exchange and EOD context while news stays non-scoreable", async () => {
  const client = createBoundedFastSourceClient({ fetchImpl: fixtureFetch(), alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  const report = calibrateReportScores(result.report); const validation = validate(report);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(report.security.listing_status, "active"); assert.equal(report.security.security_type, "common_stock");
  assert.equal(report.claims.find((claim) => claim.id === "claim-alpha-discovery-1").state, "limited_coverage");
  assert.match(report.claims.find((claim) => claim.id === "claim-alpha-eod-market").text, /2.5.*1500000/);
  assert.equal(report.sections.financial_context.items.find((item) => item.unit === "price_change_percent").value > 11, true);
  assert.equal(report.sections.financial_context.items.find((item) => item.unit === "volume_ratio").value, 1.5);
  assert.doesNotMatch(JSON.stringify(report), /must never be copied/);
  assert.equal(result.operations.bounded_sources.request_count, 5); assert.equal(result.operations.bounded_sources.alpha_vantage_requests_today, 2);
  budget.finish({ partial: true });
});

test("wrong exchange issuer is not merged and cannot create favorable identity evidence", async () => {
  const client = createBoundedFastSourceClient({ fetchImpl: fixtureFetch({ issuer: "Different" }), alphaVantageApiKey: "", now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.claims.some((claim) => claim.id === "claim-nasdaq-current-listing"), false);
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "nasdaq-identity-conflict"));
  budget.finish({ partial: true });
});

test("provider failures preserve SEC evidence and settle news and market as Limited", async () => {
  const messages = []; const client = createBoundedFastSourceClient({ fetchImpl: fixtureFetch({ failAlpha: true }), alphaVantageApiKey: "secret-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error(message) { messages.push(message); } } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.issuer.cik, "0000123456"); assert.equal(result.operations.bounded_sources.news, "limited"); assert.equal(result.operations.bounded_sources.market, "limited");
  assert.ok(messages.length >= 2); assert.doesNotMatch(messages.join(" "), /secret-key|apikey|provider body/i);
  budget.finish({ partial: true });
});

test("an identity-gated original release is promoted while a mismatch remains discovery-only", async () => {
  const promotedNews = structuredClone(news); promotedNews.feed[0].url = "https://www.globenewswire.com/news-release/acme";
  const fetchImpl = async (url) => url.includes("NEWS_SENTIMENT") ? { ok: true, async json() { return promotedNews; } } : fixtureFetch({ original: true })(url);
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.sources.find((source) => source.id === "source-alpha-discovery-1").source_type, "original_news");
  assert.equal(result.report.claims.find((claim) => claim.id === "claim-alpha-discovery-1").state, "confirmed");
  assert.equal(calibrateReportScores(result.report).scores.catalyst_strength.value, null);
  budget.finish({ partial: true });
});

test("provider quota response is explicit and never removes completed exchange evidence", async () => {
  const fetchImpl = async (url) => url.includes("NEWS_SENTIMENT") || url.includes("TIME_SERIES_DAILY") ? { ok: true, async json() { return { Note: "The standard API rate limit is 25 requests per day." }; } } : fixtureFetch()(url);
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.security.listing_status, "active");
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "provider-news-provider_quota"));
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "provider-market-provider_quota"));
  budget.finish({ partial: true });
});

test("one bounded source timeout preserves evidence returned by the other sources", async () => {
  const fixture = fixtureFetch();
  const fetchImpl = async (url, options) => url.includes("NEWS_SENTIMENT")
    ? new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }))
    : fixture(url, options);
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "test-key", sourceTimeoutMs: 20, alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.security.listing_status, "active");
  assert.ok(result.report.claims.some((claim) => claim.id === "claim-alpha-eod-market"));
  assert.equal(result.operations.bounded_sources.news, "limited");
  assert.equal(result.operations.bounded_sources.market, "completed");
  budget.finish({ partial: true });
});

test("Alpha market and news calls are serialized because concurrent free calls can return Information", async () => {
  const fixture = fixtureFetch(); let activeAlpha = 0; let maximumActiveAlpha = 0;
  const fetchImpl = async (url, options) => {
    if (!url.includes("alphavantage")) return fixture(url, options);
    activeAlpha += 1; maximumActiveAlpha = Math.max(maximumActiveAlpha, activeAlpha);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const concurrent = activeAlpha > 1; activeAlpha -= 1;
    if (concurrent) return { ok: true, async json() { return { Information: "This endpoint is temporarily unavailable for this access tier." }; } };
    return url.includes("NEWS_SENTIMENT") ? { ok: true, async json() { return structuredClone(news); } } : { ok: true, async json() { return structuredClone(market); } };
  };
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "test-key", alphaRequestGapMs: 1, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(maximumActiveAlpha, 1);
  assert.equal(result.operations.bounded_sources.market, "completed");
  assert.equal(result.operations.bounded_sources.news, "discovery_only");
  budget.finish({ partial: true });
});

test("provider informational and stale daily responses expose precise market reasons", async () => {
  const fixture = fixtureFetch();
  const informationalFetch = async (url, options) => url.includes("TIME_SERIES_DAILY")
    ? { ok: true, async json() { return { Information: "This API function requires a premium entitlement." }; } }
    : fixture(url, options);
  const infoClient = createBoundedFastSourceClient({ fetchImpl: informationalFetch, alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const infoBudget = createFastBudgetController(); const info = await infoClient.enrich("ACME", structuredClone(deterministic), { budget: infoBudget });
  assert.equal(info.operations.bounded_sources.market_reason, "premium_endpoint");
  assert.ok(info.report.metadata.coverage_limitations.some((item) => item.code === "provider-market-premium_endpoint"));
  infoBudget.finish({ partial: true });

  const staleFetch = async (url, options) => url.includes("TIME_SERIES_DAILY")
    ? { ok: true, async json() { return { "Time Series (Daily)": { "2026-07-01": { "4. close": "2.5", "5. volume": "10" } } }; } }
    : fixture(url, options);
  const staleClient = createBoundedFastSourceClient({ fetchImpl: staleFetch, alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const staleBudget = createFastBudgetController(); const stale = await staleClient.enrich("ACME", structuredClone(deterministic), { budget: staleBudget });
  assert.equal(stale.operations.bounded_sources.market_reason, "stale_data");
  staleBudget.finish({ partial: true });
});

test("Alpha quota falls back independently to Twelve Data for market and news", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    if (url.includes("alphavantage")) return { ok: true, async json() { return { Note: "The standard API rate limit is 25 requests per day." }; } };
    if (url.includes("api.twelvedata.com/time_series")) { assert.match(options.headers.Authorization, /^apikey /); return { ok: true, async json() { return structuredClone(twelveMarket); } }; }
    if (url.includes("api.twelvedata.com/press_releases")) return { ok: true, async json() { return structuredClone(twelveNews); } };
    return fixtureFetch()(url, options);
  };
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "alpha-secret", twelveDataApiKey: "twelve-secret", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.operations.bounded_sources.providers.market.selected_provider, "twelve_data"); assert.equal(result.operations.bounded_sources.providers.news.selected_provider, "twelve_data");
  assert.equal(result.operations.bounded_sources.providers.market.fallback_succeeded, true); assert.equal(result.operations.bounded_sources.market, "completed");
  assert.equal(result.report.sources.find((source) => source.provider_name === "twelve_data" && source.data_type === "market_context").evidence_role, "market_context");
  assert.equal(result.report.sources.find((source) => source.provider_name === "twelve_data" && source.data_type === "news_discovery").evidence_role, "discovery_only");
  assert.doesNotMatch(JSON.stringify(result), /must never reach|alpha-secret|twelve-secret/);
  assert.equal(calls.filter((url) => url.includes("api.twelvedata.com")).length, 2); budget.finish({ partial: true });
});

test("Alpha malformed response and timeout safely fall back without duplicate successful calls", async () => {
  for (const mode of ["malformed", "timeout"]) {
    let twelveCalls = 0;
    const fetchImpl = async (url, options) => {
      if (url.includes("alphavantage")) {
        if (mode === "timeout") return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
        return { ok: true, async json() { return {}; } };
      }
      if (url.includes("api.twelvedata.com")) { twelveCalls += 1; return { ok: true, async json() { return structuredClone(url.includes("time_series") ? twelveMarket : twelveNews); } }; }
      return fixtureFetch()(url, options);
    };
    const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "a", twelveDataApiKey: "t", sourceTimeoutMs: 10, alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
    const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
    assert.equal(result.operations.bounded_sources.market, "completed"); assert.equal(result.operations.bounded_sources.news, "discovery_only"); assert.equal(twelveCalls, 2); budget.finish({ partial: true });
  }
});

test("market and news can settle from different providers with independent quota telemetry", async () => {
  const fetchImpl = async (url, options) => {
    if (url.includes("TIME_SERIES_DAILY")) return { ok: true, async json() { return structuredClone(market); } };
    if (url.includes("NEWS_SENTIMENT")) return { ok: true, async json() { return { Note: "25 requests per day" }; } };
    if (url.includes("press_releases")) return { ok: true, async json() { return structuredClone(twelveNews); } };
    return fixtureFetch()(url, options);
  };
  const client = createBoundedFastSourceClient({ fetchImpl, alphaVantageApiKey: "a", twelveDataApiKey: "t", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.operations.bounded_sources.providers.market.selected_provider, "alpha_vantage"); assert.equal(result.operations.bounded_sources.providers.news.selected_provider, "twelve_data");
  const quotas = result.operations.bounded_sources.providers.quotas; assert.equal(quotas.find((item) => item.provider === "alpha_vantage").daily_used, 2); assert.equal(quotas.find((item) => item.provider === "twelve_data").daily_used, 1);
  budget.finish({ partial: true });
});

test("no optional provider preserves SEC and exchange evidence with Limited context", async () => {
  const client = createBoundedFastSourceClient({ fetchImpl: fixtureFetch(), providerOrder: ["twelve_data", "alpha_vantage"], now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const budget = createFastBudgetController(); const result = await client.enrich("ACME", structuredClone(deterministic), { budget });
  assert.equal(result.report.issuer.cik, "0000123456"); assert.equal(result.report.security.listing_status, "active"); assert.equal(result.operations.bounded_sources.market, "limited"); assert.equal(result.operations.bounded_sources.news, "limited");
  assert.deepEqual(result.operations.bounded_sources.configured_providers, []); assert.equal(validate(calibrateReportScores(result.report)).valid, true); budget.finish({ partial: true });
});

test("provider cache hits do not consume free-tier allowance twice", async () => {
  const client = createBoundedFastSourceClient({ fetchImpl: fixtureFetch(), alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const firstBudget = createFastBudgetController(); await client.enrich("ACME", structuredClone(deterministic), { budget: firstBudget }); firstBudget.finish({ partial: true });
  const secondBudget = createFastBudgetController(); const second = await client.enrich("ACME", structuredClone(deterministic), { budget: secondBudget }); secondBudget.finish({ partial: true });
  const alpha = second.operations.bounded_sources.providers.quotas.find((item) => item.provider === "alpha_vantage");
  assert.equal(alpha.daily_used, 2);
  assert.equal(second.operations.bounded_sources.request_count, 0);
});
