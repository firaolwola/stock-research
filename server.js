import dotenv from "dotenv";
import OpenAI from "openai";
import { createApp } from "./app.js";
import { createOpenAIResearchClient } from "./openai-research-client.js";

dotenv.config();

const port = 3000;

// Connect to OpenAI using the key from .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const app = createApp({ researchClient: createOpenAIResearchClient(openai) });


// Start our local server
app.listen(port, () => {
    console.log(`Stock Research running at http://localhost:${port}`);
});
