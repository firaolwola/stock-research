import assert from "node:assert/strict";
import test from "node:test";
import { createReportValidator } from "../lib/report-validation.js";
import { loadLineageFixture, loadReportFixture, loadReportSchema } from "../support/report-fixtures.js";

const validateReport = createReportValidator(await loadReportSchema());

function addSourcedClaim(report, claim) {
  report.claims.push(claim);
  report.sources.push({
    id: `source-${claim.id.slice("claim-".length)}`,
    title: "Official issuer history record",
    url: "https://www.sec.gov/Archives/example/issuer-history",
    published_date: "2022-06-30",
    source_type: "sec_filing",
    confidence: "high",
    retrieved_at: "2026-08-24T14:58:00Z",
    supported_claim_ids: [claim.id]
  });
}

async function confirmedLineageReport(fixtureName) {
  const fixture = await loadLineageFixture(fixtureName);
  const report = await loadReportFixture("complete");
  const lineageClaim = report.claims.find((claim) => claim.id === "claim-lineage");
  lineageClaim.text = `${fixture.prior_identity.name} (${fixture.prior_identity.ticker}) is a confirmed prior identity of Acme Holdings, Inc.`;
  report.issuer.prior_identities = [{ ...fixture.prior_identity, claim_ids: [lineageClaim.id] }];

  const eventClaim = {
    id: `claim-history-${fixtureName}`,
    text: `A material ${fixture.event.kind} occurred under the confirmed prior identity.`,
    materiality: "high",
    state: "confirmed",
    as_of: "2026-08-24T15:00:00Z",
    source_ids: [`source-history-${fixtureName}`]
  };
  addSourcedClaim(report, eventClaim);
  const section = report.sections[fixture.event.section];
  section.state = "confirmed";
  section.summary = "Material issuer history includes an event from a confirmed prior identity.";
  section.items = [{
    id: `history-${fixtureName}`,
    kind: fixture.event.kind,
    title: "Carried issuer-history event",
    state: "confirmed",
    summary: "This event occurred while the issuer used its confirmed prior identity.",
    event_date: fixture.event.event_date,
    claim_ids: [eventClaim.id, lineageClaim.id]
  }];
  section.claim_ids = [eventClaim.id, lineageClaim.id];
  return { fixture, report };
}

for (const fixtureName of ["ticker-change", "company-rename", "rebrand"]) {
  test(`${fixtureName} carries material history through confirmed lineage`, async () => {
    const { fixture, report } = await confirmedLineageReport(fixtureName);
    assert.deepEqual(validateReport(report), { valid: true, errors: [] });
    assert.ok(report.sections[fixture.event.section].items[0].claim_ids.includes("claim-lineage"));
  });
}

test("history in a confirmed prior-identity period must reference the linkage", async () => {
  const { fixture, report } = await confirmedLineageReport("ticker-change");
  report.sections[fixture.event.section].items[0].claim_ids = ["claim-history-ticker-change"];

  const result = validateReport(report);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.message.includes("must reference confirmed lineage")));
});

test("confirmed lineage requires dates, supported claims, and meaningful confidence", async () => {
  for (const mutate of [
    (identity) => { identity.effective_from = null; },
    (identity) => { identity.linkage_confidence = "low"; },
    (_identity, report) => { report.claims.find((claim) => claim.id === "claim-lineage").state = "unknown"; }
  ]) {
    const { report } = await confirmedLineageReport("ticker-change");
    mutate(report.issuer.prior_identities[0], report);
    assert.equal(validateReport(report).valid, false);
  }
});

test("ambiguous lineage remains unresolved and cannot carry confirmed history", async () => {
  const fixture = await loadLineageFixture("ambiguous");
  const report = await loadReportFixture("partial");
  report.issuer.prior_identities = [{ ...fixture.prior_identity, claim_ids: [] }];
  assert.equal(report.sections[fixture.event.section].state, fixture.expected_section_state);
  assert.deepEqual(validateReport(report), { valid: true, errors: [] });

  addSourcedClaim(report, {
    id: "claim-ambiguous-linkage",
    text: "Available records suggest but do not establish a predecessor relationship.",
    materiality: "high",
    state: "unknown",
    as_of: "2026-08-24T16:00:00Z",
    source_ids: ["source-ambiguous-linkage"]
  });
  report.issuer.prior_identities[0].claim_ids = ["claim-ambiguous-linkage"];
  const incorrectlyResolved = structuredClone(report);
  incorrectlyResolved.issuer.identity_state = "confirmed";
  incorrectlyResolved.issuer.identity_confidence = "high";
  assert.ok(validateReport(incorrectlyResolved).errors.some((error) => error.message.includes("issuer identity must remain")));

  report.sections.dilution.items = [{
    id: "ambiguous-history",
    kind: fixture.event.kind,
    title: "Possible predecessor offering",
    state: "confirmed",
    summary: "This event cannot be assigned to the current issuer reliably.",
    event_date: fixture.event.event_date,
    claim_ids: ["claim-ambiguous-linkage", "claim-xyz-identity"]
  }];
  assert.ok(validateReport(report).errors.some((error) => error.message.includes("cannot carry history through unresolved lineage")));
});

test("delisted common stocks and nonstandard securities retain explicit listing context", async () => {
  const delistedFixture = await loadLineageFixture("delisted");
  const delisted = await loadReportFixture("complete");
  Object.assign(delisted.security, delistedFixture.security);
  assert.deepEqual(validateReport(delisted), { valid: true, errors: [] });

  const nonstandard = await loadReportFixture("partial");
  assert.equal(nonstandard.security.security_type, "warrant");
  assert.equal(nonstandard.security.listing_status, "active");
  assert.deepEqual(validateReport(nonstandard), { valid: true, errors: [] });
});
