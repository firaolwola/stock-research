const researchPrompt = (ticker) => `
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
`;

export function createOpenAIResearchClient(openai) {
  if (!openai?.responses || typeof openai.responses.create !== "function") {
    throw new TypeError("A compatible OpenAI client is required");
  }

  return {
    async researchTicker(ticker) {
      const response = await openai.responses.create({
        model: "gpt-5.1",
        reasoning: { effort: "none" },
        max_output_tokens: 2500,
        tools: [{ type: "web_search" }],
        input: researchPrompt(ticker)
      });
      return response.output_text;
    }
  };
}
