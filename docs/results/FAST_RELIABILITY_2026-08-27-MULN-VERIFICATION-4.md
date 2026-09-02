# Issue #55 recursive-plan MULN verification — 2026-08-27

The one authorized process produced a valid partial MULN report in 3,234 ms.
There was no retry, Deep request, hosted search, difficult-budget escalation, or
second ticker.

All five frozen completed ratio/date pairs were retrieved, for 5/5 target recall.
The result nevertheless failed the severe-defect gate. It retained the known
false completed 1-for-100 event on August 4, 2025 beside the real 1-for-250 event.
It also created a false completed 1-for-2 event on August 1, 2025 by truncating
the filing's written 1-for-250 ratio. Both accepted diagnostics explicitly report
`competing_ratio_detected=true`, showing that canonical validation did not enforce
the diagnostic ambiguity signal. Additional non-baseline events require separate
adjudication before they can be treated as reliable history.

The report validated structurally and kept current BINI/OTCID delisted identity
separate from historical MULN/Nasdaq context, but explanation and settlement
accuracy failed because false completed events reached user-facing evidence. The
packet retained 158 corporate-action dispositions: 13 accepted, 7 merged, 29
withheld, and 109 rejected.

Known OpenAI cost was $0. Alpha Vantage made two quota-limited requests, Twelve
Data was not configured and made zero requests, and combined optional-provider
attempts were 2/4. Issue #55 and PR #74 remain open. No further MULN run is
authorized.
