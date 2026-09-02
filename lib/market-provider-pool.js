export const OPTIONAL_PROVIDER_STATES = Object.freeze(["completed", "limited"]);

export function normalizeProviderOrder(value, supported = ["alpha_vantage", "twelve_data"]) {
  const requested = Array.isArray(value) ? value : String(value ?? "").split(",");
  const order = [...new Set(requested.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  if (!order.length) return [...supported];
  const unknown = order.filter((item) => !supported.includes(item));
  if (unknown.length) throw new TypeError(`Unsupported market provider: ${unknown.join(", ")}`);
  return order;
}

export function createMarketProviderPool({ adapters = [], order } = {}) {
  const byName = new Map(adapters.map((adapter) => [adapter.name, adapter]));
  const providerOrder = normalizeProviderOrder(order).filter((name) => byName.has(name));
  async function resolve(operation, ticker, context) {
    const attempts = [];
    for (const name of providerOrder) {
      if (context.budget?.isStopped()) { attempts.push({ provider: name, state: "limited", reason: "shared_deadline" }); break; }
      const adapter = byName.get(name); const result = await adapter[operation](ticker, context);
      attempts.push({ provider: name, state: result.state, reason: result.reason ?? null, request_count: result.request_count ?? 0 });
      if (result.state === "completed") return { ...result, attempts, selected_provider: name, fallback_succeeded: attempts.length > 1 };
    }
    const reason = attempts.find((item) => item.reason && item.reason !== "not_configured")?.reason ?? attempts.at(-1)?.reason ?? (providerOrder.length ? "provider_unavailable" : "not_configured");
    return { state: "limited", reason, attempts, selected_provider: null, fallback_succeeded: false };
  }
  return {
    order: providerOrder,
    configured: providerOrder.filter((name) => byName.get(name)?.configured),
    getMarketContext: (ticker, context) => resolve("getMarketContext", ticker, context),
    getNewsDiscovery: (ticker, context) => resolve("getNewsDiscovery", ticker, context),
    quotaTelemetry: () => providerOrder.map((name) => byName.get(name).quotaTelemetry())
  };
}
