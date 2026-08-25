import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser restores the analyze control after every completed request path", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../public/dashboard.js", import.meta.url), "utf8");

  assert.match(html, /id="analyze-button"/);
  assert.match(script, /if \(submitting\) return/);
  assert.match(script, /analyzeButton\.disabled = true/);
  assert.match(script, /finally\s*{[\s\S]*analyzeButton\.disabled = false/);
});
