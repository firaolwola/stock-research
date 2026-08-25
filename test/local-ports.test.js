import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_APP_PORT, REAL_APP_PORT } from "../local-ports.js";

test("real and mock applications use distinct documented ports", () => {
  assert.equal(REAL_APP_PORT, 3000);
  assert.equal(MOCK_APP_PORT, 3001);
  assert.notEqual(REAL_APP_PORT, MOCK_APP_PORT);
});
