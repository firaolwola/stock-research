import express from "express";
import { validateTicker } from "./ticker-validation.js";

export function createApp({ researchClient, logger = console, runtime = { mode: "live", demoTicker: null } } = {}) {
  if (!researchClient || typeof researchClient.researchTicker !== "function") {
    throw new TypeError("createApp requires a researchClient with researchTicker(ticker)");
  }

  const app = express();
  app.use(express.static("public"));

  app.get("/api/runtime", (_req, res) => {
    return res.json({ mode: runtime.mode, demoTicker: runtime.demoTicker });
  });

  app.get("/api/analyze", async (req, res) => {
    const validation = validateTicker(req.query.ticker);
    if (!validation.valid) {
      return res.status(400).json({ code: validation.error.code, error: validation.error.message });
    }
    const { ticker } = validation;

    try {
      const answer = await researchClient.researchTicker(ticker);
      if (typeof answer !== "string" || answer.trim().length === 0) {
        throw new TypeError("Research client returned an invalid response");
      }
      return res.json({ ticker, answer });
    } catch (error) {
      logger.error(`Research request failed for ${ticker}.`);
      return res.status(500).json({ error: "Research failed. Please try again." });
    }
  });

  return app;
}
