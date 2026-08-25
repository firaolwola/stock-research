import { createApp } from "./app.js";
import { createMockResearchClient, DEMO_TICKER, DEMO_TICKERS } from "./mock-research-client.js";
import { loadReportFixture, loadReportSchema } from "./support/report-fixtures.js";
import { MOCK_APP_PORT } from "./local-ports.js";
import { createReportValidator } from "./lib/report-validation.js";

const port = MOCK_APP_PORT;
const completeReport = await loadReportFixture("complete");
const partialReport = await loadReportFixture("partial");
const pendingReport = structuredClone(partialReport);
pendingReport.report_id = "report-pending-deep-2026-08-24";
pendingReport.metadata.completion_status = "pending";
pendingReport.security.ticker = "PENDING";
pendingReport.security.name = "Pending Example Warrant";
pendingReport.issuer.legal_name = "Pending Example plc";
pendingReport.claims[0].text = "PENDING is an active NYSE-listed warrant associated with Pending Example plc, with limited lineage confidence.";
pendingReport.sources[0].title = "NYSE PENDING Listing Record";
const reportValidator = createReportValidator(await loadReportSchema());
const researchClient = createMockResearchClient([completeReport, partialReport, pendingReport]);
const app = createApp({
  researchClient,
  reportValidator,
  runtime: { mode: "mock", demoTicker: DEMO_TICKER, demoTickers: DEMO_TICKERS }
});

app.listen(port, () => {
  console.log(`Stock Research mock mode running at http://localhost:${port}`);
  console.log(`Enter ${DEMO_TICKERS.join(", ")} to load complete, partial, or pending deterministic reports. No OpenAI request will be made.`);
});
