const UNSUPPORTED_COMPOSITION_KEYWORDS = new Set([
  "allOf", "not", "dependentRequired", "dependentSchemas", "if", "then", "else"
]);

export function createOpenAIOutputSchema(schema) {
  if (!schema || typeof schema !== "object") throw new TypeError("A JSON Schema object is required");
  const project = (value) => {
    if (Array.isArray(value)) return value.map(project);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !UNSUPPORTED_COMPOSITION_KEYWORDS.has(key) && !["$schema", "$id"].includes(key))
      .map(([key, child]) => [key, project(child)]));
  };
  return project(schema);
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
