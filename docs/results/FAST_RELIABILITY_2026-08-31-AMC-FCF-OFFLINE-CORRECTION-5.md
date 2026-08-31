# AMC FCF offline correction 5 — 2026-08-31

## Captured live shape

The public AMC 2025 10-K capex table is a late inline-XBRL layout table (about
table index 300), not one of the first 24 tables. Its header uses colspan and
spacer cells, and its capex row contains three numeric inline-XBRL values:
U.S. Markets 174.2, International Markets 71.9, and Consolidated 246.1 (USD
millions). The header and data-cell indices therefore do not align directly.

## Bounded correction

The extractor now selects a bounded set of capex-labelled tables regardless of
their position in the filing, preserves the original index for diagnostics, and
recognizes expanded segment grids. When explicit market headers and at least
three numeric values are present, it accepts only the final Consolidated value.
The exact sanitized table structure is retained in
`fixtures/sec-filings/amc-2025-capex-inline-xbrl.html` with extraction and
application regressions. No full filing or sensitive response data is stored.

Historical live measurements remain unchanged. A future live run would be
needed to confirm the current application path, but no blind rerun is performed
as part of this offline correction.
