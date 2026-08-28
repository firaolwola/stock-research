# Issue #55 AMC split offline correction 3

Date: 2026-08-28  
Mode: deterministic reproduction only after the approved AMC confirmation; no
new live or paid-provider call

## Finding

The fresh AMC confirmation reached the older 2023 filing and extracted both
`1-for-10` and the explicit effective date `2023-08-24`, but canonical
acceptance still withheld the action with `resolved_lifecycle_required`.
The parser had safely inferred `completed` from an effective date in the past,
but the acceptance invariant did not retain a lifecycle position for that
fallback. This made a valid retrospective effective-date clause fail the same
binding check used to reject ambiguous actions.

## Correction

Explicit past effective-date fallback now records the internal lifecycle source
`explicit_effective_date_fallback`. Canonical binding uses the selected
effective-date position as the lifecycle proof for this narrowly bounded case,
while still requiring a valid effective date, issuer/source binding, and all
competing-ratio protections. A regression fixture covers the AMC-shaped clause
without a nearby lifecycle verb and confirms a completed canonical event.

The approved live result remains unchanged: the report was valid and safely
partial, but its live reverse-split section remained Limited. No new live call
was made after this correction; another AMC confirmation requires separate
owner approval. Historical calibration artifacts and answer keys are
unchanged.
