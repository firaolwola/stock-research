const ENTITY_MAP = Object.freeze({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " });
const MATERIAL_CATALYST = /\b(?:acquir(?:e|ed|es|ing|isition)|merger|business combination|entered into (?:a|an|the)|completed (?:a|an|the)|launch(?:ed|es)?|approval|approved|clearance|contract|award(?:ed)?|financial results|restructuring|bankruptcy|chapter 11|appoint(?:ed|ment)|resign(?:ed|ation)|terminated|strategic transaction)\b/i;
const MAX_RAW_CHARACTERS = 12_000_000;
const MAX_INSPECTED_CHARACTERS = 2_000_000;

export function filingHtmlToText(html) {
  return String(html ?? "").slice(0, MAX_RAW_CHARACTERS)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x"; const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : " ";
      }
      return ENTITY_MAP[entity.toLowerCase()] ?? " ";
    })
    .replace(/\s+/g, " ").trim().slice(0, MAX_INSPECTED_CHARACTERS);
}

export function findMaterialExhibitUrl(html, documentUrl) {
  const candidates = [...String(html ?? "").matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const href = candidates.find((value) => /(?:ex(?:hibit)?[-_.]?(?:3[-_.]?1|99(?:[-_.]?1)?)|(?:3|99)[-_.]?1)\.(?:htm|html|txt)$/i.test(value.split(/[?#]/)[0]));
  if (!href) return null;
  try { const url = new URL(href, documentUrl); const officialHost = url.hostname === "sec.gov" || url.hostname.endsWith(".sec.gov"); return url.protocol === "https:" && officialHost ? url.href : null; } catch { return null; }
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((value) => value.trim()).filter((value) => value.length >= 35 && value.length <= 700);
}

function nearbySentence(all, pattern) {
  return all.find((sentence) => pattern.test(sentence)) ?? null;
}

function contextAround(text, pattern, before = 300, after = 900) {
  const match = pattern.exec(text); if (!match) return null;
  return text.slice(Math.max(0, match.index - before), Math.min(text.length, match.index + match[0].length + after)).trim();
}

function contextsAround(text, pattern, before = 300, after = 900, limit = 10) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...text.matchAll(new RegExp(pattern.source, flags))].slice(0, limit);
  return matches.map((match) => text.slice(Math.max(0, match.index - before), Math.min(text.length, match.index + match[0].length + after)).trim());
}

function splitEventContexts(text, limit = 24) {
  const matches = [...text.matchAll(/\breverse (?:stock )?split\b/gi)].slice(0, limit);
  return matches.map((match, index) => {
    // Keep each ratio, lifecycle verb, and date inside the same local mention.
    const previous = matches[index - 1]; const next = matches[index + 1];
    const leftBoundary = previous ? previous.index + previous[0].length : 0;
    // Stop at the next action anchor, but never at an arbitrary midpoint. SEC
    // inline-XBRL tables frequently place the date after the split phrase and
    // the old midpoint could truncate the year ("May 4, 20...").
    let rightBoundary = next ? next.index : text.length;
    const explicitContinuation = next && /(?:^|[.!?]\s+)the\s+$/i.test(text.slice(match.index + match[0].length, next.index))
      && !splitRatio(text.slice(match.index + match[0].length, Math.min(text.length, next.index + 260)))
      && /\b(?:will become effective|became effective|was effective|scheduled to become effective)\b/i.test(text.slice(next.index, Math.min(text.length, next.index + 260)));
    if (explicitContinuation) rightBoundary = Math.min(text.length, next.index + next[0].length + 260);
    // A named prior action is sometimes immediately followed by the clause
    // that introduces the next action. Never let the prior label borrow the
    // next clause's lifecycle verb or date.
    const following = text.slice(match.index + match[0].length, rightBoundary);
    const nextActionClause = /(?:[;.]|,\s+and)\s+(?:effective\s+)?(?:on\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December|\d{4}-\d{2}-\d{2})[^.;]{0,100}\b(?:the company\s+)?(?:effected|effectuated|implemented|completed)\s+(?:a\s+)?$/i.exec(following);
    if (nextActionClause) rightBoundary = match.index + match[0].length + nextActionClause.index;
    const start = Math.max(leftBoundary, match.index - 220); const end = Math.min(rightBoundary, match.index + match[0].length + 260);
    const segment = text.slice(start, end).trim();
    const historicalList = /(?:reverse (?:stock )?splits?|split history|previously effected|historical).{0,900}(?:;|,).{0,900}reverse (?:stock )?split/i.test(text.slice(Math.max(0, match.index - 900), Math.min(text.length, match.index + 900)))
      || (matches.length >= 2 && /(?:;|\.)\s+(?:a |the company )?\d+-for-\d+\s+reverse (?:stock )?split/i.test(text.slice(Math.max(0, match.index - 900), Math.min(text.length, match.index + 900))));
    return { text: segment, anchor: match.index - start, index: match.index, span_id: `split-span-${index + 1}`, segment_id: `split-segment-${index + 1}`, historical_list: historicalList };
  });
}

function authorizationRange(context) {
  return /(?:ratio|range)(?:\s+of)?\s+(?:between|from)?\s*\d[\d,]*\s*[- ]?for[- ]?\s*\d[\d,]*\s+(?:and|to|through|-){1,3}\s*\d[\d,]*\s*[- ]?for[- ]?\s*\d[\d,]*/i.test(context)
    || /(?:between|from)\s+\d[\d,]*\s*[- ]?for[- ]?\s*\d[\d,]*.{0,80}(?:and|to|through)\s+\d[\d,]*\s*[- ]?for[- ]?\s*\d[\d,]*/i.test(context);
}

const ALLOWED_CATALYST_CLASSIFICATIONS = new Set(["earnings", "product", "regulatory", "financing", "contract", "corporate_action", "legal", "management", "macro_industry", "other", "unknown", "not_applicable"]);

export function normalizeCatalystClassification(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (ALLOWED_CATALYST_CLASSIFICATIONS.has(normalized)) return normalized;
  if (["accounting", "restatement", "non_reliance", "auditor"].includes(normalized)) return "legal";
  if (["bankruptcy", "restructuring", "reorganization", "reorganisation"].includes(normalized)) return "corporate_action";
  if (["listing", "delisting", "exchange_compliance"].includes(normalized)) return "regulatory";
  if (["operational", "operations", "product_operational"].includes(normalized)) return "product";
  return "other";
}

function moneyValue(sentence) {
  const match = sentence?.match(/\$\s?([0-9][0-9,.]*)\s*(million|billion)?/i);
  if (!match) return null;
  const multiplier = match[2]?.toLowerCase() === "billion" ? 1_000_000_000 : match[2]?.toLowerCase() === "million" ? 1_000_000 : 1;
  return Number(match[1].replaceAll(",", "")) * multiplier;
}

function splitRatio(sentence, anchor = null) {
  const words = "one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|one hundred";
  const pattern = new RegExp(`(?:ratio of\\s+)?(${words}|[0-9][0-9,]*)\\s*[- ]?for[- ]?\\s*(${words}|[0-9][0-9,]*)`, "gi");
  const matches = [...String(sentence ?? "").matchAll(pattern)];
  const match = anchor === null ? matches[0] : matches.sort((a, b) => Math.abs(a.index - anchor) - Math.abs(b.index - anchor))[0];
  if (!match) return null;
  const wordValues = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, "one hundred": 100 };
  const number = (value) => wordValues[value.toLowerCase()] ?? Number(value.replaceAll(",", ""));
  return { label: `${number(match[1])}-for-${number(match[2])}`, factor: number(match[1]) / number(match[2]) };
}

function splitActionState(sentence) {
  if (/\b(?:cancelled|canceled|withdrawn|abandoned)\b/i.test(sentence)) return "cancelled";
  if (/\b(?:will become effective|is expected to become effective|scheduled to become effective|will be effective)\b/i.test(sentence)) return "scheduled";
  if (/\b(?:became effective|was effective|effected|effectuated|implemented|completed|distributed|split-adjusted trading (?:began|commenced))\b/i.test(sentence)) return "completed";
  if (/\b(?:authorized|authorised|approved|granted.{0,100}authority)\b/i.test(sentence)) return "authorized";
  if (/\b(?:proposed|may effect|if effected|seeking approval)\b/i.test(sentence)) return "proposed";
  return "unknown";
}

function effectiveDate(text, anchor = null) {
  const pattern = /\b(?:effective|effected|effectuated|implemented|completed|became effective)(?:\s+(?:on|as of|at[^,.]{0,80}on))?\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi;
  const textValue = String(text ?? "");
  const generic = [...textValue.matchAll(pattern)].map((match) => ({ match, actionAnchor: match.index }));
  const after = [...textValue.matchAll(/\breverse (?:stock )?split\s+(?:became\s+)?(?:effective\s+)?(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)].map((match) => ({ match, actionAnchor: match.index }));
  const before = [...textValue.matchAll(/\b(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b.{0,100}\b(?:effected|effectuated|implemented|completed)\b.{0,100}\breverse (?:stock )?split\b/gi)].map((match) => ({ match, actionAnchor: match.index + match[0].search(/\breverse (?:stock )?split\b/i) }));
  const preceding = anchor === null ? [] : [...textValue.matchAll(/\b(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)]
    .filter((match) => match.index < anchor && /\b(?:effected|effectuated|implemented|completed)\b/i.test(textValue.slice(match.index + match[0].length, anchor)))
    .map((match) => ({ match, actionAnchor: anchor }));
  const selected = anchor === null ? [...after, ...before, ...generic][0] : [...after, ...before, ...preceding, ...generic].sort((a, b) => Math.abs(a.actionAnchor - anchor) - Math.abs(b.actionAnchor - anchor))[0];
  const match = selected?.match;
  const value = match?.[1]; if (!value) return null; if (/^\d{4}-/.test(value)) return value;
  const parsed = new Date(`${value} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function statedDate(text, verb, anchor = null) {
  const matches = [...String(text ?? "").matchAll(new RegExp(`\\b(?:${verb})(?:\\s+(?:on|as of))?\\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})\\b`, "gi"))];
  const selected = anchor === null ? matches[0] : matches.sort((a, b) => Math.abs(a.index - anchor) - Math.abs(b.index - anchor))[0]; const value = selected?.[1];
  if (!value) return null;
  if (/^\d{4}-/.test(value)) return value;
  const parsed = new Date(`${value} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function localSplitDate(text, anchor) {
  const matches = [...String(text ?? "").matchAll(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)];
  const after = matches.filter((match) => match.index >= anchor && match.index - anchor <= 120).sort((a, b) => a.index - b.index)[0];
  const before = matches.filter((match) => match.index < anchor && anchor - match.index <= 140 && /\b(?:effected|effectuated|implemented|completed)\b/i.test(String(text).slice(match.index + match[0].length, anchor))).sort((a, b) => b.index - a.index)[0];
  const value = (after ?? before)?.[1];
  if (!value) return null;
  if (/^\d{4}-/.test(value)) return value;
  const parsed = new Date(`${value} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function resolvedSplitState(context, filed, evaluatedAt, anchor = null, { historicalList = false } = {}) {
  const stated = splitActionState(context); const date = effectiveDate(context, anchor);
  if (date && new Date(`${date}T23:59:59Z`) > new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) return { state: "scheduled", date };
  if (stated === "scheduled" && date && new Date(`${date}T00:00:00Z`) <= new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) return { state: "completed", date };
  if (stated === "unknown" && historicalList && date && !/\b(?:proposed|authorized|approved|scheduled|may effect|will become effective|if effected)\b/i.test(context)) return { state: "completed", date, lifecycle_source: "authoritative_retrospective_history" };
  return { state: stated, date };
}

function controlWarningContext(text) {
  const negative = /\b(?:we|management|the company|our auditor|the audit committee)?\s*(?:have|has|had)?\s*(?:identified|concluded|determined|reported)?\s*(?:that\s+)?(?:one or more\s+)?material weaknesses?\b|\b(?:internal control(?:s)? over financial reporting|disclosure controls? and procedures?)\b.{0,220}\b(?:was|were|is|are|remain(?:ed)?)\s+(?:not effective|ineffective)|\b(?:not effective|ineffective)\b.{0,220}\b(?:internal control(?:s)? over financial reporting|disclosure controls? and procedures?)\b/i;
  for (const sentence of sentences(text)) {
    if (!negative.test(sentence)) continue;
    // Foreign annual reports commonly describe hypothetical future weakness or
    // the auditor's definition immediately after an affirmative ICFR opinion.
    if (/\b(?:if|may|might|could|would|risk that|in the future|whether)\b/i.test(sentence)) continue;
    if (/\b(?:no material weaknesses?|controls? (?:over financial reporting )?(?:was|were|are) effective|concluded that .{0,120} controls? .{0,80} effective|maintained in all material respects|opinion.{0,120}effective internal control)\b/i.test(sentence)
      && !/\b(?:identified|unremediated|remained?|continues? to have)\s+(?:one or more\s+)?material weaknesses?\b|\b(?:was|were|is|are)\s+(?:not effective|ineffective)\b/i.test(sentence)) continue;
    return sentence;
  }
  return null;
}

function exchangeStatusContext(text) {
  const explicit = /\b(?:Nasdaq|NYSE|the exchange)\s+(?:notified|informed|advised)\s+(?:the company|us)\b.{0,700}\b(?:not in compliance|deficien(?:cy|t)|delist(?:ing|ed)|minimum bid price|compliance period)\b|\b(?:received|receipt of)\s+(?:a\s+)?(?:written\s+)?(?:notice|notification)\b.{0,500}\b(?:Nasdaq|NYSE|exchange)\b.{0,400}\b(?:noncompliance|not in compliance|deficien(?:cy|t)|delist(?:ing|ed)|minimum bid price)\b|\b(?:pending|active)\s+(?:Nasdaq|NYSE|exchange)?\s*(?:delisting|compliance)\s+(?:proceeding|period|matter)\b/i;
  const match = explicit.exec(text); if (!match) return null;
  return text.slice(Math.max(0, match.index - 100), Math.min(text.length, match.index + match[0].length + 500)).trim();
}

export function extractSecFilingEvidenceWithDiagnostics({ html, form, filed, accession, documentUrl, documentName, evaluatedAt }) {
  const text = filingHtmlToText(html); const all = sentences(text); const findings = [];
  const corporateActionDiagnostics = [];
  const add = (kind, category, title, statement, extra = {}) => findings.push({ kind, category, title, statement, event_date: filed, source_filing_date: filed, announced_date: null, effective_date: null, completed_date: null, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "high", evidence_state: "confirmed", ...extra });

  const reverseContexts = splitEventContexts(text);
  const seenReverse = new Set();
  let priorMention = null;
  for (const reverseContext of reverseContexts) {
    const reverse = reverseContext.text; let reverseRatio = splitRatio(reverse, reverseContext.anchor);
    const competingRatio = [...reverse.matchAll(/(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|one hundred)\s*[- ]?for[- ]?\s*(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|one hundred)/gi)].length > 1;
    const diagnosticBase = { source_accession: accession, filing_form: form, local_text_span_id: reverseContext.span_id, segment_id: reverseContext.segment_id, candidate_date_source_segment: null, candidate_lifecycle_source_segment: null, inheritance_attempted: false, inheritance_rejection_reason: null, competing_ratio_detected: competingRatio, source_filing_date: filed, canonical_event_id: null };
    if (!reverseRatio && priorMention?.ratio) {
      diagnosticBase.inheritance_attempted = true;
      diagnosticBase.inheritance_rejection_reason = "ratio_inheritance_requires_explicit_single_event_reference";
    }
    if (!reverseRatio) { corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: null, extracted_status: "unknown", extracted_effective_date: null, disposition: "rejected", reason: "ratio_not_established" }); priorMention = { ...reverseContext, ratio: null }; continue; }
    if (authorizationRange(reverse)) {
      corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: reverseRatio.label, extracted_status: "authorized", extracted_effective_date: null, disposition: "withheld", reason: "authorization_range_is_not_a_completed_action" });
      priorMention = { ...reverseContext, ratio: reverseRatio }; continue;
    }
    const action = resolvedSplitState(reverse, filed, evaluatedAt, reverseContext.anchor, { historicalList: reverseContext.historical_list });
    const localDate = localSplitDate(reverse, reverseContext.anchor);
    if (localDate) action.date = localDate;
    const completed = statedDate(reverse, "effected|implemented|completed", reverseContext.anchor);
    const announced = statedDate(reverse, "announced|approved", reverseContext.anchor);
    const eventDate = action.date ?? completed;
    const signature = `${reverseRatio.label}:${action.state}:${eventDate ?? "undated"}`; if (seenReverse.has(signature)) continue; seenReverse.add(signature);
    const label = { completed: "Completed", scheduled: "Scheduled", authorized: "Authorized", proposed: "Proposed", cancelled: "Cancelled" }[action.state] ?? "Unresolved";
    add("reverse_split", "reverse_splits", `${label} ${reverseRatio.label} reverse split`, reverse, { event_date: eventDate, announced_date: announced, effective_date: action.date, completed_date: completed, ratio: reverseRatio.label, split_factor: reverseRatio.factor, action_state: action.state, local_text_span_id: reverseContext.span_id });
    corporateActionDiagnostics.push({ ...diagnosticBase, candidate_date_source_segment: eventDate ? reverseContext.segment_id : null, candidate_lifecycle_source_segment: action.state !== "unknown" ? reverseContext.segment_id : null, extracted_ratio: reverseRatio.label, extracted_status: action.state, extracted_effective_date: eventDate, disposition: "accepted", reason: action.lifecycle_source ?? "raw_occurrence_accepted_for_canonicalization" });
    priorMention = { ...reverseContext, ratio: reverseRatio };
  }
  const forward = contextAround(text, /\b(?:(?:forward )?stock split|stock dividend)\b/i); const forwardRatio = splitRatio(forward);
  if (forward && forwardRatio && !/\breverse (?:stock )?split\b/i.test(forward)) {
    const action = resolvedSplitState(forward, filed, evaluatedAt); const label = { completed: "Completed", scheduled: "Scheduled", authorized: "Authorized", proposed: "Proposed", cancelled: "Cancelled" }[action.state] ?? "Unresolved";
    const completed = statedDate(forward, "effected|implemented|completed");
    add("stock_split", "financial_context", `${label} ${forwardRatio.label} stock split`, forward, { event_date: action.date ?? completed, effective_date: action.date, completed_date: completed, ratio: forwardRatio.label, split_factor: forwardRatio.factor, action_state: action.state });
  }

  const actualOffering = nearbySentence(all, /\b(?:issued and sold|completed (?:a|the) (?:registered direct |public )?offering|entered into (?:a )?securities purchase agreement|agreed to issue and sell|closing of (?:a|the) offering)\b/i);
  const registration = nearbySentence(all, /\b(?:may offer and sell|from time to time).{0,180}\b(?:securities|shares|common stock)\b/i);
  if (actualOffering) add("offering", "dilution_offerings", "Actual offering or issuance", actualOffering, { transaction_state: "actual_issuance", value: moneyValue(actualOffering), unit: moneyValue(actualOffering) === null ? null : "USD" });
  else if (registration) findings.push({ kind: "offering", category: "dilution_offerings", title: "Registered financing capacity", statement: registration, event_date: filed, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "medium", evidence_state: "limited_coverage", transaction_state: "registered_capacity", value: moneyValue(registration), unit: moneyValue(registration) === null ? null : "USD" });

  const convertible = nearbySentence(all, /\bconvertible (?:note|notes|debenture|debentures|preferred stock|securities)\b/i);
  if (convertible) add("convertible", "warrants_convertibles", "Convertible financing instrument", convertible);
  const warrant = nearbySentence(all, /\b(?:common stock )?warrants?\b.{0,300}\b(?:exercise price|exercisable|shares? of common stock|issued)\b|\b(?:issued|sold).{0,250}\bwarrants?\b/i);
  if (warrant) add("warrant", "warrants_convertibles", "Warrant financing instrument", warrant);

  const goingConcern = nearbySentence(all, /\bsubstantial doubt\b.{0,260}\bcontinue as a going concern\b|\bgoing concern\b.{0,260}\bsubstantial doubt\b/i);
  if (goingConcern) add("going_concern", "going_concern_accounting", "Going-concern warning", goingConcern, { severity: "high" });
  const bankruptcy = nearbySentence(all, /\b(?:filed|commenced|initiated)\b.{0,180}\b(?:voluntary petitions?|proceedings?)\b.{0,180}\b(?:chapter 11|bankruptcy)\b|\bchapter 11 cases?\b.{0,220}\b(?:filed|commenced|debtor)/i);
  if (bankruptcy) add("bankruptcy", "going_concern_accounting", "Bankruptcy or restructuring proceeding", bankruptcy, { severity: "critical" });
  const item402 = contextAround(text, /\bitem\s+4\.02\b/i, 50, 1800);
  const explicitNonReliance = contextAround(text, /\bpreviously issued\b.{0,300}\bfinancial statements?\b.{0,500}\b(?:should no longer be relied upon|restat(?:e|ed|ement)|non[- ]?reliance)\b/i, 100, 500)
    ?? contextAround(text, /\bfinancial statements?\b.{0,500}\b(?:should no longer be relied upon|will be restated|requires? restatement)\b/i, 100, 500);
  const nonReliance = item402 && /\b(?:previously issued|should no longer be relied upon|restat(?:e|ed|ement)|accounting error)\b/i.test(item402) ? item402 : explicitNonReliance;
  if (nonReliance) add("non_reliance", "going_concern_accounting", "Non-reliance or restatement warning", nonReliance, { severity: "critical" });
  const accounting = controlWarningContext(text);
  if (accounting) add("accounting_warning", "going_concern_accounting", "Material weakness or ineffective controls", accounting, { severity: "high" });
  const resolvedCompliance = contextAround(text, /\b(?:Nasdaq|NYSE|the exchange)\s+(?:notified|informed|advised)\s+(?:the company|us)\b.{0,500}\b(?:regained compliance|now complies|compliance (?:has been|was) restored)\b/i, 100, 500);
  const compliance = resolvedCompliance ?? exchangeStatusContext(text);
  if (compliance) {
    const resolutionState = /\b(?:regained compliance|now complies|compliance (?:has been|was) restored|matter (?:is|was) closed|deficiency (?:has been|was) cured)\b/i.test(compliance) ? "resolved" : "active";
    add("exchange_compliance", "compliance", resolutionState === "resolved" ? "Resolved exchange compliance history" : "Active exchange compliance warning", compliance, { severity: resolutionState === "resolved" ? "medium" : "high", resolution_state: resolutionState });
  }

  if (["8-K", "6-K"].includes(form)) {
    const catalyst = nonReliance ?? all.find((sentence) => MATERIAL_CATALYST.test(sentence) && !/forward-looking statements|incorporated by reference/i.test(sentence));
    if (catalyst) {
      const classification = normalizeCatalystClassification(nonReliance ? "accounting" : /bankruptcy|chapter 11|restructur/i.test(catalyst) ? "bankruptcy" : /delist|listing|exchange compliance/i.test(catalyst) ? "listing" : /offering|purchase agreement|issued and sold|convertible|warrant/i.test(catalyst) ? "financing" : /acqui|merger|business combination/i.test(catalyst) ? "corporate_action" : /appoint|resign|management/i.test(catalyst) ? "management" : /approval|clearance/i.test(catalyst) ? "regulatory" : /contract|award/i.test(catalyst) ? "contract" : "other");
      add("catalyst", "catalysts_news", "Material filing event", catalyst, { classification });
    }
  }
  const datedSplitRatios = new Set(findings.filter((item) => item.kind === "reverse_split" && item.ratio && item.event_date).map((item) => item.ratio));
  const retained = findings.filter((item) => !(item.kind === "reverse_split" && !item.event_date && datedSplitRatios.has(item.ratio))).slice(0, 12);
  return { findings: retained, corporate_action_diagnostics: corporateActionDiagnostics };
}

export function extractSecFilingEvidence(input) {
  return extractSecFilingEvidenceWithDiagnostics(input).findings;
}
