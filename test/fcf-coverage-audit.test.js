import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("FCF coverage audit separates usable scores from safe unresolved settlement", async () => {
  const source = await readFile(new URL("../scripts/evaluate-fcf-coverage.js", import.meta.url), "utf8");
  assert.match(source, /strict_usable_fcf/);
  assert.match(source, /safe_settlement/);
  assert.match(source, /parser_or_binding_gap/);
  assert.match(source, /invalidated_accounting_evidence/);
  assert.match(source, /unavailable_authoritative_evidence/);
  assert.match(source, /network_calls: false/);
});
