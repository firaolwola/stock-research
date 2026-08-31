import test from "node:test";
import assert from "node:assert/strict";
import { formatSecPreflightFailure, runSecConnectivityPreflight } from "../lib/sec-connectivity-preflight.js";

test("SEC preflight accepts HTTP 200 without reading the response body", async () => {
  let request;
  const result = await runSecConnectivityPreflight({
    userAgent: "secret-user-agent@example.test",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { status: 200, async text() { throw new Error("body must not be read"); } };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.diagnostics.endpoint_category, "sec_ticker_map");
  assert.equal(result.diagnostics.status, 200);
  assert.equal(result.diagnostics.response_received, true);
  assert.equal(result.diagnostics.request_count, 1);
  assert.equal(request.options.headers["User-Agent"], "secret-user-agent@example.test");
});

test("non-200 SEC preflight response fails with safe status diagnostics", async () => {
  const result = await runSecConnectivityPreflight({ userAgent: "secret-agent", fetchImpl: async () => ({ status: 403 }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "sec_preflight_http_failure");
  assert.equal(result.diagnostics.status, 403);
  assert.equal(result.diagnostics.response_received, true);
  assert.equal(formatSecPreflightFailure(result).includes("secret-agent"), false);
});

test("SEC preflight classifies a bounded timeout without exposing error text", async () => {
  const result = await runSecConnectivityPreflight({
    userAgent: "secret-agent",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "sec_preflight_timeout");
  assert.equal(result.diagnostics.response_received, false);
  assert.equal(result.diagnostics.error.name, "TimeoutError");
  assert.equal(formatSecPreflightFailure(result).includes("secret-agent"), false);
  assert.equal(formatSecPreflightFailure(result).includes("SEC preflight timed out"), false);
});

test("SEC preflight classifies network denial with sanitized nested diagnostics", async () => {
  const cause = Object.assign(new Error("private network detail"), { code: "EACCES" });
  const error = Object.assign(new Error("request failed with secret context"), { code: "UND_ERR_CONNECT_TIMEOUT", cause });
  const result = await runSecConnectivityPreflight({ userAgent: "secret-agent", fetchImpl: async () => { throw error; } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "sec_preflight_network_failure");
  assert.equal(result.diagnostics.response_received, false);
  assert.equal(result.diagnostics.error.code, "UND_ERR_CONNECT_TIMEOUT");
  assert.equal(result.diagnostics.error.cause_code, "EACCES");
  const safe = formatSecPreflightFailure(result);
  assert.equal(safe.includes("private network detail"), false);
  assert.equal(safe.includes("secret-agent"), false);
});
