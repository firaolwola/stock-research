const sentenceRanges = (text) => {
  const ranges = [];
  const pattern = /[^.!?]+(?:[.!?]+|$)/g;
  const original = String(text ?? "");
  const protectedText = original.replace(/\bU\.S\./gi, (value) => value.replaceAll(".", "·"));
  for (const match of protectedText.matchAll(pattern)) {
    const value = original.slice(match.index, match.index + match[0].length).trim();
    if (value) ranges.push({ text: value, start: match.index, end: match.index + match[0].length });
  }
  return ranges;
};

const candidate = (property, value, document, range, authority, qualifiers = {}) => ({
  property,
  value,
  issuer_cik: document.cik ?? null,
  security_ticker: document.ticker ?? null,
  accession: document.row?.accession ?? null,
  form: document.row?.form ?? null,
  filed: document.row?.filed ?? null,
  section_or_block: qualifiers.section_or_block ?? "sentence",
  source_span: { start: range.start, end: range.end },
  authority,
  date_role: "filing_date",
  lifecycle: "current_reported_property",
  rule_id: qualifiers.rule_id ?? null,
  contextual_qualifiers: qualifiers
});

const strongest = (items) => {
  if (!items.length) return { state: "unresolved", value: "unknown", candidate: null };
  const strength = Math.max(...items.map((item) => item.authority));
  const strongestItems = items.filter((item) => item.authority === strength);
  const values = new Set(strongestItems.map((item) => item.value));
  return values.size === 1
    ? { state: "confirmed", value: strongestItems[0].value, candidate: strongestItems[0] }
    : { state: "conflicting", value: "unknown", candidate: null };
};

export function resolveReportingPropertyCandidates(documents) {
  const candidates = [];
  for (const document of documents) {
    const text = String(document.text ?? "");
    for (const range of sentenceRanges(text)) {
      const sentence = range.text.replace(/\s+/g, " ");
      const statementBasis = /(?:consolidated\s+)?financial statements?.{0,100}(?:prepared|presented|reported).{0,80}(?:in accordance with|under)/i.test(sentence);
      const ifrs = /IFRS(?:®)?\s+(?:Accounting Standards|Standards)?\s*,?\s*as issued by (?:the )?(?:International Accounting Standards Board|IASB)|International Financial Reporting Standards\s*,?\s*as issued by (?:the )?(?:International Accounting Standards Board|IASB)/i.test(sentence);
      const usGaap = /(?:United States|U\.S\.)\s+(?:generally accepted accounting principles|GAAP)/i.test(sentence);
      if (statementBasis && ifrs) candidates.push(candidate("accounting_basis", "IFRS", document, range, 100, { declaration: "financial_statement_basis", accounting_authority: "IASB" }));
      if (statementBasis && usGaap) candidates.push(candidate("accounting_basis", "US_GAAP", document, range, 100, { declaration: "financial_statement_basis", accounting_authority: "FASB/SEC U.S. GAAP" }));

      const listedContext = /(?:listed|traded|quoted).{0,100}(?:NYSE|New York Stock Exchange|Nasdaq|TSX|Toronto Stock Exchange)|(?:NYSE|New York Stock Exchange|Nasdaq|TSX|Toronto Stock Exchange).{0,100}(?:listed|traded|quoted)/i.test(sentence);
      const directShares = /\b(?:common stock|(?:common|ordinary) shares?)\b/i.test(sentence) && listedContext;
      const ads = /\b(?:American Depositary Shares?|ADSs?)\b/i.test(sentence) && listedContext;
      if (directShares) candidates.push(candidate("security_structure", "direct_share", document, range, 100, { declaration: "listed_security_description" }));
      if (ads) candidates.push(candidate("security_structure", "ads", document, range, 100, { declaration: "listed_security_description" }));
      if (/(?:TSX|Toronto Stock Exchange)/i.test(sentence) && listedContext) candidates.push(candidate("additional_listing_venue", "TSX", document, range, 90, { declaration: "listed_venue" }));
    }
  }
  const accounting = strongest(candidates.filter((item) => item.property === "accounting_basis"));
  const security = strongest(candidates.filter((item) => item.property === "security_structure"));
  const venues = [...new Set(candidates.filter((item) => item.property === "additional_listing_venue").map((item) => item.value))];
  return { accounting, security, additional_listing_venues: venues, candidates };
}

const RULES = Object.freeze([
  { id: "nasdaq_5550_a_2_minimum_bid", pattern: /5550\s*\(a\)\s*\(2\)|minimum bid/i },
  { id: "nasdaq_5550_b_1_stockholders_equity", pattern: /5550\s*\(b\)\s*\(1\)|stockholders['’]? equity/i }
]);

export function projectComplianceStatement(statement, ruleId) {
  const rule = RULES.find((item) => item.id === ruleId);
  if (!rule) return String(statement ?? "").trim();
  const sentences = sentenceRanges(statement);
  const matched = sentences.filter((item) => rule.pattern.test(item.text));
  if (!matched.length) return String(statement ?? "").trim();
  const selected = [];
  for (const match of matched) {
    selected.push(match.text);
    const index = sentences.indexOf(match);
    const next = sentences[index + 1];
    if (next && !RULES.some((other) => other.id !== ruleId && other.pattern.test(next.text)) && /(?:plan|appeal|hearing|review|deadline|extension|closed|compliance)/i.test(next.text)) selected.push(next.text);
  }
  return [...new Set(selected)].join(" ");
}

export const complianceRuleIds = (statement) => RULES.filter((rule) => rule.pattern.test(statement)).map((rule) => rule.id);
