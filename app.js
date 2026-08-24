import express from "express";

export function createApp({ researchClient, logger = console } = {}) {
  if (!researchClient || typeof researchClient.researchTicker !== "function") {
    throw new TypeError("createApp requires a researchClient with researchTicker(ticker)");
  }

  const app = express();
  app.use(express.static("public"));

  app.get("/api/analyze", async (req, res) => {
    const ticker = String(req.query.ticker || "").trim().toUpperCase();
    if (!ticker) return res.status(400).json({ error: "Please enter a ticker." });

    try {
      const answer = await researchClient.researchTicker(ticker);
      if (typeof answer !== "string" || answer.trim().length === 0) {
        throw new TypeError("Research client returned an invalid response");
      }
      return res.json({ ticker, answer });
    } catch (error) {
      logger.error(`Research failed for ${ticker}:`, error);
      return res.status(500).json({ error: "Research failed. Please try again." });
    }
  });

  return app;
}
