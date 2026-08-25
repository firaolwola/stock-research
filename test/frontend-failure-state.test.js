import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser restores the analyze control after every completed request path", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /id="analyze-button"/);
  assert.match(html, /analyzeButton\.disabled = true;/);
  assert.match(html, /finally\s*{[\s\S]*analyzeButton\.disabled = false;/);
});
