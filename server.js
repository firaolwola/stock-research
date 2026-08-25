import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { createOpenAIResearchClient } from "./openai-research-client.js";
import { loadRealAppConfig, StartupConfigurationError } from "./startup-config.js";

dotenv.config({ quiet: true });

try {
    const config = loadRealAppConfig();

    const openai = new OpenAI({ apiKey: config.apiKey });
    const app = createApp({ researchClient: createOpenAIResearchClient(openai) });

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
