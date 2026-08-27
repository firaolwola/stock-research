import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { createOpenAIResearchClient } from "./openai-research-client.js";
import { createEvidenceFirstResearchClient } from "./evidence-first-research-client.js";
import { createSecEvidenceClient } from "./lib/sec-evidence.js";
import { createBoundedFastSourceClient } from "./lib/bounded-fast-sources.js";
import { loadRealAppConfig, StartupConfigurationError } from "./startup-config.js";
import { createReportValidator } from "./lib/report-validation.js";
import { loadReportSchema } from "./support/report-fixtures.js";

dotenv.config({ quiet: true });

try {
    const config = loadRealAppConfig();
    const schema = await loadReportSchema();
    const reportValidator = createReportValidator(schema);

    const openai = new OpenAI({ apiKey: config.apiKey });
    const deepClient = createOpenAIResearchClient(openai, { schema });
    const boundedSourceClient = createBoundedFastSourceClient({ alphaVantageApiKey: config.alphaVantageApiKey });
    const researchClient = createEvidenceFirstResearchClient({ secClient: createSecEvidenceClient({ userAgent: config.secUserAgent }), boundedSourceClient, openai, deepClient, reportValidator });
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
