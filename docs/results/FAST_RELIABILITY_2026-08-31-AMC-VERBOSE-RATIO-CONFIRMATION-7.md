# Fast reliability — AMC verbose-ratio confirmation 7 (2026-08-31)

## Outcome

The approved one-run live confirmation completed after the zero-token SEC
preflight returned HTTP 200. SEC retrieval completed and the application
returned a structurally valid, safe partial report in 10,319 ms. No retry was
made. OpenAI synthesis was skipped by the approved cost guard, so this result
used no paid OpenAI tokens.

The expected completed `1-for-10` reverse split effective 2023-08-24 was
represented. The run also promoted an incorrect second completed event:
`550000000-for-10` on the same date. This is a severe precision and explanation
failure, even though the targeted recall was 1/1.

## Adjudication

- Target completed-split recall: 1/1 (100%).
- Canonical corporate-action precision: 1/2 (50%); one false event was shown.
- Report validity: pass (schema validation returned no errors).
- Settlement: safe partial; no unsupported favorable score was inferred.
- Explanation fidelity: fail because the false authorized-share-count ratio was
  presented as a completed reverse split.
- SEC: retrieval completed; 14 SEC requests; no SEC failures.
- Optional providers: Alpha Vantage used two requests (market completed, news
  quota-limited); Twelve Data was not configured.
- OpenAI: zero requests and zero cost; synthesis was cost-blocked before call.

## Root cause

The new verbose ratio matcher accepted any nearby phrase shaped like “N shares
... for every M shares.” In the filing, `550,000,000` is the authorized-share
count, while the later “one share ... for every ten shares” is the actual split
ratio. The permissive bounded span combined those unrelated values into
`550000000-for-10`.

The next offline correction must tighten ratio binding (for example, require an
explicit ratio cue or an action-local numerator/denominator pair) and add a
regression for this authorized-share-count distractor. No live rerun is
authorized by this result.

## Frozen artifacts

The plan and raw/review/run-summary artifacts in
`evaluation/live/2026-08-31-amc-verbose-ratio-confirmation-7/` are preserved as
the authoritative record. Historical calibration baselines are unchanged.
