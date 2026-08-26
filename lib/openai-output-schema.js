const UNSUPPORTED_COMPOSITION_KEYWORDS = new Set([
  "allOf", "not", "dependentRequired", "dependentSchemas", "if", "then", "else"
]);

export function projectOpenAISchema(schema) {
  const project = (value) => {
    if (Array.isArray(value)) return value.map(project);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !UNSUPPORTED_COMPOSITION_KEYWORDS.has(key) && !["$schema", "$id"].includes(key))
      .map(([key, child]) => [key, project(child)]));
  };
  return project(schema);
}

export function createOpenAIOutputSchema(schema, { stage = "fast" } = {}) {
  if (!schema || typeof schema !== "object") throw new TypeError("A JSON Schema object is required");
  if (!["fast", "deep"].includes(stage)) throw new TypeError("OpenAI output schema stage must be fast or deep");
  const output = projectOpenAISchema(schema);
  output.required = output.required.filter((key) => key !== "scores");
  delete output.properties.scores;
  delete output.$defs.score;
  delete output.$defs.scoreComponent;

  output.$defs.nonEmptyString.maxLength = stage === "fast" ? 240 : 500;
  output.$defs.metadata.properties.stage = { const: stage };
  output.properties.claims.maxItems = stage === "fast" ? 30 : 80;
  output.properties.sources.maxItems = stage === "fast" ? 15 : 40;
  output.$defs.metadata.properties.coverage_limitations.maxItems = stage === "fast" ? 6 : 15;
  output.$defs.issuer.properties.prior_identities.maxItems = stage === "fast" ? 3 : 10;
  output.$defs.reportSection.properties.items.maxItems = stage === "fast" ? 5 : 15;
  output.$defs.financialAssessment.properties.material_warnings.maxItems = stage === "fast" ? 5 : 12;
  output.$defs.historicalAnalogueAssessment.properties.items.maxItems = stage === "fast" ? 0 : 3;
  output.$defs.historicalAnalogue.properties.reaction_windows.maxItems = stage === "fast" ? 0 : 4;
  if (stage === "fast") {
    output.$defs.metadata.properties.completion_status = { enum: ["partial", "pending"] };
    output.$defs.historicalAnalogueAssessment.properties.state = { enum: ["unknown", "limited_coverage", "not_applicable"] };
  }
  return output;
}

export function findUnsupportedOpenAIKeywords(schema) {
  const found = [];
  const visit = (value, path = "$") => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (UNSUPPORTED_COMPOSITION_KEYWORDS.has(key)) found.push(`${path}.${key}`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(schema);
  return found;
}
