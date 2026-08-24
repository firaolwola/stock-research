import assert from "node:assert/strict";
import test from "node:test";
import { createReportValidator } from "../lib/report-validation.js";
import { loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

test("shared complete and partial fixtures validate", async () => {
  const validateReport = createReportValidator(await loadReportSchema());
  for (const name of ["complete", "partial"]) {
    const result = validateReport(await loadReportFixture(name));
    assert.deepEqual(result, { valid: true, errors: [] }, `${name} fixture should validate`);
  }
});

test("invalid fixture data returns useful schema diagnostics", async () => {
  const validateReport = createReportValidator(await loadReportSchema());
  const report = await loadReportFixture("complete");
  report.schema_version = "not-supported";

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.type === "schema" && error.path === "/schema_version"));
});

test("broken claim/source links return useful semantic diagnostics", async () => {
  const validateReport = createReportValidator(await loadReportSchema());
  const report = await loadReportFixture("complete");
  report.claims[0].source_ids = ["source-missing"];

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.type === "semantic" && error.message.includes("source-missing")));
});
