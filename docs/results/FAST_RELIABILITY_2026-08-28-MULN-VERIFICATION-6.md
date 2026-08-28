# Issue #55 MULN Verification-6 — 2026-08-28

Exactly one newly approved MULN Fast process ran from commit `723ee03`, a direct
descendant of the required `2092c1c` correction. It produced a structurally
valid partial report in 3,657 ms. No retry, extra ticker, Deep run, hosted web
search, or difficult-budget escalation occurred.

The report retrieved all nine expected supported completed reverse splits, but
the critical acceptance condition failed. It still reported the August 1, 2025
certificate-amendment filing reference as a separate completed 1-for-250 action
beside the correct August 4 effective event. Canonical precision therefore
remained 9/10 while completed-split recall was 9/9.

The live diagnostics isolate two overlapping occurrences in accession
`0001437749-25-027016`. `split-segment-18` correctly classified August 1 as a
`filing_date`, failed the Completed invariant, and was withheld. However,
`split-segment-17` treated the same August 1 reference as a `completion_date`
through `authoritative_retrospective_history`, passed the invariant, and created
`reverse-split-8`. Because that false canonical event coexisted with the correct
August 4 event, the filing-reference reconciliation saw multiple nearby
same-ratio candidates and safely refused to choose between them.

The correct August 4 event was independently accepted from explicit effective-
date language and merged across corroborating filings. All ratios remained
complete; no 1-for-250 value became 1-for-2 or 1-for-25. Authorization ranges and
undated occurrences did not become user-facing actions. Historical MULN/Nasdaq
context remained separate from current BINI/OTCID delisted identity. No other
false completed event appeared.

The report validated, but explanation fidelity and settlement failed because it
claimed ten canonical actions and exposed the false August 1 event. This remains
one severe misleading corporate-action defect, so the live MULN parser blocker
is not resolved.

Known OpenAI cost was $0; synthesis was cost-blocked before an OpenAI request.
SEC made 18 requests. Alpha Vantage made two requests: market context completed
and news returned a quota limitation. Twelve Data was not configured and made
zero requests. Optional-provider attempts were 2/4. The whole run remained well
inside the 20-second ceiling.

No retry is authorized. Issue #55 and PR #74 remain open.
