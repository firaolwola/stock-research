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
      keyword: error.keyword,
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
      ...Object.values(report.financial_assessment.metrics).flatMap((metric) => metric.claim_ids),
      ...report.financial_assessment.going_concern.claim_ids,
      ...report.financial_assessment.material_warnings.flatMap((warning) => warning.claim_ids),
      ...report.catalyst_assessment.current.claim_ids,
      ...Object.values(report.catalyst_assessment.current.factors).flatMap((factor) => factor.claim_ids),
      ...report.catalyst_assessment.historical_analogues.claim_ids,
      ...report.catalyst_assessment.historical_analogues.items.flatMap((analogue) => [
        ...analogue.claim_ids,
        ...analogue.reaction_windows.flatMap((window) => window.claim_ids)
      ]),
      ...report.catalyst_assessment.favorable_evidence_claim_ids,
      ...report.catalyst_assessment.unfavorable_evidence_claim_ids,
      ...report.catalyst_assessment.near_term_implication.claim_ids,
      ...Object.values(report.scores).flatMap((score) => [...score.claim_ids, ...score.components.flatMap((component) => component.claim_ids)])
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
    if (report.security.evidence_state === "confirmed" && (report.security.security_type === "unknown" || report.security.listing_status === "unknown")) {
      addError("confirmed security evidence requires resolved security type and listing status");
    }
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
      if (score.methodology_version !== "2.0.0") addError(`score ${scoreName} must use scoring methodology 2.0.0`);
      if (score.state === "confirmed" && score.confidence === "unknown") addError(`score ${scoreName} must expose evidence confidence when confirmed`);
      if (score.state !== "confirmed" && score.confidence !== "unknown") addError(`unscored ${scoreName} must use unknown confidence`);
      const componentKeys = new Set();
      for (const scoreComponent of score.components) {
        if (componentKeys.has(scoreComponent.key)) addError(`score ${scoreName} component keys must be unique`);
        componentKeys.add(scoreComponent.key);
        validateEvidenceReferences(`score ${scoreName} component ${scoreComponent.key}`, scoreComponent.state, scoreComponent.claim_ids);
        if (scoreComponent.state === "confirmed" && scoreComponent.value === null) addError(`confirmed score component ${scoreName}.${scoreComponent.key} requires a value`);
        if (scoreComponent.state !== "confirmed" && scoreComponent.value !== null) addError(`unresolved score component ${scoreName}.${scoreComponent.key} cannot have a value`);
      }
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

    const financial = report.financial_assessment;
    if (financial.state === "confirmed" && (!financial.as_of || !financial.reporting_currency)) {
      addError("confirmed financial assessment requires an as-of date and reporting currency");
    }
    if (financial.state === "confirmed" && Object.values(financial.metrics).some((metric) => ["unknown", "limited_coverage"].includes(metric.state))) {
      addError("confirmed financial assessment cannot contain unresolved metrics");
    }
    if (financial.state === "limited_coverage" && financial.coverage_notes.length === 0) {
      addError("limited financial assessment must explain coverage gaps");
    }
    if (financial.state === "not_applicable") {
      if (financial.as_of || financial.reporting_currency || financial.material_warnings.length > 0) {
        addError("not-applicable financial assessment cannot contain dates, currency, or warnings");
      }
      if (Object.values(financial.metrics).some((metric) => metric.state !== "not_applicable") || financial.going_concern.state !== "not_applicable") {
        addError("not-applicable financial assessment requires every component to be not_applicable");
      }
    }
    if (financial.state !== "confirmed" && report.scores.financial_health.state === "confirmed") {
      addError("unresolved financial evidence cannot produce a confirmed financial-health score");
    }

    for (const [metricName, metric] of Object.entries(financial.metrics)) {
      validateEvidenceReferences(`financial metric ${metricName}`, metric.state, metric.claim_ids);
      const observations = metric.observations ?? [];
      let previousObservation = null; let observationDuration = null;
      for (const [index, observation] of observations.entries()) {
        validateEvidenceReferences(`financial metric ${metricName} observation ${index + 1}`, "confirmed", observation.claim_ids);
        if (observation.period_start > observation.period_end) addError(`financial metric ${metricName} observation period start cannot be after end`);
        if (financial.as_of && observation.period_end > financial.as_of) addError(`financial metric ${metricName} observation cannot end after the assessment as-of date`);
        if (metric.unit && observation.unit !== metric.unit) addError(`financial metric ${metricName} observations must use the metric unit`);
        if (previousObservation && `${observation.period_end}:${observation.period_start}` <= `${previousObservation.period_end}:${previousObservation.period_start}`) addError(`financial metric ${metricName} observations must be unique and chronological`);
        const duration = Math.round((new Date(`${observation.period_end}T00:00:00Z`) - new Date(`${observation.period_start}T00:00:00Z`)) / 86_400_000);
        if (observationDuration === null) observationDuration = duration;
        else if (Math.abs(duration - observationDuration) > 3) addError(`financial metric ${metricName} observations must use comparable period lengths`);
        previousObservation = observation;
      }
      if (metric.period_start && metric.period_end && metric.period_start > metric.period_end) {
        addError(`financial metric ${metricName} period start cannot be after end`);
      }
      if (metric.comparison_period_start && metric.comparison_period_end && metric.comparison_period_start > metric.comparison_period_end) {
        addError(`financial metric ${metricName} comparison period start cannot be after end`);
      }
      if (financial.as_of && metric.comparison_period_end && metric.comparison_period_end > financial.as_of) {
        addError(`financial metric ${metricName} comparison period cannot end after the assessment as-of date`);
      }
      if (metric.state === "confirmed") {
        if (metric.value === null || !metric.unit || !metric.period_start || !metric.period_end) {
          addError(`confirmed financial metric ${metricName} requires a value, unit, and period`);
        }
        if (financial.as_of && metric.period_end && metric.period_end > financial.as_of) {
          addError(`financial metric ${metricName} cannot end after the assessment as-of date`);
        }
        if (["improving", "stable", "deteriorating", "mixed"].includes(metric.trend) && (!metric.comparison_period_start || !metric.comparison_period_end)) {
          addError(`financial metric ${metricName} trend requires a comparison period`);
        }
        if (financial.reporting_currency && !new RegExp(`^${financial.reporting_currency}(?:$|\\s)`).test(metric.unit)) {
          addError(`confirmed financial metric ${metricName} must use the reporting currency`);
        }
        if (metricName === "free_cash_flow" && /operating cash flow/i.test(metric.label)) {
          addError("free cash flow cannot be labeled as operating cash flow");
        }
        if (metricName === "debt" && /^(?:current|non-current|long-term|short-term)(?!.*total)/i.test(metric.label)) {
          addError("confirmed total debt cannot be labeled as a single debt component");
        }
        if (["cash", "cash_burn", "free_cash_flow", "debt"].includes(metricName) && financial.as_of && metric.period_end) {
          const ageDays = Math.floor((new Date(`${financial.as_of}T00:00:00Z`) - new Date(`${metric.period_end}T00:00:00Z`)) / 86_400_000);
          if (ageDays > 180) addError(`confirmed financial metric ${metricName} is too stale for current Fast evidence`);
        }
        if (observations.length > 0 && !observations.some((observation) => observation.value === metric.value && observation.unit === metric.unit && observation.period_start === metric.period_start && observation.period_end === metric.period_end)) {
          addError(`financial metric ${metricName} observations must include the reported current value and period`);
        }
      } else if (metric.value !== null || metric.unit !== null) {
        addError(`unresolved financial metric ${metricName} cannot contain a value or unit`);
      }
      if (metric.state !== "confirmed" && observations.length > 0) addError(`unresolved financial metric ${metricName} cannot contain chart observations`);
      if (metric.state !== "confirmed" && !["unknown", "not_applicable"].includes(metric.trend)) {
        addError(`unresolved financial metric ${metricName} cannot claim a favorable or unfavorable trend`);
      }
      if (metric.state === "not_applicable" && (metric.trend !== "not_applicable" || metric.claim_ids.length > 0 || metric.period_start || metric.period_end || metric.comparison_period_start || metric.comparison_period_end)) {
        addError(`not-applicable financial metric ${metricName} cannot contain periods, a trend claim, or evidence`);
      }
    }

    validateEvidenceReferences("going-concern assessment", financial.going_concern.state, financial.going_concern.claim_ids);
    if (["confirmed", "not_found"].includes(financial.going_concern.state) && !financial.going_concern.as_of) {
      addError("confirmed or not-found going-concern assessment requires an as-of date");
    }
    if (financial.going_concern.state === "not_applicable" && (financial.going_concern.as_of || financial.going_concern.claim_ids.length > 0)) {
      addError("not-applicable going-concern assessment cannot contain a date or evidence");
    }
    const warningIds = new Set();
    for (const warning of financial.material_warnings) {
      if (warningIds.has(warning.id)) addError(`financial warning IDs must be unique: ${warning.id}`);
      warningIds.add(warning.id);
      validateEvidenceReferences(`financial warning ${warning.id}`, warning.state, warning.claim_ids);
      if (warning.state === "confirmed" && (!warning.as_of || warning.severity === "unknown")) {
        addError(`confirmed financial warning ${warning.id} requires a date and severity`);
      }
    }
    if (financial.going_concern.state === "confirmed" && !financial.material_warnings.some((warning) => warning.kind === "going_concern" && warning.state === "confirmed")) {
      addError("confirmed going-concern evidence must be included in material financial warnings");
    }

    const catalyst = report.catalyst_assessment;
    validateEvidenceReferences("current catalyst", catalyst.current.state, catalyst.current.claim_ids);
    if (catalyst.current.state === "confirmed") {
      if (!catalyst.current.event_date) addError("confirmed current catalyst must include an event date");
      if (["unknown", "not_applicable"].includes(catalyst.current.classification)) addError("confirmed current catalyst must be classified");
      if (!["high", "medium"].includes(catalyst.current.confidence)) addError("confirmed current catalyst must use high or medium confidence");
    }
    for (const [factorName, factor] of Object.entries(catalyst.current.factors)) {
      const factorState = ["high", "medium", "low"].includes(factor.rating) ? "confirmed" : factor.rating;
      validateEvidenceReferences(`catalyst factor ${factorName}`, factorState, factor.claim_ids);
    }

    const analogues = catalyst.historical_analogues;
    validateEvidenceReferences("historical analogues", analogues.state, analogues.claim_ids);
    if (["unknown", "not_found"].includes(analogues.state) && analogues.items.length > 0) {
      addError(`${analogues.state} historical analogues cannot contain invented items`);
    }
    if (analogues.state === "unknown" && analogues.summary.match(/\b(?:no comparable event occurred|never had a comparable event)\b/i)) {
      addError("unknown historical analogues cannot claim proven absence");
    }
    if (analogues.state === "limited_coverage" && analogues.coverage_notes.length === 0) {
      addError("limited historical analogues must explain coverage gaps");
    }
    if (analogues.state === "confirmed" && analogues.items.length === 0) {
      addError("confirmed historical analogues must contain an item");
    }
    analogues.items.forEach((analogue) => {
      validateEvidenceReferences(`historical analogue ${analogue.id}`, analogue.state, analogue.claim_ids);
      if (analogue.state === "confirmed" && !analogue.event_date) addError(`historical analogue ${analogue.id} must include an event date`);
      if (analogue.comparison_limitations.length === 0) addError(`historical analogue ${analogue.id} must state comparison limitations`);
      analogue.reaction_windows.forEach((window, index) => {
        const label = `reaction window ${analogue.id}[${index}]`;
        validateEvidenceReferences(label, window.state, window.claim_ids);
        if (window.start > window.end) addError(`${label} start cannot be after end`);
        if (window.state === "confirmed" && window.price_change_percent === null) addError(`${label} must include a confirmed price change`);
        if (window.state !== "confirmed" && window.price_change_percent !== null) addError(`${label} cannot quantify an unresolved reaction`);
      });
    });

    const implication = catalyst.near_term_implication;
    validateEvidenceReferences("near-term catalyst implication", implication.state, implication.claim_ids);
    if (implication.state === "confirmed" && !["high", "medium"].includes(implication.confidence)) {
      addError("confirmed near-term catalyst implication must use high or medium confidence");
    }
    const catalystWording = [
      catalyst.current.title,
      catalyst.current.summary,
      implication.summary,
      ...catalyst.uncertainty,
      ...Object.values(catalyst.current.factors).map((factor) => factor.explanation),
      ...analogues.items.flatMap((analogue) => [analogue.title, analogue.comparison_basis, ...analogue.comparison_limitations, ...analogue.reaction_windows.map((window) => window.summary)]),
      report.scores.catalyst_strength.explanation,
      report.scores.near_term_setup_quality.explanation,
      ...new Set([
        ...catalyst.current.claim_ids,
        ...analogues.claim_ids,
        ...catalyst.favorable_evidence_claim_ids,
        ...catalyst.unfavorable_evidence_claim_ids,
        ...implication.claim_ids
      ].map((claimId) => claims.get(claimId)?.text).filter(Boolean))
    ].join(" ");
    if (/\b\d+(?:\.\d+)?%\s+(?:chance|probability|likely|odds)\b/i.test(catalystWording)) {
      addError("catalyst probability language cannot use unsupported numerical precision");
    }
    if (/\b(?:(?:buy|sell)\s+(?:the|this|before|after|at)|entry\s+(?:price|point)|exit\s+(?:price|point)|position siz(?:e|ing)|price target)\b/i.test(catalystWording)) {
      addError("catalyst assessment must remain non-advisory");
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
