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

const MATERIAL_EXHIBIT_PATTERN = /(?:ex(?:hibit)?[-_.]?(?:3[-_.]?1|99[-_.]?[1-9])(?:[-_.]?[a-z][a-z0-9]*)?|(?:3|99)[-_.]?[1-9])\.(?:htm|html|txt)$/i;

export function findMaterialExhibitUrls(html, documentUrl, { limit = 3 } = {}) {
  const candidates = [...String(html ?? "").matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const urls = [];
  for (const href of candidates) {
    if (!MATERIAL_EXHIBIT_PATTERN.test(href.split(/[?#]/)[0])) continue;
    try {
      const url = new URL(href, documentUrl); const officialHost = url.hostname === "sec.gov" || url.hostname.endsWith(".sec.gov");
      if (url.protocol !== "https:" || !officialHost || urls.includes(url.href)) continue;
      urls.push(url.href); if (urls.length >= limit) break;
    } catch { /* ignore malformed or off-site links */ }
  }
  return urls;
}

export function findMaterialExhibitUrl(html, documentUrl) {
  return findMaterialExhibitUrls(html, documentUrl, { limit: 1 })[0] ?? null;
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
    // Certificate-filing clauses in inline-XBRL prose can place the filing
    // date more than 220 characters before the final "reverse stock split"
    // anchor. Keep enough bounded left context to classify that date's role.
    // Inline-XBRL and prospectus tables can place the ratio/effective clause
    // well after the "reverse stock split" anchor. Keep this local and bounded
    // while allowing the complete action clause to be assembled; rightBoundary
    // still prevents borrowing a later action's ratio or lifecycle.
    const rawStart = Math.max(leftBoundary, match.index - 320); const rawEnd = Math.min(rightBoundary, match.index + match[0].length + 900);
    const rawSegment = text.slice(rawStart, rawEnd); const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length; const trailingWhitespace = rawSegment.length - rawSegment.trimEnd().length;
    const start = rawStart + leadingWhitespace; const end = rawEnd - trailingWhitespace; const segment = rawSegment.trim();
    const historicalList = /(?:reverse (?:stock )?splits?|split history|previously effected|historical).{0,900}(?:;|,).{0,900}reverse (?:stock )?split/i.test(text.slice(Math.max(0, match.index - 900), Math.min(text.length, match.index + 900)))
      || (matches.length >= 2 && /(?:;|\.)\s+(?:a |the company )?\d+-for-\d+\s+reverse (?:stock )?split/i.test(text.slice(Math.max(0, match.index - 900), Math.min(text.length, match.index + 900))));
    return { text: segment, anchor: match.index - start, index: match.index, start, end, left_boundary: leftBoundary, right_boundary: rightBoundary, source_length: text.length, span_truncated: rawStart > leftBoundary || rawEnd < rightBoundary, span_id: `split-span-${index + 1}`, segment_id: `split-segment-${index + 1}`, historical_list: historicalList };
  });
}

const DATE_ROLE_EVIDENCE_STRENGTH = Object.freeze({
  explicit_split_adjusted_trading_language: 600,
  explicit_effective_language: 600,
  explicit_completion_language: 600,
  certificate_or_amendment_filing_language_without_same_day_effectiveness: 500,
  explicit_authorization_language: 450,
  explicit_future_effective_language: 400,
  explicit_announcement_language: 400,
  resolved_scheduled_lifecycle: 300,
  resolved_completion_lifecycle: 250,
  resolved_authorization_lifecycle: 250,
  authoritative_retrospective_history: 100,
  date_role_not_explicit: 0,
  no_action_date_extracted: 0,
  date_not_yet_classified: 0
});

function dateRoleEvidenceStrength(evidence) {
  return DATE_ROLE_EVIDENCE_STRENGTH[evidence] ?? 0;
}

function rangesOverlap(left, right) {
  return left.source_text_range_start <= right.source_text_range_end && right.source_text_range_start <= left.source_text_range_end;
}

/**
 * Resolve competing interpretations of one source reference before canonical
 * acceptance. The diagnostics stay internal; findings from losing or unresolved
 * interpretations are removed so they cannot become report evidence.
 */
export function resolveOverlappingSplitDateRoleConflicts(findings, diagnostics) {
  const candidates = diagnostics.filter((item) => item.extracted_ratio && item.extracted_date && Number.isInteger(item.source_date_position));
  const groups = [];
  for (const candidate of candidates) {
    const group = groups.find((entries) => entries.some((item) => item.source_accession === candidate.source_accession
      && item.source_document === candidate.source_document
      && item.extracted_ratio === candidate.extracted_ratio
      && item.extracted_date === candidate.extracted_date
      && item.source_date_position === candidate.source_date_position
      && rangesOverlap(item, candidate)));
    if (group) group.push(candidate); else groups.push([candidate]);
  }
  const removeOccurrenceIds = new Set();
  for (const group of groups.filter((entries) => entries.length > 1 && new Set(entries.map((item) => item.date_role)).size > 1)) {
    const strongest = Math.max(...group.map((item) => item.date_role_evidence_strength));
    const winners = group.filter((item) => item.date_role_evidence_strength === strongest);
    const winningRoles = new Set(winners.map((item) => item.date_role));
    const resolved = winningRoles.size === 1;
    const winningRole = resolved ? winners[0].date_role : null;
    const allIds = group.map((item) => item.occurrence_id);
    for (const item of group) {
      item.competing_overlapping_occurrence_ids = allIds.filter((id) => id !== item.occurrence_id);
      item.winning_date_role = winningRole;
      item.losing_interpretation = resolved && item.date_role !== winningRole ? item.date_role : null;
      item.overlap_conflict_resolution_reason = resolved
        ? "more_specific_date_role_evidence_prevailed"
        : "equal_strength_overlapping_date_role_conflict_withheld";
      item.retrospective_fallback_suppressed = item.date_role_evidence === "authoritative_retrospective_history" && (!resolved || item.date_role !== winningRole);
      if (!resolved || item.date_role !== winningRole) {
        item.canonical_acceptance_invariant_passed = false;
        item.canonical_validation_reason = resolved ? "stronger_overlapping_date_role_evidence" : "unresolved_overlapping_date_role_conflict";
        item.disposition = "withheld";
        item.reason = item.canonical_validation_reason;
        item.canonical_event_id = null;
        item.canonical_chosen_event_date = null;
        item.merge_target = null;
        removeOccurrenceIds.add(item.occurrence_id);
      }
    }
  }
  if (removeOccurrenceIds.size) {
    for (let index = findings.length - 1; index >= 0; index -= 1) {
      if (removeOccurrenceIds.has(findings[index].occurrence_id)) findings.splice(index, 1);
    }
  }
  return { findings, diagnostics };
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

const SMALL_NUMBER_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 });
const NUMBER_WORD_ATOM = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const NUMBER_WORD = `(?:(?:${NUMBER_WORD_ATOM})(?:\\s+|-)hundred(?:(?:\\s+|-)(?:${NUMBER_WORD_ATOM}))?|one(?:\\s+|-)thousand|${NUMBER_WORD_ATOM})`;
// Punctuation is a valid sentence boundary (for example, "one-for-ten,
// effective ..."). Only alphanumeric/hyphen continuation is disallowed so
// a truncated prefix such as 1-for-2 from 1-for-250 can never be accepted.
const RATIO_PATTERN = new RegExp(`(?:ratio of\\s+)?([0-9][0-9,]*|${NUMBER_WORD})\\s*[- ]?for[- ]?\\s*([0-9][0-9,]*|${NUMBER_WORD})(?![a-z0-9-])`, "gi");

function numberToken(value) {
  if (/^\d/.test(value)) return Number(value.replaceAll(",", ""));
  const tokens = value.toLowerCase().trim().split(/[\s-]+/); let total = 0; let current = 0;
  for (const token of tokens) {
    if (token === "hundred") current = Math.max(current, 1) * 100;
    else if (token === "thousand") { total += Math.max(current, 1) * 1000; current = 0; }
    else current += SMALL_NUMBER_WORDS[token] ?? 0;
  }
  return total + current;
}

function ratioMatches(sentence) {
  return [...String(sentence ?? "").matchAll(new RegExp(RATIO_PATTERN.source, RATIO_PATTERN.flags))].map((match) => ({
    match,
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    numerator_text: match[1],
    denominator_text: match[2]
  }));
}

function splitRatio(sentence, anchor = null) {
  const matches = ratioMatches(sentence);
  const selected = anchor === null ? matches[0] : matches.sort((a, b) => Math.abs(a.start - anchor) - Math.abs(b.start - anchor))[0];
  if (!selected) return null;
  const numerator = numberToken(selected.numerator_text); const denominator = numberToken(selected.denominator_text);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) return null;
  return { label: `${numerator}-for-${denominator}`, factor: numerator / denominator, ...selected };
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
  const effectiveDateOf = [...textValue.matchAll(new RegExp(`\\b(?:effective date|date of effectiveness)\\s*(?:(?:of|for|was|is|being)\\s*)?(?::\\s*)?(${DATE_TOKEN_SOURCE})\\b`, "gi"))].map((match) => ({ match, actionAnchor: match.index }));
  const after = [...textValue.matchAll(/\breverse (?:stock )?split\s+(?:became\s+)?(?:effective\s+)?(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)].map((match) => ({ match, actionAnchor: match.index }));
  const before = [...textValue.matchAll(/\b(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b.{0,100}\b(?:effected|effectuated|implemented|completed)\b.{0,100}\breverse (?:stock )?split\b/gi)].map((match) => ({ match, actionAnchor: match.index + match[0].search(/\breverse (?:stock )?split\b/i) }));
  const preceding = anchor === null ? [] : [...textValue.matchAll(/\b(?:on|as of)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)]
    .filter((match) => match.index < anchor && /\b(?:effected|effectuated|implemented|completed)\b/i.test(textValue.slice(match.index + match[0].length, anchor)))
    .map((match) => ({ match, actionAnchor: anchor }));
  const trading = [...textValue.matchAll(/\b(?:split-adjusted\s+)?trading\s+(?:began|commenced|starts?)(?:\s+(?:on|as of))?\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)].map((match) => ({ match, actionAnchor: match.index }));
  const selected = anchor === null ? [...after, ...before, ...trading, ...effectiveDateOf, ...generic][0] : [...after, ...before, ...preceding, ...trading, ...effectiveDateOf, ...generic].sort((a, b) => Math.abs(a.actionAnchor - anchor) - Math.abs(b.actionAnchor - anchor))[0];
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

function localSplitDate(text, anchor, ratioPosition = anchor) {
  const matches = [...String(text ?? "").matchAll(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)];
  const before = matches.filter((match) => {
    if (match.index >= ratioPosition || ratioPosition - match.index > 140) return false;
    // Ratios are sometimes inserted between the date and lifecycle phrase
    // ("On DATE, the one-for-ten reverse split became effective"). Include a
    // short bounded suffix after the ratio while avoiding a separate action.
    const bindingClause = String(text).slice(match.index + match[0].length, Math.min(String(text).length, ratioPosition + 160));
    const lifecycle = /\b(?:effected|effectuated|implemented|completed|became effective|was effective)\b/i.exec(bindingClause);
    return Boolean(lifecycle) && !/\band\b/i.test(bindingClause.slice(0, lifecycle.index)) && !/[.;]/.test(bindingClause.slice(0, lifecycle.index));
  }).sort((a, b) => b.index - a.index)[0];
  const after = matches.filter((match) => match.index >= anchor && match.index - anchor <= 120).sort((a, b) => a.index - b.index)[0];
  // A date followed by the lifecycle verb and then this action anchor is an
  // explicit binding. Prefer it over a later date that may introduce the next
  // action in the same disclosure.
  const selected = before ?? after;
  const value = selected?.[1];
  if (!value) return null;
  if (/^\d{4}-/.test(value)) return value;
  const parsed = new Date(`${value} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function datePosition(text, normalizedDate) {
  if (!normalizedDate) return null;
  const matches = [...String(text ?? "").matchAll(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi)];
  return matches.find((match) => {
    if (/^\d{4}-/.test(match[1])) return match[1] === normalizedDate;
    const parsed = new Date(`${match[1]} 23:59:59 UTC`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalizedDate;
  })?.index ?? null;
}

const DATE_TOKEN_SOURCE = "(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}";

function normalizeDateToken(value) {
  if (!value) return null;
  if (/^\d{4}-/.test(value)) return value;
  const parsed = new Date(`${value} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function certificateFilingDate(text) {
  const value = String(text ?? "");
  const patterns = [
    new RegExp(`\\b(?:on\\s+)?(${DATE_TOKEN_SOURCE})\\b.{0,220}\\b(?:filed|submitted|delivered)\\b.{0,180}\\b(?:certificate|amendment)\\b`, "i"),
    new RegExp(`\\b(?:filed|submitted|delivered)\\b.{0,180}\\b(?:certificate|amendment)\\b.{0,120}\\b(?:on\\s+)?(${DATE_TOKEN_SOURCE})\\b`, "i")
  ];
  return normalizeDateToken(patterns.map((pattern) => pattern.exec(value)?.[1]).find(Boolean));
}

function splitDateRole(text, selectedDate, actionState, statedLifecycle, historicalList) {
  if (!selectedDate) return { role: "unknown_date_role", evidence: "no_action_date_extracted" };
  const value = String(text ?? "");
  const filingPatterns = [
    new RegExp(`\\b(?:on\\s+)?(${DATE_TOKEN_SOURCE})\\b.{0,220}\\b(?:filed|submitted|delivered)\\b.{0,180}\\b(?:certificate|amendment)\\b`, "gi"),
    new RegExp(`\\b(?:filed|submitted|delivered)\\b.{0,180}\\b(?:certificate|amendment)\\b.{0,120}\\b(?:on\\s+)?(${DATE_TOKEN_SOURCE})\\b`, "gi")
  ];
  const rolePatterns = {
    trading_effective_date: [
      new RegExp(`\\b(?:trading|split-adjusted trading)\\b.{0,120}\\b(?:began|commenced|starts?|effective)\\b.{0,80}\\b(?:on|as of)?\\s*(${DATE_TOKEN_SOURCE})\\b`, "gi"),
      new RegExp(`\\b(?:on|as of)\\s+(${DATE_TOKEN_SOURCE})\\b.{0,120}\\b(?:trading|split-adjusted trading)\\b.{0,80}\\b(?:began|commenced|starts?)\\b`, "gi")
    ],
    completion_date: [
      new RegExp(`\\b(?:completed)(?:\\s+(?:on|as of))?\\s+(${DATE_TOKEN_SOURCE})\\b`, "gi"),
      new RegExp(`\\b(?:on|as of)\\s+(${DATE_TOKEN_SOURCE})\\b.{0,140}\\bcompleted\\b`, "gi")
    ],
    effective_date: [
      new RegExp(`\\b(?:effective|became effective|was effective|effected|effectuated|implemented)(?:\\s+(?:on|as of))?\\s+(${DATE_TOKEN_SOURCE})\\b`, "gi"),
      new RegExp(`\\b(?:on|as of)\\s+(${DATE_TOKEN_SOURCE})\\b.{0,140}\\b(?:effected|effectuated|implemented|became effective|was effective)\\b`, "gi"),
      new RegExp(`\\b(?:effective date|date of effectiveness)\\s*(?:(?:of|for|was|is|being)\\s*)?(?::\\s*)?(${DATE_TOKEN_SOURCE})\\b`, "gi")
    ],
    authorization_date: [
      new RegExp(`\\b(?:authorized|authorised|approved)(?:\\s+(?:on|as of))?\\s+(${DATE_TOKEN_SOURCE})\\b`, "gi"),
      new RegExp(`\\b(?:on|as of)\\s+(${DATE_TOKEN_SOURCE})\\b.{0,140}\\b(?:authorized|authorised|approved)\\b`, "gi")
    ],
    announcement_date: [
      new RegExp(`\\bannounced(?:\\s+(?:on|as of))?\\s+(${DATE_TOKEN_SOURCE})\\b`, "gi"),
      new RegExp(`\\b(?:on|as of)\\s+(${DATE_TOKEN_SOURCE})\\b.{0,140}\\bannounced\\b`, "gi")
    ]
  };
  const containsDate = (patterns) => patterns.some((pattern) => [...value.matchAll(pattern)].some((match) => normalizeDateToken(match[1]) === selectedDate));
  if (containsDate(rolePatterns.trading_effective_date)) return { role: "trading_effective_date", evidence: "explicit_split_adjusted_trading_language" };
  if (statedLifecycle === "scheduled" && containsDate(rolePatterns.effective_date)) return { role: "scheduled_effective_date", evidence: "explicit_future_effective_language" };
  if (containsDate(rolePatterns.effective_date)) return { role: "effective_date", evidence: "explicit_effective_language" };
  if (containsDate(rolePatterns.completion_date)) return { role: "completion_date", evidence: "explicit_completion_language" };
  if (containsDate(filingPatterns)) return { role: "filing_date", evidence: "certificate_or_amendment_filing_language_without_same_day_effectiveness" };
  if (containsDate(rolePatterns.authorization_date)) return { role: "authorization_date", evidence: "explicit_authorization_language" };
  if (containsDate(rolePatterns.announcement_date)) return { role: "announcement_date", evidence: "explicit_announcement_language" };
  if (actionState === "scheduled") return { role: "scheduled_effective_date", evidence: "resolved_scheduled_lifecycle" };
  if (actionState === "completed" && historicalList) return { role: "completion_date", evidence: "authoritative_retrospective_history" };
  if (actionState === "completed") return { role: "completion_date", evidence: "resolved_completion_lifecycle" };
  if (actionState === "authorized") return { role: "authorization_date", evidence: "resolved_authorization_lifecycle" };
  return { role: "unknown_date_role", evidence: "date_role_not_explicit" };
}

function lifecyclePosition(text, state) {
  const patterns = {
    completed: /\b(?:became effective|was effective|effected|effectuated|implemented|completed|distributed|effective date(?: of| for)?)\b/i,
    scheduled: /\b(?:will become effective|is expected to become effective|scheduled to become effective|will be effective)\b/i,
    authorized: /\b(?:authorized|authorised|approved|granted)\b/i,
    proposed: /\b(?:proposed|may effect|seeking approval)\b/i,
    cancelled: /\b(?:cancelled|canceled|withdrawn|abandoned)\b/i
  };
  return patterns[state]?.exec(String(text ?? ""))?.index ?? null;
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

export function extractSecFilingEvidenceWithDiagnostics({ html, form, filed, reportDate = null, accession, documentUrl, documentName, evaluatedAt }) {
  const text = filingHtmlToText(html); const all = sentences(text); const findings = [];
  const corporateActionDiagnostics = [];
  const ntFilingDiagnostics = [];
  const add = (kind, category, title, statement, extra = {}) => findings.push({ kind, category, title, statement, event_date: filed, source_filing_date: filed, announced_date: null, effective_date: null, completed_date: null, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "high", evidence_state: "confirmed", ...extra });

  const reverseContexts = splitEventContexts(text);
  const seenReverse = new Set();
  let priorMention = null;
  for (const reverseContext of reverseContexts) {
    const reverse = reverseContext.text; let reverseRatio = splitRatio(reverse, reverseContext.anchor);
    const ratios = ratioMatches(reverse);
    const competingRatios = reverseRatio ? ratios.filter((item) => numberToken(item.numerator_text) !== numberToken(reverseRatio.numerator_text) || numberToken(item.denominator_text) !== numberToken(reverseRatio.denominator_text)) : ratios;
    const competingRatio = competingRatios.length > 0;
    const ratioTouchedTruncationBoundary = Boolean(reverseRatio && reverseContext.span_truncated && (reverseRatio.start === 0 || reverseRatio.end === reverse.length));
    const occurrenceId = `${accession}:${documentName}:reverse-split:${reverseContext.segment_id}`;
    const diagnosticBase = { source_accession: accession, source_document: documentName, filing_form: form, occurrence_id: occurrenceId, source_reference_id: null, local_text_span_id: reverseContext.span_id, segment_id: reverseContext.segment_id, source_text_range_start: reverseContext.start, source_text_range_end: reverseContext.end, source_ratio_position: reverseRatio ? reverseContext.start + reverseRatio.start : null, source_date_position: null, candidate_date_source_segment: null, candidate_lifecycle_source_segment: null, inheritance_attempted: false, inheritance_rejection_reason: null, competing_ratio_detected: competingRatio, competing_ratio_positions: competingRatios.map((item) => item.start), source_span_truncated: reverseContext.span_truncated, ratio_token_touched_truncation_boundary: ratioTouchedTruncationBoundary, complete_ratio_token_text: reverseRatio?.text ?? null, ratio_position: reverseRatio?.start ?? null, date_position: null, extracted_date: null, date_role: "unknown_date_role", date_role_evidence: "date_not_yet_classified", date_role_evidence_strength: 0, competing_overlapping_occurrence_ids: [], winning_date_role: null, losing_interpretation: null, overlap_conflict_resolution_reason: null, retrospective_fallback_suppressed: false, canonical_chosen_event_date: null, merge_target: null, merge_reason: null, filing_vs_effective_reconciliation: "not_attempted", canonical_acceptance_invariant_passed: false, canonical_validation_reason: null, issuer_identity_match: true, source_filing_date: filed, canonical_event_id: null };
    if (!reverseRatio && priorMention?.ratio) {
      diagnosticBase.inheritance_attempted = true;
      diagnosticBase.inheritance_rejection_reason = "ratio_inheritance_requires_explicit_single_event_reference";
    }
    if (!reverseRatio) { corporateActionDiagnostics.push({ ...diagnosticBase, canonical_validation_reason: "complete_ratio_token_required", extracted_ratio: null, extracted_status: "unknown", extracted_effective_date: null, disposition: "rejected", reason: "ratio_not_established" }); priorMention = { ...reverseContext, ratio: null }; continue; }
    if (ratioTouchedTruncationBoundary) { corporateActionDiagnostics.push({ ...diagnosticBase, canonical_validation_reason: "ratio_token_touched_truncated_span_boundary", extracted_ratio: reverseRatio.label, extracted_status: "unknown", extracted_effective_date: null, disposition: "withheld", reason: "truncated_required_ratio_token" }); priorMention = { ...reverseContext, ratio: null }; continue; }
    if (authorizationRange(reverse)) {
      corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: reverseRatio.label, extracted_status: "authorized", extracted_effective_date: null, disposition: "withheld", reason: "authorization_range_is_not_a_completed_action" });
      priorMention = { ...reverseContext, ratio: reverseRatio }; continue;
    }
    const action = resolvedSplitState(reverse, filed, evaluatedAt, reverseContext.anchor, { historicalList: reverseContext.historical_list });
    const localDate = localSplitDate(reverse, reverseContext.anchor, reverseRatio.start);
    if (localDate) action.date = localDate;
    const completed = statedDate(reverse, "effected|implemented|completed", reverseContext.anchor);
    const announced = statedDate(reverse, "announced|approved", reverseContext.anchor);
    const statedLifecycle = splitActionState(reverse);
    const eventDate = action.date ?? completed ?? announced ?? certificateFilingDate(reverse);
    const explicitEffectiveDate = effectiveDate(reverse, reverseRatio.start);
    let classifiedDate = splitDateRole(reverse, eventDate, action.state, statedLifecycle, reverseContext.historical_list);
    // A bounded filing can state an "effective date of" the action without a
    // lifecycle verb next to the ratio. Once that explicit effective date is
    // in the past, it is safe to settle the action as completed; future dates
    // remain scheduled/unknown and cannot become completed by this fallback.
    if (action.state === "unknown" && eventDate && explicitEffectiveDate === eventDate
      && classifiedDate.role === "unknown_date_role"
      && new Date(`${eventDate}T23:59:59Z`) <= new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) {
      classifiedDate = { role: "effective_date", evidence: "explicit_effective_language" };
      action.state = "completed";
      action.lifecycle_source = "explicit_effective_date_fallback";
    } else if (action.state === "unknown" && classifiedDate.role === "effective_date" && eventDate
      && new Date(`${eventDate}T23:59:59Z`) <= new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) {
      action.state = "completed";
      action.lifecycle_source = "explicit_effective_date_fallback";
    }
    const selectedDatePosition = datePosition(reverse, eventDate); const selectedLifecyclePosition = action.lifecycle_source === "authoritative_retrospective_history" || action.lifecycle_source === "explicit_effective_date_fallback" ? (selectedDatePosition ?? reverseContext.anchor) : lifecyclePosition(reverse, statedLifecycle === "scheduled" && action.state === "completed" ? "scheduled" : action.state);
    const bindingStart = Math.min(reverseRatio.start, selectedDatePosition ?? reverseRatio.start, selectedLifecyclePosition ?? reverseRatio.start);
    const bindingEnd = Math.max(reverseRatio.end, selectedDatePosition ?? reverseRatio.end, selectedLifecyclePosition ?? reverseRatio.end);
    const interveningCompetingRatio = competingRatios.some((item) => item.start > bindingStart && item.start < bindingEnd);
    const completedInvariant = action.state !== "completed" || (Boolean(eventDate) && !["filing_date", "unknown_date_role"].includes(classifiedDate.role) && selectedDatePosition !== null && selectedLifecyclePosition !== null && !interveningCompetingRatio);
    const acceptanceInvariant = !ratioTouchedTruncationBoundary && action.state !== "unknown" && completedInvariant;
    diagnosticBase.date_position = selectedDatePosition;
    diagnosticBase.source_date_position = selectedDatePosition === null ? null : reverseContext.start + selectedDatePosition;
    diagnosticBase.extracted_date = eventDate;
    diagnosticBase.date_role = classifiedDate.role;
    diagnosticBase.date_role_evidence = classifiedDate.evidence;
    diagnosticBase.date_role_evidence_strength = dateRoleEvidenceStrength(classifiedDate.evidence);
    diagnosticBase.source_reference_id = eventDate && diagnosticBase.source_date_position !== null ? `${accession}:${documentName}:reverse-split:${reverseRatio.label}:${eventDate}:${diagnosticBase.source_date_position}` : null;
    diagnosticBase.candidate_date_source_segment = eventDate ? reverseContext.segment_id : null;
    diagnosticBase.candidate_lifecycle_source_segment = action.state !== "unknown" ? reverseContext.segment_id : null;
    diagnosticBase.canonical_acceptance_invariant_passed = acceptanceInvariant;
    diagnosticBase.canonical_validation_reason = acceptanceInvariant ? (action.state === "completed" ? "ratio_date_lifecycle_bound_within_action_segment" : "resolved_noncompleted_action_retained") : classifiedDate.role === "filing_date" ? "filing_date_cannot_establish_completed_event" : interveningCompetingRatio ? "competing_ratio_between_ratio_and_date_or_lifecycle" : action.state === "completed" && !eventDate ? "safe_action_date_required" : action.state === "unknown" ? "resolved_lifecycle_required" : "completed_action_binding_not_proven";
    if (classifiedDate.role === "filing_date") {
      add("reverse_split", "reverse_splits", `Unresolved ${reverseRatio.label} reverse split filing`, reverse, { event_date: null, announced_date: announced, effective_date: null, completed_date: null, filing_reference_date: eventDate, date_role: classifiedDate.role, date_role_evidence: classifiedDate.evidence, ratio: reverseRatio.label, split_factor: reverseRatio.factor, action_state: "unknown", canonical_support_only: true, local_text_span_id: reverseContext.span_id, occurrence_id: occurrenceId, source_reference_id: diagnosticBase.source_reference_id });
      corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: reverseRatio.label, extracted_status: action.state, extracted_effective_date: null, disposition: "withheld", reason: diagnosticBase.canonical_validation_reason });
      priorMention = { ...reverseContext, ratio: reverseRatio }; continue;
    }
    if (!acceptanceInvariant) {
      corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: reverseRatio.label, extracted_status: action.state, extracted_effective_date: eventDate, disposition: "withheld", reason: diagnosticBase.canonical_validation_reason });
      priorMention = { ...reverseContext, ratio: reverseRatio }; continue;
    }
    const signature = `${reverseRatio.label}:${action.state}:${eventDate ?? "undated"}:${classifiedDate.role}:${diagnosticBase.source_reference_id ?? occurrenceId}`; if (seenReverse.has(signature)) continue; seenReverse.add(signature);
    const label = { completed: "Completed", scheduled: "Scheduled", authorized: "Authorized", proposed: "Proposed", cancelled: "Cancelled" }[action.state] ?? "Unresolved";
    add("reverse_split", "reverse_splits", `${label} ${reverseRatio.label} reverse split`, reverse, { event_date: eventDate, announced_date: announced, effective_date: action.date, completed_date: completed, date_role: classifiedDate.role, date_role_evidence: classifiedDate.evidence, ratio: reverseRatio.label, split_factor: reverseRatio.factor, action_state: action.state, canonical_support_only: false, local_text_span_id: reverseContext.span_id, occurrence_id: occurrenceId, source_reference_id: diagnosticBase.source_reference_id });
    corporateActionDiagnostics.push({ ...diagnosticBase, extracted_ratio: reverseRatio.label, extracted_status: action.state, extracted_effective_date: eventDate, disposition: "accepted", reason: action.lifecycle_source ?? "raw_occurrence_accepted_for_canonicalization" });
    priorMention = { ...reverseContext, ratio: reverseRatio };
  }
  resolveOverlappingSplitDateRoleConflicts(findings, corporateActionDiagnostics);
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
  if (/^NT (?:10-K|20-F|40-F|10-Q)$/.test(form)) {
    const reasonMatch = /\b(?:unable to|could not|cannot|will not)\s+(?:timely\s+)?(?:be\s+)?file(?:d)?\b.{0,500}?\b(?:because|due to|as a result of)\s+([^.!?]{10,500})/i.exec(text);
    const periodKind = form === "NT 10-Q" ? "quarterly" : "annual";
    const reasonText = reasonMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    const lateStatement = reasonText ? `The issuer states that the ${form} filing was delayed because ${reasonText}.` : `The issuer filed ${form} for the ${periodKind} period ended ${reportDate ?? "an unresolved period"}; the issuer-stated reason was unavailable in the bounded filing text.`;
    const reasonExtracted = Boolean(reasonText);
    add("late_annual_filing", "going_concern_accounting", form === "NT 10-Q" ? "Delayed quarterly filing" : "Delayed annual filing", lateStatement, { severity: "high", expected_period: reportDate, delay_reason_extracted: reasonExtracted });
    const reasonStart = reasonMatch ? reasonMatch.index + reasonMatch[0].indexOf(reasonMatch[1]) : null;
    ntFilingDiagnostics.push({ accession, form, report_period: reportDate, filing_date: filed, reason_extracted: reasonExtracted, reason_source: reasonExtracted ? "issuer_nt_filing_text" : "unavailable", reason_range_start: reasonStart, reason_range_end: reasonStart === null ? null : reasonStart + reasonMatch[1].length });
  }
  const item402 = contextAround(text, /\bitem\s+4\.02\b/i, 50, 1800);
  const directNonReliance = contextAround(text, /\bpreviously issued\b.{0,300}\bfinancial statements?\b.{0,500}\bshould no longer be relied upon\b/i, 100, 500);
  const determination = contextAround(text, /\b(?:board|audit committee|management|company|independent (?:registered public )?accounting firm|auditor)\b.{0,260}\b(?:concluded|determined|advised)\b.{0,500}\b(?:financial statements? should no longer be relied upon|will be restated|requires? restatement)\b/i, 100, 500);
  // Item 4.02 filings do not all use the exact phrase "should no longer be
  // relied upon". Some authoritative notices (including NCPL's live-shaped
  // filing) say that action is required to "prevent future reliance" on the
  // affected statements. Keep this narrowly scoped to the Item 4.02 section
  // and require an explicit accounting determination or affected statements,
  // so prospectus boilerplate and hypothetical risk language remain negative
  // controls.
  const item402NonReliance = form === "8-K" && item402 && /\b(?:previously issued financial statements?.{0,300}(?:should no longer be relied upon|restat(?:e|ed|ement)|non[- ]?reliance)|(?:prevent future reliance|action should be taken to prevent future reliance).{0,350}(?:affected )?previously issued financial statements?|(?:audit committee|auditor|accounting firm|management|company).{0,260}\b(?:concluded|determined|advised)\b.{0,500}\b(?:non[- ]?reliance|restat(?:e|ed|ement)|prevent future reliance)\b|accounting error)\b/i.test(item402) ? item402 : null;
  const nonReliance = item402NonReliance ?? directNonReliance ?? determination;
  if (nonReliance) add("non_reliance", "going_concern_accounting", "Non-reliance or restatement warning", nonReliance, { severity: "critical", trigger_basis: item402NonReliance ? "item_4_02" : directNonReliance ? "explicit_non_reliance" : "issuer_or_auditor_determination" });
  const accounting = controlWarningContext(text);
  if (accounting) add("accounting_warning", "going_concern_accounting", "Material weakness or ineffective controls", accounting, { severity: "high" });
  const workingCapital = nearbySentence(all, /\bworking capital deficit\b.{0,220}(?:\$\s?[0-9][0-9,.]*\s*(?:million|billion)?|[0-9][0-9,.]*\s*(?:million|billion)?)/i)
    ?? nearbySentence(all, /(?:\$\s?[0-9][0-9,.]*\s*(?:million|billion)?|[0-9][0-9,.]*\s*(?:million|billion)?)\b.{0,180}\bworking capital deficit\b/i);
  if (workingCapital) add("working_capital_deficit", "going_concern_accounting", "Working-capital deficit", workingCapital, { severity: "high", value: moneyValue(workingCapital), unit: "USD" });
  const maturityCandidate = nearbySentence(all, /\b(?:notes?|debt|borrowings?)\b.{0,280}\b(?:due|matur(?:e|es|ing|ity))\b.{0,100}(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/i)
    ?? nearbySentence(all, /\b(?:due|matur(?:e|es|ing|ity))\b.{0,100}(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}).{0,280}\b(?:notes?|debt|borrowings?)\b/i);
  const maturityToken = maturityCandidate?.match(new RegExp(`\\b(${DATE_TOKEN_SOURCE})\\b`, "i"))?.[1];
  const maturityDate = normalizeDateToken(maturityToken); const maturityReference = new Date(evaluatedAt ?? `${filed}T23:59:59Z`);
  const maturityHorizon = new Date(maturityReference); maturityHorizon.setUTCMonth(maturityHorizon.getUTCMonth() + 18);
  const nearTermMaturity = maturityDate && new Date(`${maturityDate}T23:59:59Z`) <= maturityHorizon ? maturityCandidate : null;
  if (nearTermMaturity) add("debt_maturity", "going_concern_accounting", "Near-term debt or note maturity", nearTermMaturity, { severity: "high", value: moneyValue(nearTermMaturity), unit: "USD", maturity_date: maturityDate });
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
  const primaryFindings = findings.filter((item) => item.canonical_support_only !== true && !(item.kind === "reverse_split" && !item.event_date && datedSplitRatios.has(item.ratio))).slice(0, 12);
  // Filing-only provenance must reach cross-document canonicalization without
  // displacing the bounded primary evidence set. Retain only references that
  // could corroborate a selected dated split, with a separate small cap.
  const filingSupport = findings.filter((item) => item.canonical_support_only === true).slice(0, 4);
  return { findings: [...primaryFindings, ...filingSupport], corporate_action_diagnostics: corporateActionDiagnostics, nt_filing_diagnostics: ntFilingDiagnostics };
}

export function extractSecFilingEvidence(input) {
  return extractSecFilingEvidenceWithDiagnostics(input).findings;
}
