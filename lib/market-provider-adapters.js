const ALPHA_BASE = "https://www.alphavantage.co/query";
const TWELVE_BASE = "https://api.twelvedata.com";
export const ALPHA_VANTAGE_FREE_DAILY_LIMIT = 25;
export const TWELVE_DATA_FREE_DAILY_LIMIT = 800;
export const TWELVE_DATA_FREE_MINUTE_LIMIT = 8;
const date = (time) => new Date(time).toISOString().slice(0, 10);

function allowance({ name, configured, now, dailyLimit, minuteLimit = null }) {
  let day = date(now()); let dailyUsed = 0; let minute = Math.floor(now() / 60_000); let minuteUsed = 0;
  const reserve = () => {
    const currentDay = date(now()); if (currentDay !== day) { day = currentDay; dailyUsed = 0; }
    const currentMinute = Math.floor(now() / 60_000); if (currentMinute !== minute) { minute = currentMinute; minuteUsed = 0; }
    if (!configured) return "not_configured";
    if (dailyUsed >= dailyLimit || (minuteLimit !== null && minuteUsed >= minuteLimit)) return "provider_quota";
    dailyUsed += 1; minuteUsed += 1; return null;
  };
  return { reserve, telemetry: () => ({ provider: name, configured, daily_used: dailyUsed, daily_limit: dailyLimit, minute_used: minuteUsed, minute_limit: minuteLimit }) };
}

const alphaReason = (data) => {
  if (typeof data?.["Error Message"] === "string") return "no_data";
  const message = String(data?.Note ?? data?.Information ?? "");
  if (!message) return null;
  if (/25 requests per day|rate limit|call frequency|requests? per (?:minute|second|day)/i.test(message)) return "provider_quota";
  return /premium/i.test(message) ? "premium_endpoint" : "provider_unavailable";
};
const twelveReason = (data) => {
  if (data?.status === "error" || data?.code) return /limit|credit|quota|429/i.test(`${data.code ?? ""} ${data.message ?? ""}`) ? "provider_quota" : "no_data";
  return null;
};

export function createAlphaVantageAdapter({ apiKey = "", now = () => Date.now(), requestJson, requestGapMs = 250 } = {}) {
  const quota = allowance({ name: "alpha_vantage", configured: Boolean(apiKey), now, dailyLimit: ALPHA_VANTAGE_FREE_DAILY_LIMIT });
  const call = async (operation, ticker, params, context) => {
    const result = await requestJson({ provider: "alpha_vantage", operation, key: `alpha:${operation}:${ticker}`, url: `${ALPHA_BASE}?${new URLSearchParams({ ...params, apikey: apiKey })}`, context, reserve: quota.reserve });
    if (result.state !== "completed") return result;
    const reason = alphaReason(result.data); return reason ? { state: "limited", reason, request_count: result.request_count } : result;
  };
  return {
    name: "alpha_vantage", configured: Boolean(apiKey), quotaTelemetry: quota.telemetry,
    async getMarketContext(ticker, context) {
      const result = await call("market", ticker, { function: "TIME_SERIES_DAILY", symbol: ticker, outputsize: "compact" }, context);
      const series = result.data?.["Time Series (Daily)"]; if (result.state !== "completed") return result;
      const observations = Object.entries(series ?? {}).filter(([day, bar]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Number(bar?.["4. close"])) && Number.isFinite(Number(bar?.["5. volume"]))).map(([day, bar]) => ({ date: day, close: Number(bar["4. close"]), volume: Number(bar["5. volume"]) })).sort((a, b) => a.date.localeCompare(b.date));
      return observations.length ? { ...result, observations } : { state: "limited", reason: "malformed_response", request_count: result.request_count };
    },
    async getNewsDiscovery(ticker, context) {
      if (requestGapMs > 0 && this.configured) { try { await context.wait?.(requestGapMs); } catch { return { state: "limited", reason: "shared_deadline", request_count: 0 }; } }
      const result = await call("news", ticker, { function: "NEWS_SENTIMENT", tickers: ticker, sort: "LATEST", limit: "10" }, context);
      if (result.state !== "completed") return result;
      const items = (Array.isArray(result.data?.feed) ? result.data.feed : []).filter((item) => (item.ticker_sentiment ?? []).some((entry) => entry.ticker === ticker) && item.title && /^https:\/\//.test(item.url ?? "") && /^\d{8}/.test(String(item.time_published ?? ""))).slice(0, 3).map((item) => ({ title: String(item.title).slice(0, 180), url: item.url, published_date: String(item.time_published).slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") }));
      return items.length ? { ...result, items, discovery_only: true } : { state: "limited", reason: "no_data", request_count: result.request_count };
    }
  };
}

export function createTwelveDataAdapter({ apiKey = "", now = () => Date.now(), requestJson } = {}) {
  const quota = allowance({ name: "twelve_data", configured: Boolean(apiKey), now, dailyLimit: TWELVE_DATA_FREE_DAILY_LIMIT, minuteLimit: TWELVE_DATA_FREE_MINUTE_LIMIT });
  const call = async (operation, ticker, path, params, context) => {
    const result = await requestJson({ provider: "twelve_data", operation, key: `twelve:${operation}:${ticker}`, url: `${TWELVE_BASE}/${path}?${new URLSearchParams(params)}`, headers: { Authorization: `apikey ${apiKey}` }, context, reserve: quota.reserve });
    if (result.state !== "completed") return result;
    const reason = twelveReason(result.data); return reason ? { state: "limited", reason, request_count: result.request_count } : result;
  };
  return {
    name: "twelve_data", configured: Boolean(apiKey), quotaTelemetry: quota.telemetry,
    async getMarketContext(ticker, context) {
      const result = await call("market", ticker, "time_series", { symbol: ticker, interval: "1day", outputsize: "30", order: "ASC" }, context);
      if (result.state !== "completed") return result;
      const observations = (Array.isArray(result.data?.values) ? result.data.values : []).filter((bar) => /^\d{4}-\d{2}-\d{2}/.test(bar.datetime ?? "") && Number.isFinite(Number(bar.close)) && Number.isFinite(Number(bar.volume))).map((bar) => ({ date: bar.datetime.slice(0, 10), close: Number(bar.close), volume: Number(bar.volume) })).sort((a, b) => a.date.localeCompare(b.date));
      return observations.length ? { ...result, observations } : { state: "limited", reason: "malformed_response", request_count: result.request_count };
    },
    async getNewsDiscovery(ticker, context) {
      const result = await call("news", ticker, "press_releases", { symbol: ticker, outputsize: "3" }, context);
      if (result.state !== "completed") return result;
      // Body content is intentionally discarded: Twelve Data is bounded discovery
      // only and is not an approved source of text for OpenAI synthesis.
      const items = (Array.isArray(result.data?.press_releases) ? result.data.press_releases : []).filter((item) => item.title && /^\d{4}-\d{2}-\d{2}/.test(item.datetime ?? "")).slice(0, 3).map((item) => ({ title: String(item.title).slice(0, 180), url: "https://twelvedata.com/docs/volume-indicators", published_date: item.datetime.slice(0, 10) }));
      return items.length ? { ...result, items, discovery_only: true } : { state: "limited", reason: "no_data", request_count: result.request_count };
    }
  };
}
