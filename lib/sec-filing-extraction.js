const ENTITY_MAP = Object.freeze({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " });
const MATERIAL_CATALYST = /\b(?:acquir(?:e|ed|es|ing|isition)|merger|business combination|entered into (?:a|an|the)|completed (?:a|an|the)|launch(?:ed|es)?|approval|approved|clearance|contract|award(?:ed)?|financial results|restructuring|bankruptcy|chapter 11|appoint(?:ed|ment)|resign(?:ed|ation)|terminated|strategic transaction)\b/i;
const MAX_INSPECTED_CHARACTERS = 2_000_000;

export function filingHtmlToText(html) {
  return String(html ?? "").slice(0, MAX_INSPECTED_CHARACTERS)
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
    .replace(/\s+/g, " ").trim();
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

function splitRatio(sentence) {
  const words = "one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|one hundred";
  const match = sentence?.match(new RegExp(`(?:ratio of\\s+)?(${words}|[0-9][0-9,]*)\\s*[- ]?for[- ]?\\s*(${words}|[0-9][0-9,]*)`, "i"));
  if (!match) return null;
  const wordValues = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, "one hundred": 100 };
  const number = (value) => wordValues[value.toLowerCase()] ?? Number(value.replaceAll(",", ""));
  return { label: `${number(match[1])}-for-${number(match[2])}`, factor: number(match[1]) / number(match[2]) };
}

function splitActionState(sentence) {
  if (/\b(?:cancelled|canceled|withdrawn|abandoned)\b/i.test(sentence)) return "cancelled";
  if (/\b(?:will become effective|is expected to become effective|scheduled to become effective|will be effective)\b/i.test(sentence)) return "scheduled";
  if (/\b(?:became effective|was effective|effected|implemented|completed|distributed|split-adjusted trading (?:began|commenced))\b/i.test(sentence)) return "completed";
  if (/\b(?:authorized|authorised|approved|granted.{0,100}authority)\b/i.test(sentence)) return "authorized";
  if (/\b(?:proposed|may effect|if effected|seeking approval)\b/i.test(sentence)) return "proposed";
  return "unknown";
}

function effectiveDate(text) {
  const iso = text.match(/\beffective(?:\s+(?:on|as of))?\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1];
  if (iso) return iso;
  const named = text.match(/\beffective(?:\s+(?:on|as of|at[^,.]{0,80}on))?\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b/i)?.[1];
  if (!named) return null;
  const parsed = new Date(`${named} 23:59:59 UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function resolvedSplitState(context, filed, evaluatedAt) {
  const stated = splitActionState(context); const date = effectiveDate(context);
  if (date && new Date(`${date}T23:59:59Z`) > new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) return { state: "scheduled", date };
  if (stated === "scheduled" && date && new Date(`${date}T00:00:00Z`) <= new Date(evaluatedAt ?? `${filed}T23:59:59Z`)) return { state: "completed", date };
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

export function extractSecFilingEvidence({ html, form, filed, accession, documentUrl, documentName, evaluatedAt }) {
  const text = filingHtmlToText(html); const all = sentences(text); const findings = [];
  const add = (kind, category, title, statement, extra = {}) => findings.push({ kind, category, title, statement, event_date: filed, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "high", evidence_state: "confirmed", ...extra });

  const reverseContexts = contextsAround(text, /\breverse (?:stock )?split\b/i);
  const seenReverse = new Set();
  for (const reverse of reverseContexts) {
    const reverseRatio = splitRatio(reverse); if (!reverseRatio) continue;
    const action = resolvedSplitState(reverse, filed, evaluatedAt); const effective = action.date ?? filed;
    const signature = `${reverseRatio.label}:${action.state}:${effective}`; if (seenReverse.has(signature)) continue; seenReverse.add(signature);
    const label = { completed: "Completed", scheduled: "Scheduled", authorized: "Authorized", proposed: "Proposed", cancelled: "Cancelled" }[action.state] ?? "Unresolved";
    add("reverse_split", "reverse_splits", `${label} ${reverseRatio.label} reverse split`, reverse, { event_date: effective, ratio: reverseRatio.label, split_factor: reverseRatio.factor, action_state: action.state, effective_date: action.date });
  }
  const forward = contextAround(text, /\b(?:(?:forward )?stock split|stock dividend)\b/i); const forwardRatio = splitRatio(forward);
  if (forward && forwardRatio && !/\breverse (?:stock )?split\b/i.test(forward)) {
    const action = resolvedSplitState(forward, filed, evaluatedAt); const label = { completed: "Completed", scheduled: "Scheduled", authorized: "Authorized", proposed: "Proposed", cancelled: "Cancelled" }[action.state] ?? "Unresolved";
    add("stock_split", "financial_context", `${label} ${forwardRatio.label} stock split`, forward, { ratio: forwardRatio.label, split_factor: forwardRatio.factor, action_state: action.state, effective_date: action.date });
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
  return findings.slice(0, 12);
}
