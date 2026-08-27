import { REAL_APP_PORT } from "./local-ports.js";

export class StartupConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StartupConfigurationError";
  }
}

function parsePort(value) {
  if (value === undefined || value === null || value === "") return REAL_APP_PORT;
  if (!/^\d+$/.test(String(value))) {
    throw new StartupConfigurationError("PORT must be an integer from 1 through 65535.");
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new StartupConfigurationError("PORT must be an integer from 1 through 65535.");
  }
  return port;
}

export function loadRealAppConfig(env = process.env) {
  const apiKey = typeof env.OPENAI_API_KEY === "string" ? env.OPENAI_API_KEY.trim() : "";
  if (!apiKey) {
    throw new StartupConfigurationError("OPENAI_API_KEY is required to start the real application.");
  }

  const secUserAgent = typeof env.SEC_USER_AGENT === "string" && env.SEC_USER_AGENT.trim() ? env.SEC_USER_AGENT.trim() : undefined;
  const alphaVantageApiKey = typeof env.ALPHA_VANTAGE_API_KEY === "string" ? env.ALPHA_VANTAGE_API_KEY.trim() : "";
  return Object.freeze({ apiKey, port: parsePort(env.PORT), secUserAgent, alphaVantageApiKey });
}
