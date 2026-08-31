const SEC_TICKER_MAP_ENDPOINT = "https://www.sec.gov/files/company_tickers_exchange.json";
const DEFAULT_SEC_USER_AGENT = "StockResearch/1.0 github.com/firaolwola/stock-research";

function safeValue(value) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function safeError(error) {
  const cause = error?.cause;
  return {
    constructor: error?.constructor?.name ?? null,
    name: error?.name ?? null,
    code: safeValue(error?.code),
    cause_constructor: cause?.constructor?.name ?? null,
    cause_name: cause?.name ?? null,
    cause_code: safeValue(cause?.code)
  };
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("SEC preflight timed out", "TimeoutError")), timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Make exactly one bounded SEC ticker-map request without reading its body.
 * The returned diagnostics intentionally exclude the User-Agent and response
 * content so they can be logged by a live runner safely.
 */
export async function runSecConnectivityPreflight({
  fetchImpl = fetch,
  userAgent = DEFAULT_SEC_USER_AGENT,
  endpoint = SEC_TICKER_MAP_ENDPOINT,
  timeoutMs = 5_000,
  cacheState = "miss"
} = {}) {
  const started = Date.now();
  const { signal, clear } = createTimeoutSignal(timeoutMs);
  let response = null;
  try {
    response = await fetchImpl(endpoint, { headers: { "User-Agent": userAgent }, signal });
    const elapsedMs = Date.now() - started;
    const diagnostics = {
      endpoint_category: "sec_ticker_map",
      elapsed_ms: elapsedMs,
      status: safeValue(response?.status),
      response_received: true,
      cache_state: cacheState,
      request_count: 1,
      error: null
    };
    return { ok: response?.status === 200, diagnostics, reason: response?.status === 200 ? null : "sec_preflight_http_failure" };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "TimeoutError" || error?.name === "AbortError" ? "sec_preflight_timeout" : "sec_preflight_network_failure",
      diagnostics: {
        endpoint_category: "sec_ticker_map",
        elapsed_ms: Date.now() - started,
        status: safeValue(response?.status),
        response_received: Boolean(response),
        cache_state: cacheState,
        request_count: 1,
        error: safeError(error)
      }
    };
  } finally {
    clear();
  }
}

export function formatSecPreflightFailure(result) {
  const diagnostics = result?.diagnostics ?? {};
  return JSON.stringify({
    reason: result?.reason ?? "sec_preflight_failed",
    endpoint_category: diagnostics.endpoint_category ?? "sec_ticker_map",
    elapsed_ms: diagnostics.elapsed_ms ?? null,
    status: diagnostics.status ?? null,
    response_received: diagnostics.response_received === true,
    cache_state: diagnostics.cache_state ?? "miss",
    request_count: diagnostics.request_count ?? 0,
    error: diagnostics.error ?? null
  });
}

export { SEC_TICKER_MAP_ENDPOINT };
