import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadJson(...segments) {
  return JSON.parse(await readFile(path.join(root, ...segments), "utf8"));
}

export function loadReportSchema() {
  return loadJson("schema", "stock-report.schema.json");
}

export function loadReportFixture(name) {
  if (!new Set(["complete", "partial"]).has(name)) throw new TypeError(`Unknown report fixture: ${name}`);
  return loadJson("fixtures", "reports", `${name}.json`);
}
