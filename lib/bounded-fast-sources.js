const ALPHA_BASE = "https://www.alphavantage.co/query";
const NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const NASDAQ_HALTS_URL = "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";
const TTL = Object.freeze({ directory: 86_400_000, halts: 60_000, alpha: 300_000 });
const SOURCE_TIMEOUT_MS = 4_000;
const ALPHA_REQUEST_GAP_MS = 250;
export const ALPHA_VANTAGE_FREE_DAILY_LIMIT = 25;
const ORIGINAL_RELEASE_HOSTS = new Set(["globenewswire.com", "www.globenewswire.com", "prnewswire.com", "www.prnewswire.com", "businesswire.com", "www.businesswire.com"]);

const date = (time) => new Date(time).toISOString().slice(0, 10);
const normalized = (value) => String(value ?? "").toUpperCase().replace(/\b(?:INCORPORATED|INC|CORPORATION|CORP|LIMITED|LTD|PLC|ORDINARY|COMMON|SHARES?|STOCK|ADR|ADS)\b/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
const identityAgrees = (issuer, candidate) => {
  const a = normalized(issuer); const b = normalized(candidate);
  if (!a || !b) return false;
  const tokens = a.split(" ").filter((token) => token.length > 2);
  return a === b || (tokens.length === 1 ? b.split(" ").includes(tokens[0]) : tokens.slice(0, 2).every((token) => b.split(" ").includes(token)));
};
const parsePipe = (text) => {
  const lines = String(text ?? "").trim().split(/\r?\n/); const fields = lines.shift()?.split("|") ?? [];
  return lines.filter((line) => line && !line.startsWith("File Creation Time")).map((line) => { const values = line.split("|"); return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? ""])); });
};
const securityType = (name, etf) => etf === "Y" || /\bETF\b/i.test(name) ? "etf" : /\bWARRANT/i.test(name) ? "warrant" : /\bPREFERRED/i.test(name) ? "preferred_stock" : /\b(?:ADR|ADS|DEPOSITARY)/i.test(name) ? "adr" : /\b(?:COMMON|ORDINARY|SHARES?|STOCK)/i.test(name) ? "common_stock" : "unknown";
const safeDiagnostic = (error, extra) => ({ ...extra, constructor: error?.constructor?.name ?? null, name: error?.name ?? null, code: typeof error?.code === "string" ? error.code : null, cause_name: error?.cause?.name ?? null });
const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(done, milliseconds); timer.unref?.();
  function done() { signal?.removeEventListener("abort", abort); resolve(); }
  function abort() { clearTimeout(timer); reject(signal.reason); }
  signal?.addEventListener("abort", abort, { once: true });
});
const providerReason = (data) => {
  if (typeof data?.["Error Message"] === "string") return "invalid_request_or_symbol";
  const message = String(data?.Note ?? data?.Information ?? "");
  if (!message) return null;
  if (/25 requests per day|rate limit|call frequency|requests? per (?:minute|second|day)/i.test(message)) return "provider_quota";
  if (/premium/i.test(message)) return "premium_endpoint";
  return "provider_information";
};

function mergeReport(base, additions) {
  const report = structuredClone(base);
  report.claims.push(...additions.claims); report.sources.push(...additions.sources);
  if (additions.security) report.security = { ...report.security, ...additions.security, claim_ids: [...new Set([...report.security.claim_ids, ...additions.security.claim_ids])] };
  if (additions.newsItems.length) {
    const section = report.sections.catalysts_and_news; section.items.push(...additions.newsItems);
    section.claim_ids = [...new Set([...section.claim_ids, ...additions.newsItems.flatMap((item) => item.claim_ids)])];
    section.coverage_notes = [...new Set([...section.coverage_notes, "External news items are discovery-only until promoted to an original source."])];
  }
  report.metadata.coverage_limitations.push(...additions.limitations);
  return report;
}

