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

  return {
    async researchTicker(ticker, { stage } = {}) {
      const report = reportsByTicker.get(ticker);
      if (!report) throw new UnsupportedDemoTickerError(ticker);
      const cloned = structuredClone(report);
      const selectedStage = stage ?? cloned.metadata.stage;
      cloned.metadata.stage = selectedStage;
      return { report: cloned, operations: { stage: selectedStage, latency_ms: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, web_search_calls: 0, estimated_cost_usd: 0, pricing_version: null, within_latency_target: null, within_cost_target: true } };
    }
  };
}
