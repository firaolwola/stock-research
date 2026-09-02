# Issue #55 MULN Verification-5 — 2026-08-27

Exactly one approved live Fast process ran. It produced a structurally valid
partial report in 4,138 ms with no retry, Deep run, hosted search, difficult
budget escalation, or second ticker.

The run retrieved all five frozen required actions and all four separately
adjudicated post-freeze actions. The four known false events from Verification-4
were absent. Canonical precision nevertheless failed: the report contained ten
events rather than the nine supported events because it promoted
`2025-08-01 — 1-for-250` separately from the correct
`2025-08-04 — 1-for-250` action.

The false occurrence came from accession `0001437749-25-027016`, form `10-Q`,
segment `split-segment-17`. It parsed the complete written token correctly, but
treated the August 1 certificate-filing date as the effective action date. The
diagnostic recorded a truncated source span, competing ratios at positions 433
and 463, ratio position 433, date position 243, and still set the acceptance
invariant to true. It became canonical event `reverse-split-8`. The authoritative
corroborating evidence separately establishes August 4 as the effective date.

The report validates and preserves current BINI/OTCID delisted identity apart
from historical MULN/Nasdaq evidence. Explanation and settlement fidelity fail
because the duplicate wrong-date completed action reached the report. Frozen
recall is 5/5, additional-action recall is 4/4, and canonical precision is 9/10.

Known OpenAI cost was $0; synthesis was cost-blocked before any OpenAI request.
Alpha Vantage used two quota-limited requests, Twelve Data was not configured
and made zero requests, and optional-provider attempts were 2/4. SEC made 18
requests. Issue #55 and PR #74 remain open. No further MULN run is authorized.
