export const TICKER_RULES = Object.freeze({
  minLength: 1,
  maxLength: 15,
  pattern: /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/
});

export const TICKER_ERRORS = Object.freeze({
  required: Object.freeze({ code: "TICKER_REQUIRED", message: "Please enter a ticker." }),
  invalid: Object.freeze({
    code: "INVALID_TICKER",
    message: "Ticker must be 1–15 letters or numbers, with single periods or hyphens between segments."
  })
});

export function validateTicker(value) {
  const ticker = String(value ?? "").trim().toUpperCase();
  if (!ticker) return { valid: false, ticker, error: TICKER_ERRORS.required };

  const validLength = ticker.length >= TICKER_RULES.minLength && ticker.length <= TICKER_RULES.maxLength;
  if (!validLength || !TICKER_RULES.pattern.test(ticker)) {
    return { valid: false, ticker, error: TICKER_ERRORS.invalid };
  }

  return { valid: true, ticker, error: null };
}
