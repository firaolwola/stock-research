# AMC FCF offline correction 4 — 2026-08-31

The follow-up live confirmation still withheld the AMC capex row, with no
recognized Consolidated column and `period_value_column_mismatch`. The captured
diagnostics do not retain provider HTML, so no further live call is justified
to guess at the layout.

The bounded parser is tightened for another safe presentation variant: market
headers written as `US Markets` (without punctuation between U and S), and
capex values split into sibling rows. The extractor still requires explicit
market headers, a Consolidated label, a single reporting period, and at least
three numeric values before accepting only the final Consolidated amount.
Deterministic extraction and application fixtures pass; ambiguous shapes remain
Limited/Unknown. Historical calibration artifacts remain unchanged.
