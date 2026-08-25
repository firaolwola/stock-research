export const MATERIAL_RISK_CATEGORIES = Object.freeze([
  "security_and_listing", "issuer_lineage", "reverse_splits", "dilution_offerings",
  "warrants_convertibles", "dividends", "compliance", "going_concern_accounting",
  "financial_context", "catalysts_news", "uncertainty"
]);

const SIZE_BUCKETS = new Set(["large", "mid", "small", "micro", "not_applicable"]);
const NONSTANDARD_TYPES = new Set(["adr", "etf", "warrant", "preferred_stock", "foreign_ordinary_share", "other"]);
const PRIMARY_SOURCE_TYPES = new Set(["sec_filing", "exchange_notice", "company_release", "company_filing", "other_primary"]);

export function validateEvaluationSet(evaluationSet) {
  const errors = [];
  const add = (message) => errors.push(message);
  if (evaluationSet?.version !== "1.0.0") add("evaluation set version must be 1.0.0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluationSet?.reviewed_at || "")) add("reviewed_at must be an ISO date");
  if (!Array.isArray(evaluationSet?.cases) || evaluationSet.cases.length === 0) add("cases must be a non-empty array");
  if (evaluationSet?.live_evaluation_policy?.requires_explicit_approval !== true) add("paid live evaluation must require explicit approval");
  if (!Number.isInteger(evaluationSet?.live_evaluation_policy?.max_cases_per_approved_run) || evaluationSet.live_evaluation_policy.max_cases_per_approved_run < 1) add("paid live evaluation must have a positive case bound");
  if (evaluationSet?.rubric?.material_risk_recall?.target !== 0.95) add("material-risk recall target must be 0.95");
  if (evaluationSet?.rubric?.material_risk_recall?.report_by_category !== true) add("rubric must require category-level recall");

  const ids = new Set();
  const factIds = new Set();
  const categories = new Set();
  const sizes = new Set();
  let hasNonstandard = false;
  let hasLineage = false;
  let hasOtcOrDelisted = false;
  let hasStrongCatalyst = false;
  let hasWeakCatalyst = false;
  let deterministicCases = 0;

  for (const scenario of evaluationSet?.cases || []) {
    if (!scenario.id || ids.has(scenario.id)) add(`case IDs must be present and unique: ${scenario.id || "missing"}`);
    ids.add(scenario.id);
    if (!scenario.why) add(`${scenario.id} must explain why it exists`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scenario.as_of || "")) add(`${scenario.id} must have an explicit as_of date`);
    if (scenario.kind === "deterministic_app") {
      deterministicCases += 1;
      if (!scenario.expected_app_result?.code || !Number.isInteger(scenario.expected_app_result?.status)) add(`${scenario.id} must define a deterministic status and code`);
      continue;
    }
    if (scenario.kind !== "research_quality") add(`${scenario.id} has an unsupported kind`);
    if (!SIZE_BUCKETS.has(scenario.size_bucket)) add(`${scenario.id} has an unsupported size bucket`);
    sizes.add(scenario.size_bucket);
    if (NONSTANDARD_TYPES.has(scenario.security_type)) hasNonstandard = true;
    if (["otc", "delisted"].includes(scenario.listing_profile)) hasOtcOrDelisted = true;
    if (scenario.catalyst_profile === "strong") hasStrongCatalyst = true;
    if (scenario.catalyst_profile === "weak") hasWeakCatalyst = true;
    if (!scenario.why || !Array.isArray(scenario.expected_evidence) || scenario.expected_evidence.length === 0) add(`${scenario.id} must define expected evidence categories`);
    for (const category of scenario.expected_evidence || []) {
      if (!MATERIAL_RISK_CATEGORIES.includes(category)) add(`${scenario.id} uses unknown evidence category ${category}`);
      categories.add(category);
    }
    if (!Array.isArray(scenario.known_material_facts)) add(`${scenario.id} must define known material facts`);
    for (const fact of scenario.known_material_facts || []) {
      if (!fact.id || factIds.has(fact.id)) add(`fact IDs must be present and globally unique: ${fact.id || "missing"}`);
      factIds.add(fact.id);
      if (!MATERIAL_RISK_CATEGORIES.includes(fact.category)) add(`${fact.id} uses unknown category ${fact.category}`);
      if (!scenario.expected_evidence?.includes(fact.category)) add(`${fact.id} is outside its scenario's expected evidence`);
      if (!fact.description || !["high", "medium"].includes(fact.materiality)) add(`${fact.id} must describe a high- or medium-materiality expectation`);
      if (!["confirmed", "unknown", "limited_coverage", "not_applicable"].includes(fact.expected_state)) add(`${fact.id} has an unsupported expected state`);
      if (fact.category === "issuer_lineage") hasLineage = true;
      if (fact.expected_state === "confirmed" && (!Array.isArray(fact.sources) || fact.sources.length === 0)) add(`${fact.id} requires primary expectation evidence`);
      for (const source of fact.sources || []) {
        if (!source.title || !/^https:\/\//.test(source.url || "") || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_date || "")) add(`${fact.id} has malformed source metadata`);
        else if (source.published_date > scenario.as_of) add(`${fact.id} cites evidence published after its as_of date`);
      }
    }
  }

  for (const category of MATERIAL_RISK_CATEGORIES) if (!categories.has(category)) add(`evaluation coverage is missing ${category}`);
  for (const size of ["large", "mid", "small", "micro"]) if (!sizes.has(size)) add(`evaluation coverage is missing ${size}-cap cases`);
  if (!hasNonstandard) add("evaluation coverage needs a nonstandard security");
  if (!hasLineage) add("evaluation coverage needs issuer lineage");
  if (!hasOtcOrDelisted) add("evaluation coverage needs OTC or delisted securities");
  if (!hasStrongCatalyst || !hasWeakCatalyst) add("evaluation coverage needs strong and weak catalyst cases");
  if (deterministicCases < 2) add("evaluation coverage needs multiple deterministic app failures");
  return { valid: errors.length === 0, errors };
}

export function evaluateSample(evaluationSet, sample) {
  const validation = validateEvaluationSet(evaluationSet);
  if (!validation.valid) throw new TypeError(`Invalid evaluation set: ${validation.errors.join("; ")}`);
  const cases = new Map(evaluationSet.cases.map((scenario) => [scenario.id, scenario]));
  const categoryCounts = new Map(MATERIAL_RISK_CATEGORIES.map((category) => [category, { expected: 0, detected: 0 }]));
  const researchFailures = [];
  const deterministicFailures = [];
  let expectedFacts = 0;
  let detectedFacts = 0;
  let expectedEvidence = 0;
  let addressedEvidence = 0;
  let supportedDetections = 0;
  let totalDetections = 0;
  let primarySourceChecks = 0;
  let sourceChecks = 0;
  let uncertaintyExpected = 0;
  let uncertaintyCorrect = 0;
  const latencies = [];
  const clarityRatings = [];
  let totalCost = 0;

  for (const run of sample.runs || []) {
    const scenario = cases.get(run.case_id);
    if (!scenario) throw new TypeError(`Unknown evaluation case: ${run.case_id}`);
    if (scenario.kind === "deterministic_app") {
      if (run.status !== scenario.expected_app_result.status || run.code !== scenario.expected_app_result.code) deterministicFailures.push(run.case_id);
      continue;
    }
    if (run.result_kind === "deterministic_app_failure") {
      researchFailures.push({ case_id: run.case_id, reason: "deterministic application failure" });
      continue;
    }
    const detected = new Set(run.detected_fact_ids || []);
    for (const fact of scenario.known_material_facts) {
      expectedFacts += 1;
      const counts = categoryCounts.get(fact.category);
      counts.expected += 1;
      if (detected.has(fact.id)) { detectedFacts += 1; counts.detected += 1; }
      if (["unknown", "limited_coverage", "not_applicable"].includes(fact.expected_state)) {
        uncertaintyExpected += 1;
        if (run.reported_states?.[fact.id] === fact.expected_state) uncertaintyCorrect += 1;
      }
    }
    const addressed = new Set(run.addressed_evidence || []);
    expectedEvidence += scenario.expected_evidence.length;
    addressedEvidence += scenario.expected_evidence.filter((category) => addressed.has(category)).length;
    for (const check of run.source_checks || []) {
      sourceChecks += 1;
      if (PRIMARY_SOURCE_TYPES.has(check.source_type)) primarySourceChecks += 1;
      totalDetections += 1;
      if (check.factually_supported === true) supportedDetections += 1;
    }
    if (Number.isFinite(run.latency_ms)) latencies.push(run.latency_ms);
    if (Number.isFinite(run.estimated_cost_usd)) totalCost += run.estimated_cost_usd;
    if (Number.isFinite(run.clarity_rating) && run.clarity_rating >= 1 && run.clarity_rating <= 5) clarityRatings.push(run.clarity_rating);
  }

  const recall = expectedFacts ? detectedFacts / expectedFacts : null;
  return {
    set_version: evaluationSet.version,
    sample_as_of: sample.as_of,
    evaluated_cases: sample.runs.length,
    research_quality: {
      material_risk_recall: recall,
      target: evaluationSet.rubric.material_risk_recall.target,
      meets_target: recall === null ? null : recall >= evaluationSet.rubric.material_risk_recall.target,
      recall_by_category: Object.fromEntries([...categoryCounts].filter(([, value]) => value.expected > 0).map(([category, value]) => [category, { ...value, recall: value.detected / value.expected }])),
      completeness: expectedEvidence ? addressedEvidence / expectedEvidence : null,
      primary_source_share: sourceChecks ? primarySourceChecks / sourceChecks : null,
      factual_support_rate: totalDetections ? supportedDetections / totalDetections : null,
      uncertainty_accuracy: uncertaintyExpected ? uncertaintyCorrect / uncertaintyExpected : null,
      average_clarity_rating: clarityRatings.length ? clarityRatings.reduce((sum, value) => sum + value, 0) / clarityRatings.length : null,
      deterministic_app_failures: researchFailures
    },
    operations: {
      latency_ms: latencies,
      estimated_cost_usd: totalCost,
      note: sample.live_calls === false ? "Token-free dry run; latency and cost are illustrative only." : "Approved bounded live measurements."
    },
    deterministic_app_checks: {
      evaluated: (sample.runs || []).filter((run) => cases.get(run.case_id)?.kind === "deterministic_app").length,
      failures: deterministicFailures
    }
  };
}
