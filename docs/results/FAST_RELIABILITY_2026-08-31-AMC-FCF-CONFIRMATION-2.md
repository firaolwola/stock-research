# AMC FCF confirmation 2 — 2026-08-31

The separately approved single AMC Fast confirmation ran exactly once after the
period-scoped SEC currency-hint correction. The run produced a valid safe-partial
report in 2,586 ms with no OpenAI request or cost. SEC retrieval and deterministic
scoring completed; optional market context used two Alpha Vantage requests (the
market request completed and the news request was quota-limited), with no Twelve
Data request.

Operating cash flow was confirmed at USD 106.9 million for the six-month period
ending 2026-06-30. Free cash flow remained `Unknown` because no aligned capex
value was safely extracted. The currency binding correction did take effect: the
captured AMC 10-K capex table received a single `USD` caller hint from the newest
SEC OCF period. However, its bounded extraction diagnostic still reported one
period and zero values because of `period_value_column_mismatch` (accession
`0001411579-26-000016`, table 5). The 10-Q candidate separately remained withheld
for `comparable_periods_not_explicit`.

This confirms the earlier all-period currency-hint defect is corrected, but the
AMC FCF parser/binding gap is not resolved. The result does not rewrite frozen
#55 measurements or the existing FCF denominator. A further live run is not
justified; the next step is offline inspection and fixture coverage for the
10-K table's period/value column shape.

