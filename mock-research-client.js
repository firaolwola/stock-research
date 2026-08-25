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
    async researchTicker(ticker) {
      const report = reportsByTicker.get(ticker);
      if (!report) throw new UnsupportedDemoTickerError(ticker);
      return structuredClone(report);
    }
  };
}
