import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = 3000;


// Serve everything inside the "public" folder
app.use(express.static("public"));

// Connect to OpenAI using the key from .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// This runs whenever our webpage asks:
// /api/analyze?ticker=BULL
app.get("/api/analyze", async (req, res) => {

    const ticker = String(req.query.ticker || "")
        .trim()
        .toUpperCase();

    // Make sure something was entered
    if (!ticker) {
        return res.status(400).json({
            error: "Please enter a ticker."
        });
    }

    try {

        console.log(`Researching ${ticker}...`);

        const response = await openai.responses.create({

            model: "gpt-5.1",
            

            reasoning: {
                effort: "none"
            },

            max_output_tokens: 2500,

            tools: [
                {
                    type: "web_search"
                }
            ],

            input: `
Research ticker "${ticker}".

Find only:

1. Reverse splits in the last 5 years.
2. Major stock offerings/dilution in the last 3 years.
3. Whether it currently pays a dividend.
4. Major Nasdaq/NYSE compliance issues in the last 3 years.
5. The 3 most important news items from the last 30 days.

Prefer SEC filings and official company sources.

Give:
- Dilution risk 0-10
- Reverse split risk 0-10
- Recent news: Positive / Neutral / Negative
- Maximum 600 words total.

Do not research anything else.
`
        });
        console.log("STATUS:", response.status);
        console.log("OUTPUT:", response.output_text);
        console.log("USAGE:", response.usage);
        console.log("INCOMPLETE:", response.incomplete_details);
        res.json({
            ticker: ticker,
            answer: response.output_text
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});


// Start our local server
app.listen(port, () => {
    console.log(`Stock Research running at http://localhost:${port}`);
});