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
      if (claim.state === "not_applicable" && claim.source_ids.length > 0) {
        addError(`${claim.id} cannot cite evidence when not_applicable`);
      }
      if (claim.state === "not_found" && /\b(?:never occurred|no .+ ever occurred|proves? (?:that )?(?:no|none))\b/i.test(claim.text)) {
        addError(`${claim.id} overstates a not_found search as proven absence`);
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
      if (state === "not_applicable" && claimIds.length > 0) {
        addError(`${label} cannot reference claims when not_applicable`);
      }
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
    const confirmedPriorIdentities = [];
    const unresolvedLineageClaimIds = new Set();
    report.issuer.prior_identities.forEach((identity, index) => {
      const label = `prior identity ${index}`;
      validateEvidenceReferences(label, identity.linkage_state, identity.claim_ids);

      if (identity.effective_from && identity.effective_to && identity.effective_from > identity.effective_to) {
        addError(`${label} effective_from cannot be after effective_to`);
      }

      if (identity.linkage_state === "confirmed") {
        if (!identity.effective_from || !identity.effective_to) {
          addError(`${label} must include effective_from and effective_to when confirmed`);
        }
        if (!new Set(["high", "medium"]).has(identity.linkage_confidence)) {
          addError(`${label} must use high or medium confidence when confirmed`);
        }
        const unsupportedClaimId = identity.claim_ids.find((claimId) => {
          const claim = claims.get(claimId);
          return !claim || claim.state !== "confirmed" || claim.source_ids.length === 0;
        });
        if (unsupportedClaimId) addError(`${label} cannot use unresolved ${unsupportedClaimId}`);
        confirmedPriorIdentities.push(identity);
      } else {
        identity.claim_ids.forEach((claimId) => unresolvedLineageClaimIds.add(claimId));
      }
    });

    if (report.issuer.identity_state === "confirmed" && !new Set(["high", "medium"]).has(report.issuer.identity_confidence)) {
      addError("issuer must use high or medium identity confidence when confirmed");
    }

    const carriedHistorySections = new Set(["reverse_splits", "dilution", "compliance_and_warnings"]);
    if (unresolvedLineageClaimIds.size > 0 || report.issuer.prior_identities.some((identity) => identity.linkage_state !== "confirmed")) {
      if (!new Set(["unknown", "limited_coverage"]).has(report.issuer.identity_state)) {
        addError("issuer identity must remain unknown or limited_coverage when prior lineage is unresolved");
      }
      const lineageLimitation = report.metadata.coverage_limitations.find((limitation) =>
        limitation.affected_sections.includes("issuer")
      );
      if (!lineageLimitation) addError("unresolved prior lineage must declare an issuer coverage limitation");
      for (const sectionName of lineageLimitation?.affected_sections ?? []) {
        if (carriedHistorySections.has(sectionName) && !new Set(["unknown", "limited_coverage"]).has(report.sections[sectionName].state)) {
          addError(`section ${sectionName} must remain unknown or limited_coverage when affected by unresolved lineage`);
        }
      }
    }

    for (const [sectionName, section] of Object.entries(report.sections)) {
      validateEvidenceReferences(`section ${sectionName}`, section.state, section.claim_ids);
      section.items.forEach((item) => {
        validateEvidenceReferences(`section item ${item.id}`, item.state, item.claim_ids);
        if (item.state === "confirmed" && item.claim_ids.some((claimId) => unresolvedLineageClaimIds.has(claimId))) {
          addError(`section item ${item.id} cannot carry history through unresolved lineage`);
        }
        if (carriedHistorySections.has(sectionName) && item.event_date) {
          const matchingIdentity = confirmedPriorIdentities.find((identity) =>
            identity.effective_from <= item.event_date && item.event_date <= identity.effective_to
          );
          if (matchingIdentity && !item.claim_ids.some((claimId) => matchingIdentity.claim_ids.includes(claimId))) {
            addError(`section item ${item.id} must reference confirmed lineage for its historical identity period`);
          }
        }
      });
      if (section.state === "not_found" && section.items.length > 0) {
        addError(`section ${sectionName} cannot contain items when not_found`);
      }
      if (section.state === "not_applicable" && (section.items.length > 0 || section.claim_ids.length > 0)) {
        addError(`section ${sectionName} cannot contain items or claims when not_applicable`);
      }
      if (section.state === "limited_coverage" && section.coverage_notes.length === 0) {
        addError(`section ${sectionName} must explain limited coverage`);
      }
    }
    for (const [scoreName, score] of Object.entries(report.scores)) {
      validateEvidenceReferences(`score ${scoreName}`, score.state, score.claim_ids);
      if (score.state === "confirmed") {
        const unsupportedClaim = score.claim_ids.find((claimId) => {
          const claim = claims.get(claimId);
          return !claim || !sourcedStates.has(claim.state) || claim.source_ids.length === 0;
        });
        if (unsupportedClaim) addError(`score ${scoreName} cannot use unresolved ${unsupportedClaim}`);
      }
      if (score.state === "not_applicable" && score.claim_ids.length > 0) {
        addError(`score ${scoreName} cannot cite claims when not_applicable`);
      }
    }

    if (report.metadata.completion_status === "complete" && report.metadata.coverage_limitations.length > 0) {
      addError("a complete report cannot declare coverage limitations");
    }
    if (report.metadata.completion_status !== "complete" && report.metadata.coverage_limitations.length === 0) {
      addError(`${report.metadata.completion_status} reports must declare coverage limitations`);
    }

    return { valid: errors.length === 0, errors };
  };
}
