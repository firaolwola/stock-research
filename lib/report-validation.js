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
    const sourcedStates = new Set(["confirmed", "not_found"]);
    const secondarySourceTypes = new Set(["secondary_aggregator", "other_secondary"]);

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
      if (source.title.trim() === "") addError(`${source.id} must have a useful title`);
      if (secondarySourceTypes.has(source.source_type) && source.confidence === "high") {
        addError(`${source.id} cannot assign high confidence to secondary evidence`);
      }
      if (source.published_date > source.retrieved_at.slice(0, 10)) {
        addError(`${source.id} cannot be retrieved before its publication date`);
      }
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

    const validateEvidenceReferences = (label, state, claimIds) => {
      if (!sourcedStates.has(state)) return;
      if (claimIds.length === 0) {
        addError(`${label} must reference a claim when ${state}`);
        return;
      }
      const hasSourcedClaim = claimIds.some((claimId) => {
        const claim = claims.get(claimId);
        return claim && sourcedStates.has(claim.state) && claim.source_ids.length > 0;
      });
      if (!hasSourcedClaim) addError(`${label} must reference sourced evidence when ${state}`);
    };

    validateEvidenceReferences("security", report.security.evidence_state, report.security.claim_ids);
    validateEvidenceReferences("issuer", report.issuer.identity_state, report.issuer.claim_ids);
    report.issuer.prior_identities.forEach((identity, index) =>
      validateEvidenceReferences(`prior identity ${index}`, identity.linkage_state, identity.claim_ids)
    );
    for (const [sectionName, section] of Object.entries(report.sections)) {
      validateEvidenceReferences(`section ${sectionName}`, section.state, section.claim_ids);
      section.items.forEach((item) =>
        validateEvidenceReferences(`section item ${item.id}`, item.state, item.claim_ids)
      );
    }
    for (const [scoreName, score] of Object.entries(report.scores)) {
      validateEvidenceReferences(`score ${scoreName}`, score.state, score.claim_ids);
    }

    if (report.metadata.completion_status === "complete" && report.metadata.coverage_limitations.length > 0) {
      addError("a complete report cannot declare coverage limitations");
    }

    return { valid: errors.length === 0, errors };
  };
}
