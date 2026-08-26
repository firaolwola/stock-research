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
  const match = sentence?.match(/(?:ratio of\s+)?(?:one|1)\s*[- ]?for[- ]?\s*([0-9][0-9,]*)/i);
  return match ? `1-for-${match[1].replaceAll(",", "")}` : null;
}

export function extractSecFilingEvidence({ html, form, filed, accession, documentUrl, documentName }) {
  const text = filingHtmlToText(html); const all = sentences(text); const findings = [];
  const add = (kind, category, title, statement, extra = {}) => findings.push({ kind, category, title, statement, event_date: filed, accession, document: documentName, source_url: documentUrl, source_title: `${form} filed ${filed} — ${documentName}`, confidence: "high", evidence_state: "confirmed", ...extra });

  const reverse = nearbySentence(all, /\breverse (?:stock )?split\b/i); const ratio = splitRatio(reverse);
  if (reverse && ratio) add("reverse_split", "reverse_splits", `${ratio} reverse split`, reverse, { ratio });

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
  const accounting = nearbySentence(all, /\b(?:financial statements?|interim financial information).{0,180}\bshould no longer be relied upon\b|\b(?:restatement|restate|material weakness)\b/i);
  if (accounting) add("accounting_warning", "going_concern_accounting", "Accounting or restatement warning", accounting, { severity: "high" });
  const compliance = nearbySentence(all, /\b(?:Nasdaq|NYSE|exchange).{0,220}\b(?:noncompliance|non-compliance|deficien(?:cy|t)|delist(?:ing|ed)|continued listing standards?|minimum bid price)\b|\b(?:noncompliance|deficien(?:cy|t)).{0,220}\b(?:Nasdaq|NYSE|exchange)\b/i);
  if (compliance) add("exchange_compliance", "compliance", "Exchange compliance warning", compliance, { severity: "high" });

  if (["8-K", "6-K"].includes(form)) {
    const catalyst = all.find((sentence) => MATERIAL_CATALYST.test(sentence) && !/forward-looking statements|incorporated by reference/i.test(sentence));
    if (catalyst) {
      const classification = /offering|purchase agreement|issued and sold|convertible|warrant/i.test(catalyst) ? "financing" : /acqui|merger|business combination/i.test(catalyst) ? "corporate_action" : /appoint|resign|management/i.test(catalyst) ? "management" : /approval|clearance/i.test(catalyst) ? "regulatory" : /contract|award/i.test(catalyst) ? "contract" : "other";
      add("catalyst", "catalysts_news", "Material filing event", catalyst, { classification });
    }
  }
  return findings.slice(0, 8);
}
