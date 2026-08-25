import { createApp } from "./app.js";
import { createMockResearchClient, DEMO_TICKER } from "./mock-research-client.js";
import { loadReportFixture, loadReportSchema } from "./support/report-fixtures.js";
import { MOCK_APP_PORT } from "./local-ports.js";
import { createReportValidator } from "./lib/report-validation.js";

const port = MOCK_APP_PORT;
const report = await loadReportFixture("complete");
const reportValidator = createReportValidator(await loadReportSchema());
const researchClient = createMockResearchClient(report);
const app = createApp({
  researchClient,
  reportValidator,
  runtime: { mode: "mock", demoTicker: DEMO_TICKER }
});

app.listen(port, () => {
  console.log(`Stock Research mock mode running at http://localhost:${port}`);
  console.log(`Enter ${DEMO_TICKER} to load the deterministic demo report. No OpenAI request will be made.`);
});
