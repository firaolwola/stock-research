# AMC FCF confirmation 6 (2026-08-31)

The approved single live AMC run completed in 2,784 ms with a valid partial
report. SEC retrieval completed successfully and the late inline-XBRL capex
tables in the 2025 10-K were parsed: table indices 300, 301, and 302 were
accepted with `explicit_consolidated_segmented` selection and an explicit
Consolidated column. The resulting filing-table evidence is now present in
the live packet, including annual FCF claims for 2023 and 2024 and a current
six-month FCF calculation.

The current packet reports OCF of USD 106.9M for the six months ended
2026-06-30 and calculates FCF of USD 86.5M for that same period from OCF less
USD 20.4M of capital expenditures. The FCF trend score remains honestly
`limited_coverage` because the latest comparable trend observation is stale
under the Fast freshness rule; this is not a missing-capex parse. OCF is
confirmed at 8.8/10 from two comparable interim observations.

The report was partial because synthesis was cost-blocked (the approved
normal-run ceiling was USD 0.03 versus the synthesis reservation), not because
SEC evidence failed. OpenAI cost was USD 0 and no OpenAI request was made.
Alpha Vantage used two requests: market context completed and news was
quota-limited; Twelve Data was not configured. No retries or extra ticker runs
occurred. The run used 2,784 ms of the 20,000 ms ceiling.

This confirms the offline late-table correction against the live SEC shape.
Historical calibration artifacts and answer keys remain unchanged. A future
FCF remeasurement would still need a separately approved comparison set if a
numeric FCF trend score is required.
