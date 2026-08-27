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
  const href = candidates.find((value) => /(?:ex(?:hibit)?[-_.]?99(?:[-_.]?1)?|99[-_.]?1)\.(?:htm|html|txt)$/i.test(value.split(/[?#]/)[0]));
  if (!href) return null;
  try { const url = new URL(href, documentUrl); const officialHost = url.hostname === "sec.gov" || url.hostname.endsWith(".sec.gov"); return url.protocol === "https:" && officialHost ? url.href : null; } catch { return null; }
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((value) => value.trim()).filter((value) => value.length >= 35 && value.length <= 700);
}

function nearbySentence(all, pattern) {
  return all.find((sentence) => pattern.test(sentence)) ?? null;
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
  if (/\b(?:filed a certificate of amendment.{0,180}(?:effect|effectuate)|became effective|was effective|effected a|implemented|completed)\b/i.test(sentence)) return "completed";
  if (/\b(?:authorized|authorised|approved|granted.{0,100}authority)\b/i.test(sentence)) return "authorized";
  if (/\b(?:proposed|may effect|if effected|seeking approval)\b/i.test(sentence)) return "proposed";
  return "unknown";
}

export function extractSecFilingEvidence({ html, form, filed, accession, documentUrl, documentName }) {
  const text = filingHtmlToText(html); const all = sentences(text); const findings = [];
  const add = (kind, category, title, statement, extra = {}) => findings.push({ kind, category, title, statement, event_date: filed, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "high", evidence_state: "confirmed", ...extra });

  const reverse = nearbySentence(all, /\breverse (?:stock )?split\b/i); const reverseRatio = splitRatio(reverse);
  if (reverse && reverseRatio) {
    const actionState = splitActionState(reverse);
    add("reverse_split", "reverse_splits", `${actionState === "completed" ? "Completed" : actionState === "authorized" ? "Authorized" : actionState === "proposed" ? "Proposed" : "Unresolved"} ${reverseRatio.label} reverse split`, reverse, { ratio: reverseRatio.label, split_factor: reverseRatio.factor, action_state: actionState });
  }
  const forward = nearbySentence(all, /\b(?:(?:forward )?stock split|stock dividend)\b/i); const forwardRatio = splitRatio(forward);
  if (forward && forwardRatio && !/\breverse\b/i.test(forward)) add("stock_split", "financial_context", `Completed ${forwardRatio.label} stock split`, forward, { ratio: forwardRatio.label, split_factor: forwardRatio.factor, action_state: splitActionState(forward) });

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
  const nonReliance = nearbySentence(all, /\b(?:item\s+4\.02|non[- ]?reliance|should (?:no longer|not) be relied upon|will be restated|requires? restatement)\b/i);
  if (nonReliance) add("non_reliance", "going_concern_accounting", "Non-reliance or restatement warning", nonReliance, { severity: "critical" });
  const accounting = nearbySentence(all, /\b(?:restatement|restate|material weakness(?:es)?|internal control(?:s)? over financial reporting.{0,220}(?:not effective|ineffective)|(?:not effective|ineffective).{0,220}internal control(?:s)? over financial reporting)\b/i);
  if (accounting) add("accounting_warning", "going_concern_accounting", "Material weakness or ineffective controls", accounting, { severity: "high" });
  const compliance = nearbySentence(all, /\b(?:Nasdaq|NYSE|exchange).{0,220}\b(?:noncompliance|non-compliance|deficien(?:cy|t)|delist(?:ing|ed)|continued listing standards?|minimum bid price)\b|\b(?:noncompliance|deficien(?:cy|t)).{0,220}\b(?:Nasdaq|NYSE|exchange)\b/i);
  if (compliance) add("exchange_compliance", "compliance", "Exchange compliance warning", compliance, { severity: "high" });

  if (["8-K", "6-K"].includes(form)) {
    const catalyst = all.find((sentence) => MATERIAL_CATALYST.test(sentence) && !/forward-looking statements|incorporated by reference/i.test(sentence));
    if (catalyst) {
      const classification = /offering|purchase agreement|issued and sold|convertible|warrant/i.test(catalyst) ? "financing" : /acqui|merger|business combination/i.test(catalyst) ? "corporate_action" : /appoint|resign|management/i.test(catalyst) ? "management" : /approval|clearance/i.test(catalyst) ? "regulatory" : /contract|award/i.test(catalyst) ? "contract" : "other";
      add("catalyst", "catalysts_news", "Material filing event", catalyst, { classification });
    }
  }
  return findings.slice(0, 12);
}
