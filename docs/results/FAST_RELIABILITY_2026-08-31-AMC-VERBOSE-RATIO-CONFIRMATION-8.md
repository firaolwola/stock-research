# Fast reliability — AMC verbose-ratio confirmation 8 (2026-08-31)

## Outcome

The fresh, separately approved single AMC confirmation passed the zero-token SEC
preflight (HTTP 200) and completed in 2,982 ms. The report was produced and
schema-valid. No retry was made, and OpenAI synthesis was cost-blocked before a
request, so paid OpenAI usage was $0.

## Adjudication

- Canonical reverse-split history: exactly one bounded event,
  `Completed 1-for-10`, effective 2023-08-24.
- False `550000000-for-10` event: absent.
- Completed-split recall: 1/1.
- Canonical precision: 1/1 for the targeted action.
- Report validity: pass; no validation errors.
- Settlement: safe partial with unresolved optional enrichment retained as
  Limited; no favorable conclusion was inferred from missing evidence.
- SEC: completed, 14 requests, no failures.
- Alpha Vantage: 2 requests (market completed; news quota-limited).
- Twelve Data: 0 requests; not configured.
- OpenAI: 0 requests, $0 cost; synthesis was cost-blocked by the approved
  budget guard.

## Result

The known live AMC verbose-ratio blocker is resolved for this filing shape. The
offline binding correction correctly prevents authorized-share counts from
becoming split numerators while preserving the legitimate verbose ratio. No
additional AMC run is authorized automatically. Issue #55 remains open pending
its broader reliability and sampling gates; this one-case confirmation does not
establish the overall milestone.

## Frozen artifacts

The plan and raw/run-summary artifacts in
`evaluation/live/2026-08-31-amc-verbose-ratio-confirmation-8/` are preserved as
the authoritative record. Earlier confirmation artifacts and answer keys were
not modified.
