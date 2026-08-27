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
const market = { "Time Series (Daily)": { "2026-08-26": { "4. close": "2.50", "5. volume": "1500000" } } };

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
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "alpha-news-provider_quota"));
  assert.ok(result.report.metadata.coverage_limitations.some((item) => item.code === "alpha-market-provider_quota"));
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
  assert.ok(info.report.metadata.coverage_limitations.some((item) => item.code === "alpha-market-premium_endpoint"));
  infoBudget.finish({ partial: true });

  const staleFetch = async (url, options) => url.includes("TIME_SERIES_DAILY")
    ? { ok: true, async json() { return { "Time Series (Daily)": { "2026-07-01": { "4. close": "2.5", "5. volume": "10" } } }; } }
    : fixture(url, options);
  const staleClient = createBoundedFastSourceClient({ fetchImpl: staleFetch, alphaVantageApiKey: "test-key", alphaRequestGapMs: 0, now: () => Date.parse("2026-08-27T12:00:00Z"), logger: { error() {} } });
  const staleBudget = createFastBudgetController(); const stale = await staleClient.enrich("ACME", structuredClone(deterministic), { budget: staleBudget });
  assert.equal(stale.operations.bounded_sources.market_reason, "stale_daily_bar");
  staleBudget.finish({ partial: true });
});