export function createBoundedFastSourceClient({ fetchImpl = globalThis.fetch, alphaVantageApiKey = "", now = () => Date.now(), logger = console, sourceTimeoutMs = SOURCE_TIMEOUT_MS, alphaRequestGapMs = ALPHA_REQUEST_GAP_MS } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  const cache = new Map(); let quotaDay = date(now()); let alphaRequests = 0;
  const request = async (key, url, ttl, { budget, counter, format = "text", source }) => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) { budget?.recordSource(source, "completed", { cache_state: "hit", cost_usd: 0 }); return { data: hit.data, cache: "hit" }; }
    counter.count += 1; const started = now(); let response; const controller = new AbortController();
    const abort = () => controller.abort(budget?.signal.reason ?? new DOMException("Fast source cancelled", "AbortError"));
    budget?.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Fast source timeout", "TimeoutError")), Math.min(sourceTimeoutMs, budget?.remainingTimeMs() ?? sourceTimeoutMs)); timer.unref?.();
    try {
      budget?.recordSource(source, "in_progress", { cache_state: "miss" });
      response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: format === "json" ? "application/json" : "text/plain,application/rss+xml;q=0.9,*/*;q=0.8" } });
      if (!response.ok) { const error = new Error("Bounded source returned an unsuccessful status"); error.status = response.status; throw error; }
      const data = format === "json" ? await response.json() : await response.text(); cache.set(key, { data, expiresAt: now() + ttl });
      budget?.recordSource(source, "completed", { cache_state: "miss", request_count: counter.count, cost_usd: 0 }); return { data, cache: "miss" };
    } catch (error) {
      const timedOut = budget?.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
      budget?.recordSource(source, timedOut ? "timed_out" : "failed", { status: error?.status ?? null, request_count: counter.count });
      logger.error(`Bounded Fast source failed ${JSON.stringify(safeDiagnostic(error, { source, elapsed_ms: Math.round(now() - started), status: error?.status ?? null, response_received: Boolean(response), request_count: counter.count }))}`);
      return null;
    } finally { clearTimeout(timer); budget?.signal.removeEventListener("abort", abort); }
  };
  const alpha = async (key, params, context) => {
    if (!alphaVantageApiKey) { context.budget?.recordSource(context.source, "unavailable", { reason: "not_configured" }); return { unavailable: "not_configured" }; }
    const today = date(now()); if (today !== quotaDay) { quotaDay = today; alphaRequests = 0; }
    const hit = cache.get(key);
    if ((!hit || hit.expiresAt <= now()) && alphaRequests >= ALPHA_VANTAGE_FREE_DAILY_LIMIT) { context.budget?.recordSource(context.source, "limited", { reason: "free_daily_quota" }); return { unavailable: "free_daily_quota" }; }
    if (!hit || hit.expiresAt <= now()) alphaRequests += 1;
    const result = await request(key, `${ALPHA_BASE}?${new URLSearchParams({ ...params, apikey: alphaVantageApiKey })}`, TTL.alpha, { ...context, format: "json" });
    const unavailable = providerReason(result?.data);
    if (unavailable) {
      context.budget?.recordSource(context.source, "limited", { reason: unavailable });
      logger.error(`Bounded Fast source returned unusable data ${JSON.stringify({ source: context.source, reason: unavailable, response_received: true, response_keys: Object.keys(result?.data ?? {}).slice(0, 8), request_count: context.counter.count })}`);
      return { unavailable };
    }
    return result;
  };
  return { async enrich(ticker, deterministic, { budget, onProgress } = {}) {
    const report = deterministic.report; const counter = { count: 0 }; const additions = { claims: [], sources: [], newsItems: [], limitations: [], security: null };
    const directoryPromise = Promise.all([
        request("nasdaq:listed", NASDAQ_LISTED_URL, TTL.directory, { budget, counter, source: "nasdaq:listed" }),
        request("nasdaq:other", OTHER_LISTED_URL, TTL.directory, { budget, counter, source: "nasdaq:other" }),
        request("nasdaq:halts", NASDAQ_HALTS_URL, TTL.halts, { budget, counter, source: "nasdaq:halts" })
    ]);
    // Alpha's free service can return HTTP 200 + Information for one of two
    // simultaneous requests. Keep Nasdaq parallel, but serialize Alpha and
    // prioritize the market observation before discovery.
    const marketResult = await alpha(`alpha:market:${ticker}`, { function: "TIME_SERIES_DAILY", symbol: ticker, outputsize: "compact" }, { budget, counter, source: "alpha_vantage:market" });
    if (!budget?.isStopped() && alphaVantageApiKey && alphaRequestGapMs > 0) { try { await wait(alphaRequestGapMs, budget?.signal); } catch {} }
    const newsResult = budget?.isStopped() ? { unavailable: "shared_deadline" } : await alpha(`alpha:news:${ticker}`, { function: "NEWS_SENTIMENT", tickers: ticker, sort: "LATEST", limit: "10" }, { budget, counter, source: "alpha_vantage:news" });
    const directories = await directoryPromise;
    const row = parsePipe(directories[0]?.data).find((item) => item.Symbol === ticker) ?? parsePipe(directories[1]?.data).find((item) => item["ACT Symbol"] === ticker);
    if (row && identityAgrees(report.issuer.legal_name, row["Security Name"])) {
      const escapedTicker = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const halted = new RegExp(`(?:<title>[^<]*\\b${escapedTicker}\\b|<[^>]*IssueSymbol[^>]*>\\s*${escapedTicker}\\s*<)`, "i").test(directories[2]?.data ?? "");
      const claimId = "claim-nasdaq-current-listing"; const sourceId = "source-nasdaq-symbol-directory"; const status = halted ? "halted" : "active";
      additions.claims.push({ id: claimId, text: `Nasdaq Trader's current symbol directory identifies ${ticker} as ${row["Security Name"]}; current status is ${status}.`, materiality: "high", state: "confirmed", as_of: new Date(now()).toISOString(), source_ids: [sourceId] });
      additions.sources.push({ id: sourceId, title: "Nasdaq Trader current symbol directory", url: row.Symbol ? NASDAQ_LISTED_URL : OTHER_LISTED_URL, published_date: date(now()), source_type: "exchange_notice", confidence: "high", retrieved_at: new Date(now()).toISOString(), supported_claim_ids: [claimId] });
      additions.security = { name: row["Security Name"], security_type: securityType(row["Security Name"], row.ETF), listing_status: status, evidence_state: "confirmed", claim_ids: [claimId] };
    } else additions.limitations.push({ code: row ? "nasdaq-identity-conflict" : "nasdaq-symbol-unresolved", explanation: row ? "Nasdaq evidence was not merged because issuer identity did not agree." : "The security was not confirmed in the bounded Nasdaq directories.", affected_sections: ["issuer", "compliance_and_warnings"] });
    const feed = Array.isArray(newsResult?.data?.feed) ? newsResult.data.feed : [];
    for (const [index, item] of feed.slice(0, 3).entries()) {
      if (!(item.ticker_sentiment ?? []).some((entry) => entry.ticker === ticker) || !item.url || !item.title || !/^https:\/\//.test(item.url) || !/^\d{8}/.test(String(item.time_published ?? ""))) continue;
      const claimId = `claim-alpha-discovery-${index + 1}`; const sourceId = `source-alpha-discovery-${index + 1}`; const published = String(item.time_published ?? "").slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
      additions.claims.push({ id: claimId, text: `A bounded ticker feed discovered a dated item titled “${String(item.title).slice(0, 180)}”; the underlying event remains unconfirmed.`, materiality: "low", state: "limited_coverage", as_of: `${published}T00:00:00Z`, source_ids: [sourceId] });
      additions.sources.push({ id: sourceId, title: `Discovery: ${String(item.title).slice(0, 180)}`, url: item.url, published_date: published, source_type: "secondary_aggregator", confidence: "low", retrieved_at: new Date(now()).toISOString(), supported_claim_ids: [claimId] });
      additions.newsItems.push({ id: `alpha-discovery-${index + 1}`, kind: "catalyst", title: String(item.title).slice(0, 180), state: "limited_coverage", summary: "Discovery only; this cannot support a material score until an identity-gated original source is retrieved.", event_date: published, claim_ids: [claimId] });
    }
    const promotableSource = additions.sources.find((source) => { try { return ORIGINAL_RELEASE_HOSTS.has(new URL(source.url).hostname.toLowerCase()); } catch { return false; } });
    if (promotableSource && !budget?.isStopped()) {
      const source = promotableSource; const claimId = source.supported_claim_ids[0]; const claim = additions.claims.find((candidate) => candidate.id === claimId); const item = additions.newsItems.find((candidate) => candidate.claim_ids.includes(claimId));
      const original = await request(`original:${source.url}`, source.url, TTL.alpha, { budget, counter, source: "original_release" });
      if (claim && item && original?.data && identityAgrees(report.issuer.legal_name, original.data)) {
        claim.state = "confirmed"; claim.text = `An identity-gated original release reported “${item.title}” on ${source.published_date}.`;
        source.source_type = "original_news"; source.confidence = "high";
        item.state = "confirmed"; item.summary = "The discovery result was promoted to an identity-gated original newswire release; it remains separate from AI-authored scoring.";
      } else additions.limitations.push({ code: "original-source-promotion-unresolved", explanation: "A candidate original release could not be identity-gated within Fast and remains discovery-only.", affected_sections: ["catalysts_and_news", "catalyst_assessment"] });
    }
    if (!additions.newsItems.length) additions.limitations.push({ code: `alpha-news-${newsResult?.unavailable ?? "no-results"}`, explanation: "Current news discovery is Limited; an absent result is not favorable evidence.", affected_sections: ["catalysts_and_news", "catalyst_assessment"] });
    const series = marketResult?.data?.["Time Series (Daily)"] ?? {}; const latestDate = Object.keys(series).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort().at(-1); const bar = latestDate ? series[latestDate] : null;
    const ageDays = latestDate ? Math.floor((new Date(date(now())).getTime() - new Date(latestDate).getTime()) / 86_400_000) : null;
    const marketReason = marketResult?.unavailable ?? (!latestDate ? "missing_daily_series" : !bar || !Number.isFinite(Number(bar["4. close"])) || Number(bar["4. close"]) <= 0 || !Number.isFinite(Number(bar["5. volume"])) || Number(bar["5. volume"]) < 0 ? "invalid_daily_bar" : ageDays > 7 ? "stale_daily_bar" : null);
    if (!marketReason) {
      const claimId = "claim-alpha-eod-market"; const sourceId = "source-alpha-eod-market";
      additions.claims.push({ id: claimId, text: `${ticker}'s end-of-day close was ${Number(bar["4. close"])} with volume ${Number(bar["5. volume"])} on ${latestDate}; this is market context, not evidence of an issuer event.`, materiality: "low", state: "confirmed", as_of: `${latestDate}T00:00:00Z`, source_ids: [sourceId] });
      additions.sources.push({ id: sourceId, title: `Alpha Vantage end-of-day market data for ${ticker}`, url: "https://www.alphavantage.co/documentation/#daily", published_date: latestDate, source_type: "other_secondary", confidence: "medium", retrieved_at: new Date(now()).toISOString(), supported_claim_ids: [claimId] });
    } else additions.limitations.push({ code: `alpha-market-${marketReason}`, explanation: `End-of-day price and volume context is Limited (${marketReason.replaceAll("_", " ")}) and cannot affect risk scoring.`, affected_sections: ["catalyst_assessment"] });
    const evidence = additions.claims.map((claim) => ({ id: claim.id.replace("claim-", "evidence-"), category: claim.id.includes("market") ? "market_context" : claim.id.includes("nasdaq") ? "security_and_listing" : "catalysts_news", state: claim.state, event_date: claim.as_of.slice(0, 10), text: claim.text, source_id: claim.source_ids[0], issuer_cik: report.issuer.cik, security_ticker: ticker, confidence: claim.state === "confirmed" ? "high" : "low" }));
    const newsReason = additions.newsItems.length ? null : newsResult?.unavailable ?? "no_results";
    const enriched = { ...deterministic, report: mergeReport(report, additions), evidence_records: [...(deterministic.evidence_records ?? []), ...evidence], operations: { ...deterministic.operations, bounded_sources: { status: additions.limitations.length ? "limited" : "completed", request_count: counter.count, alpha_vantage_requests_today: alphaRequests, alpha_vantage_free_daily_limit: ALPHA_VANTAGE_FREE_DAILY_LIMIT, nasdaq: row ? "completed" : "limited", news: additions.newsItems.length ? "discovery_only" : "limited", news_reason: newsReason, market: marketReason ? "limited" : "completed", market_reason: marketReason } } };
    if (additions.limitations.length) budget?.markPartial(); await onProgress?.({ ...enriched, final: false }); return enriched;
  } };
}
