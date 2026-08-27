export const DEMO_TICKER = "ACME";
export const DEMO_TICKERS = Object.freeze([DEMO_TICKER, "XYZ", "PENDING"]);

export class UnsupportedDemoTickerError extends Error {
  constructor(ticker) {
    super(`Mock mode supports ${DEMO_TICKERS.join(", ")}; received ${ticker}`);
    this.name = "UnsupportedDemoTickerError";
  }
}

export function createMockResearchClient(reportOrReports) {
  const reports = Array.isArray(reportOrReports) ? reportOrReports : [reportOrReports];
  const reportsByTicker = new Map(reports.map((report) => [report?.security?.ticker, report]));
  if (!reportsByTicker.has(DEMO_TICKER)) throw new TypeError(`Mock reports must include ticker ${DEMO_TICKER}`);
  const fastSnapshots = new Set();

  return {
    async researchTicker(ticker, { stage } = {}) {
      const report = reportsByTicker.get(ticker);
      if (!report) throw new UnsupportedDemoTickerError(ticker);
      const cloned = structuredClone(report);
      const selectedStage = stage ?? cloned.metadata.stage;
      cloned.metadata.stage = selectedStage;
      const hadFastSnapshot = fastSnapshots.has(ticker);
      if (selectedStage === "fast" || selectedStage === "deep") fastSnapshots.add(ticker);
      const operations = { stage: selectedStage, latency_ms: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, web_search_calls: 0, estimated_cost_usd: 0, pricing_version: null, within_latency_target: null, within_cost_target: true };
      if (selectedStage === "deep") operations.fast_foundation = { status: "extended", mode: hadFastSnapshot ? "reused" : "built", freshness_status: "fresh", reused_fast_evidence_count: cloned.claims.length, new_deep_evidence_count: 0, duplicate_retrieval_avoided: hadFastSnapshot ? 1 : 0, unresolved_components_targeted: Object.entries(cloned.scores).filter(([, score]) => score.state !== "confirmed").map(([key]) => key) };
      return { report: cloned, operations };
    }
  };
}
