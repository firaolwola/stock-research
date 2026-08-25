export const DEMO_TICKER = "ACME";

export class UnsupportedDemoTickerError extends Error {
  constructor(ticker) {
    super(`Mock mode supports only ${DEMO_TICKER}; received ${ticker}`);
    this.name = "UnsupportedDemoTickerError";
  }
}

export function createMockResearchClient(report) {
  if (report?.security?.ticker !== DEMO_TICKER) {
    throw new TypeError(`Mock report must use ticker ${DEMO_TICKER}`);
  }

  const deterministicAnswer = JSON.stringify(report, null, 2);

  return {
    async researchTicker(ticker) {
      if (ticker !== DEMO_TICKER) throw new UnsupportedDemoTickerError(ticker);
      return deterministicAnswer;
    }
  };
}
