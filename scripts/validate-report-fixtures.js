import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(await readFile(path.join(root, "schema", "stock-report.schema.json"), "utf8"));
const fixtureDirectory = path.join(root, "fixtures", "reports");
const fixtureFiles = (await readdir(fixtureDirectory)).filter((file) => file.endsWith(".json")).sort();

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
let failed = false;

function semanticErrors(report) {
  const errors = [];
  const claims = new Map(report.claims.map((claim) => [claim.id, claim]));
  const sources = new Map(report.sources.map((source) => [source.id, source]));

  if (claims.size !== report.claims.length) errors.push("claim IDs must be unique");
  if (sources.size !== report.sources.length) errors.push("source IDs must be unique");

  for (const claim of report.claims) {
    if ((claim.state === "confirmed" || claim.state === "not_found") && claim.source_ids.length === 0) {
      errors.push(`${claim.id} must cite evidence when confirmed or not_found`);
    }
    for (const sourceId of claim.source_ids) {
      const source = sources.get(sourceId);
      if (!source) errors.push(`${claim.id} refers to missing ${sourceId}`);
      else if (!source.supported_claim_ids.includes(claim.id)) errors.push(`${sourceId} does not link back to ${claim.id}`);
    }
  }
  for (const source of report.sources) {
    for (const claimId of source.supported_claim_ids) {
      const claim = claims.get(claimId);
      if (!claim) errors.push(`${source.id} refers to missing ${claimId}`);
      else if (!claim.source_ids.includes(source.id)) errors.push(`${claimId} does not link back to ${source.id}`);
    }
  }

  const referencedClaimIds = [
    ...report.security.claim_ids, ...report.issuer.claim_ids,
    ...report.issuer.prior_identities.flatMap((identity) => identity.claim_ids),
    ...Object.values(report.sections).flatMap((section) => [section.claim_ids, ...section.items.map((item) => item.claim_ids)]).flat(),
    ...Object.values(report.scores).flatMap((score) => score.claim_ids)
  ];
  for (const claimId of referencedClaimIds) if (!claims.has(claimId)) errors.push(`report refers to missing ${claimId}`);

  if (report.metadata.completion_status === "complete" && report.metadata.coverage_limitations.length > 0) {
    errors.push("a complete report cannot declare coverage limitations");
  }
  return errors;
}

for (const fixtureFile of fixtureFiles) {
  const report = JSON.parse(await readFile(path.join(fixtureDirectory, fixtureFile), "utf8"));
  const schemaValid = validateSchema(report);
  const errors = semanticErrors(report);
  if (!schemaValid || errors.length > 0) {
    failed = true;
    console.error(`FAIL ${fixtureFile}`);
    if (!schemaValid) console.error(validateSchema.errors);
    for (const error of errors) console.error(`- ${error}`);
  } else {
    console.log(`PASS ${fixtureFile}`);
  }
}

if (fixtureFiles.length < 2) {
  failed = true;
  console.error("Expected at least one complete and one partial report fixture.");
}
if (failed) process.exitCode = 1;
