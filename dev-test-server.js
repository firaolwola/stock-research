import { createApp } from "./app.js";
import { createMockResearchClient, DEMO_TICKER } from "./mock-research-client.js";
import { loadReportFixture } from "./support/report-fixtures.js";

const port = 3000;
const report = await loadReportFixture("complete");
const researchClient = createMockResearchClient(report);
const app = createApp({
  researchClient,
  runtime: { mode: "mock", demoTicker: DEMO_TICKER }
});

app.listen(port, () => {
  console.log(`Stock Research mock mode running at http://localhost:${port}`);
  console.log(`Enter ${DEMO_TICKER} to load the deterministic demo report. No OpenAI request will be made.`);
});
