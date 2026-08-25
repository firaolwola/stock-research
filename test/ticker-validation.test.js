import assert from "node:assert/strict";
import test from "node:test";
import { TICKER_ERRORS, validateTicker } from "../ticker-validation.js";

test("ticker validation normalizes documented valid syntax", () => {
  const cases = new Map([
    [" acme ", "ACME"],
    ["BRK.B", "BRK.B"],
    ["bf-b", "BF-B"],
    ["7203", "7203"],
    ["ABC123", "ABC123"],
    ["A23456789012345", "A23456789012345"]
  ]);

  for (const [input, expected] of cases) {
    assert.deepEqual(validateTicker(input), { valid: true, ticker: expected, error: null });
  }
});

test("ticker validation distinguishes empty and malformed syntax", () => {
  for (const input of [undefined, null, "", "   "]) {
    assert.deepEqual(validateTicker(input).error, TICKER_ERRORS.required);
  }

  for (const input of ["A/B", ".ABC", "ABC-", "A..B", "A--B", "A B", "A_B", "A234567890123456"]) {
    const result = validateTicker(input);
    assert.equal(result.valid, false, `${input} should be invalid`);
    assert.deepEqual(result.error, TICKER_ERRORS.invalid);
  }
});

test("valid syntax does not claim that a security exists or is supported", () => {
  assert.equal(validateTicker("UNKNOWN").valid, true);
});
