import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const inputDirectory = process.argv[2] ?? "evaluation/live/2026-08-31-fcf-gate-confirmation-1";
const outputPath = process.argv[3] ?? "evaluation/diagnostics/fast-fcf-coverage-audit-2026-08-31.json";
const tickers = ["AAPL", "AMC", "NCPL", "NXL", "SMCI"];

function classify(record) {
  const metric = record.report?.financial_assessment?.metrics?.free_cash_flow;
  const score = record.report?.scores?.financial_free_cash_flow_trend;
  const validation = record.validation?.valid === true;
  const observations = metric?.observations ?? [];
  const packet = [...(record.evidence_packet?.records ?? []), ...(record.evidence_packet?.sources ?? [])];
  const filingCapex = packet.filter((item) => item.source_type === "sec_filing_table" || /capital expenditure|capex/i.test(`${item.text ?? ""} ${item.summary ?? ""} ${item.label ?? ""}`));
  // Filing-table diagnostics are retained in the evidence packet even when a
  // candidate is withheld. Treat a bounded table candidate with an explicit
  // capex-related rejection (currency, periods, or column alignment) as a
  // parser/binding gap for audit purposes; it is not the same as no evidence.
  const filingTableDiagnostics = (record.evidence_packet?.normalization_diagnostics ?? [])
    .filter((item) => item?.table_index !== null && item?.table_index !== undefined)
    .filter((item) => ["currency_not_explicit", "comparable_periods_not_explicit", "capex_row_not_isolated", "period_value_column_mismatch", "consolidated_column_unavailable", "consolidated_value_missing"].includes(item.reason));
  const filingTableGaps = filingTableDiagnostics.filter((item) => Number(item.periods_detected) > 0);
  const invalidated = /non.?reliance|restatement|invalidat/i.test(`${metric?.summary ?? ""} ${(record.report?.financial_assessment?.coverage_notes ?? []).join(" ")}`);
  let cause = "unavailable_authoritative_evidence";
  if (metric?.state === "confirmed" && score?.state === "confirmed" && observations.length >= 2) cause = "usable_authoritative_pair";
  else if (invalidated) cause = "invalidated_accounting_evidence";
  else if (filingCapex.length > 0 || filingTableGaps.length > 0) cause = "parser_or_binding_gap";
  return {
    ticker: record.ticker,
    report_valid: validation,
    metric_state: metric?.state ?? "missing",
    score_state: score?.state ?? "missing",
    score: score?.value ?? null,
    comparable_observation_count: observations.length,
    filing_table_capex_records: filingCapex.length,
    filing_table_capex_diagnostics: filingTableDiagnostics.map((item) => ({
      accession: item.accession ?? null,
      form: item.form ?? null,
      table_index: item.table_index ?? null,
      periods_detected: item.periods_detected ?? 0,
      values_detected: item.values_detected ?? 0,
      disposition: item.disposition ?? null,
      reason: item.reason ?? null
    })),
    cause,
    safe_settlement: validation && ["confirmed", "limited_coverage", "unknown"].includes(metric?.state),
    evidence_summary: metric?.summary ?? null
  };
}

const cases = [];
for (const ticker of tickers) {
  const record = JSON.parse(await readFile(path.join(root, inputDirectory, "raw", `${ticker}.json`), "utf8"));
  cases.push(classify(record));
}
const usable = cases.filter((item) => item.cause === "usable_authoritative_pair").length;
const safelySettled = cases.filter((item) => item.safe_settlement).length;
const result = {
  audit_id: "fast-fcf-coverage-2026-08-31",
  issue: 81,
  reliability_issue: 55,
  input_directory: inputDirectory.replaceAll("\\", "/"),
  network_calls: false,
  frozen_artifacts_modified: false,
  cases,
  denominator_views: {
    strict_usable_fcf: { detected: usable, expected: cases.length, recall: usable / cases.length, meaning: "Comparable SEC OCF/capex pair sufficient for a numeric FCF trend score." },
    safe_settlement: { settled: safelySettled, evaluated: cases.length, rate: safelySettled / cases.length, meaning: "Missing or invalid FCF remains explicitly Limited/Unscored without favorable inference." }
  },
  cause_counts: Object.fromEntries(["usable_authoritative_pair", "parser_or_binding_gap", "invalidated_accounting_evidence", "unavailable_authoritative_evidence"].map((cause) => [cause, cases.filter((item) => item.cause === cause).length])),
  conclusion: "Captured filing-table candidates with explicit currency, period, or column-alignment rejection are reported as parser_or_binding_gap; accounting-invalidated and genuinely unavailable cases remain separate. This audit is offline and does not authorize another same-five live run."
};
const absoluteOutput = path.join(root, outputPath);
await mkdir(path.dirname(absoluteOutput), { recursive: true });
await writeFile(absoluteOutput, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ strict_usable_recall: result.denominator_views.strict_usable_fcf.recall, safe_settlement_rate: result.denominator_views.safe_settlement.rate, cause_counts: result.cause_counts, network_calls: false }, null, 2));
