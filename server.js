import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { createOpenAIResearchClient } from "./openai-research-client.js";
import { loadRealAppConfig, StartupConfigurationError } from "./startup-config.js";
import { createReportValidator } from "./lib/report-validation.js";
import { loadReportSchema } from "./support/report-fixtures.js";

dotenv.config({ quiet: true });

try {
    const config = loadRealAppConfig();
    const schema = await loadReportSchema();
    const reportValidator = createReportValidator(schema);

    const openai = new OpenAI({ apiKey: config.apiKey });
    const researchClient = createOpenAIResearchClient(openai, { schema });
    const app = createApp({ researchClient, reportValidator });

    app.listen(config.port, () => {
        console.log(`Stock Research running at http://localhost:${config.port}`);
    });
} catch (error) {
    const message = error instanceof StartupConfigurationError
        ? error.message
        : "Unexpected startup error.";
    console.error(`Stock Research failed to start: ${message}`);
    process.exitCode = 1;
}
