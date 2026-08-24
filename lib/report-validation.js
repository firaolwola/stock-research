import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export function createReportValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);

  return function validateReport(report) {
    const schemaValid = validateSchema(report);
    const errors = schemaValid ? [] : validateSchema.errors.map((error) => ({
      type: "schema",
      path: error.instancePath,
      message: error.message
    }));
    if (!schemaValid) return { valid: false, errors };

    const claims = new Map(report.claims.map((claim) => [claim.id, claim]));
    const sources = new Map(report.sources.map((source) => [source.id, source]));
    const addError = (message) => errors.push({ type: "semantic", path: "", message });

    if (claims.size !== report.claims.length) addError("claim IDs must be unique");
    if (sources.size !== report.sources.length) addError("source IDs must be unique");

    for (const claim of report.claims) {
      if ((claim.state === "confirmed" || claim.state === "not_found") && claim.source_ids.length === 0) {
        addError(`${claim.id} must cite evidence when confirmed or not_found`);
      }
      for (const sourceId of claim.source_ids) {
        const source = sources.get(sourceId);
        if (!source) addError(`${claim.id} refers to missing ${sourceId}`);
        else if (!source.supported_claim_ids.includes(claim.id)) addError(`${sourceId} does not link back to ${claim.id}`);
      }
    }

    for (const source of report.sources) {
      for (const claimId of source.supported_claim_ids) {
        const claim = claims.get(claimId);
        if (!claim) addError(`${source.id} refers to missing ${claimId}`);
        else if (!claim.source_ids.includes(source.id)) addError(`${claimId} does not link back to ${source.id}`);
      }
    }

    const referencedClaimIds = [
      ...report.security.claim_ids,
      ...report.issuer.claim_ids,
      ...report.issuer.prior_identities.flatMap((identity) => identity.claim_ids),
      ...Object.values(report.sections).flatMap((section) => [
        ...section.claim_ids,
        ...section.items.flatMap((item) => item.claim_ids)
      ]),
      ...Object.values(report.scores).flatMap((score) => score.claim_ids)
    ];
    for (const claimId of referencedClaimIds) if (!claims.has(claimId)) addError(`report refers to missing ${claimId}`);

    if (report.metadata.completion_status === "complete" && report.metadata.coverage_limitations.length > 0) {
      addError("a complete report cannot declare coverage limitations");
    }

    return { valid: errors.length === 0, errors };
  };
}
