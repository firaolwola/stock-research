import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReportValidator } from "../lib/report-validation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const fixtureDirectory = path.join(root, "fixtures", "reports");
const fixtureFiles = (await readdir(fixtureDirectory)).filter((file) => file.endsWith(".json")).sort();

const validateReport = createReportValidator(schema);
let failed = false;

for (const fixtureFile of fixtureFiles) {
  const report = JSON.parse(await readFile(path.join(fixtureDirectory, fixtureFile), "utf8"));
  const result = validateReport(report);
  if (!result.valid) {
    failed = true;
    console.error(`FAIL ${fixtureFile}`);
    for (const error of result.errors) {
      console.error(`- ${error.type} ${error.path || "/"}: ${error.message}`);
    }
  } else {
    console.log(`PASS ${fixtureFile}`);
  }
}

if (fixtureFiles.length < 2) {
  failed = true;
  console.error("Expected at least one complete and one partial report fixture.");
}
if (failed) process.exitCode = 1;
