# AMC FCF confirmation 4 — 2026-08-31

## Scope

One owner-approved live Fast run for AMC after the bounded flattened
Consolidated capex-table fallback. No retries, Deep research, hosted search, or
additional tickers were used. Historical calibration artifacts and answer keys
were preserved.

## Result

- Report: produced and schema-valid (`partial` settlement).
- Elapsed time: 2,801 ms (within the 20-second Fast ceiling).
- SEC retrieval: completed; 14 SEC requests, including the AMC 10-K
  `0001411579-26-000016`.
- OCF: confirmed from Company Facts at USD 106.9M for the six months ending
  2026-06-30.
- FCF: remained `limited_coverage`/unknown; no numeric FCF score was emitted.
- OpenAI: synthesis was skipped by the normal cost guard (`cost_ceiling`), with
  $0.00 consumed. This run did not make a paid OpenAI request.
- Optional providers: Alpha Vantage used exactly 2 requests (market completed;
  news quota-limited); Twelve Data was not configured.

## FCF diagnostic

The live 10-K capex candidate was still withheld with:

`periods_detected=1; values_detected=0; column_selection=period_columns;
currency=USD (caller_hint); reason=period_value_column_mismatch`.

The new offline `flattened_consolidated` and
`flattened_consolidated_single` branches therefore did not match this live HTML
shape. The 10-Q candidate remained withheld as
`comparable_periods_not_explicit`. No unsupported FCF value was inferred, and
the valid report retained OCF and all other completed evidence.

## Adjudication

The bounded fallback is covered by deterministic fixtures, but this live run
does not validate applicability to AMC's current SEC HTML. The remaining gap is
an offline inspection of the captured live table shape and a targeted parser
fixture/correction; another blind live rerun is not justified yet. The FCF
numeric coverage gate remains open while safe Limited/Unknown behavior passes.
