# AMC FCF offline correction 3 — 2026-08-31

The live confirmation showed a SEC table shape in which the capex label row had
no value cells, while the market headers and values were present in sibling
rows. The extractor previously detected the `Consolidated` header, marked the
row `consolidated_column_unavailable`, and never reached its flattened-table
fallback.

The bounded fix now permits the fallback when the capex row has no value cells,
and scans only the current table text after the capex label. It still requires
explicit U.S. Markets, International Markets, and Consolidated headers plus at
least three values, selecting only the final Consolidated value. Ambiguous or
generic prose remains withheld.

Deterministic extraction and application fixtures cover this row-split shape;
no network, provider, or OpenAI call was made. Historical live measurements and
answer keys remain unchanged. A future live confirmation is separately gated.
