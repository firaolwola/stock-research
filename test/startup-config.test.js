import assert from "node:assert/strict";
import test from "node:test";
import { REAL_APP_PORT } from "../local-ports.js";
import { loadRealAppConfig, StartupConfigurationError } from "../startup-config.js";

test("real startup requires a non-empty API key", () => {
  for (const env of [{}, { OPENAI_API_KEY: "" }, { OPENAI_API_KEY: "   " }]) {
    assert.throws(() => loadRealAppConfig(env), StartupConfigurationError);
  }
});

test("real startup uses the default port and accepts a PORT override", () => {
  assert.deepEqual(loadRealAppConfig({ OPENAI_API_KEY: "test-key" }), { apiKey: "test-key", port: REAL_APP_PORT, secUserAgent: undefined });
  assert.deepEqual(loadRealAppConfig({ OPENAI_API_KEY: "test-key", PORT: "4123", SEC_USER_AGENT: "stock-research owner owner@example.com" }), { apiKey: "test-key", port: 4123, secUserAgent: "stock-research owner owner@example.com" });
});

test("real startup rejects invalid ports without exposing configuration values", () => {
  const secret = "secret-value-that-must-not-appear";
  for (const port of ["abc", "0", "65536", "12.5", "-1"]) {
    assert.throws(
      () => loadRealAppConfig({ OPENAI_API_KEY: secret, PORT: port }),
      (error) => error instanceof StartupConfigurationError && !error.message.includes(secret) && !error.message.includes(port)
    );
  }
});
