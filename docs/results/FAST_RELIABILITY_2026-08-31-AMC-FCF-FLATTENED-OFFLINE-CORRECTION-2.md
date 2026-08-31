# AMC flattened capex-table correction 2 — 2026-08-31

The latest AMC confirmation still reported `period_value_column_mismatch` after
the period-scoped currency hint was accepted. The live-safe diagnostic shape was
therefore treated as unresolved rather than converted into FCF.

Offline coverage now supports two explicitly bounded flattened variants:

- U.S. Markets, International Markets, and Consolidated headers followed by at
  least three segment values; only the final Consolidated value is accepted.
- A single explicit `Consolidated Capital expenditures` value; exactly one
  numeric value is required.

Both variants require one detected comparable period and an identity-gated
currency. Ambiguous flattened text, multiple values without segment headers,
missing currency, and unrelated prose remain withheld. Extraction and
application regressions pass. No SEC, provider, or OpenAI call was made for
this correction, and frozen calibration artifacts remain unchanged.

The exact live HTML was not refetched; a future separately approved confirmation
is required before claiming that AMC's live FCF is now numeric.

