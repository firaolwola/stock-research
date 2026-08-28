# Issue #55 MULN Verification-7 — 2026-08-28

Exactly one newly approved MULN Fast process ran from commit `9bfd846`, a direct
descendant of the required `8fd908e` overlap-precedence correction. It produced
a structurally valid partial report in 3,292 ms. No retry, extra ticker, Deep
run, hosted web search, or difficult-budget escalation occurred.

The live report contains exactly the nine supported canonical completed reverse
splits and no false event. Completed-split recall and canonical precision were
both 9/9. The August 1, 2025 certificate reference does not appear as a
user-facing action; August 4 remains the canonical Completed 1-for-250 event.

The live diagnostics exercised the intended conflict path. Two overlapping
10-Q spans shared one source-reference ID for August 1. The retrospective span
assigned `completion_date` with strength 100. The explicit certificate span
assigned `filing_date` with strength 500. Filing provenance won, the weaker
completion interpretation was suppressed, its acceptance invariant became
false, and it was withheld. Independent explicit effective-date evidence for
August 4 carried strength 600 and merged into canonical `reverse-split-8`.

No false August 4 1-for-100 event, truncated ratio, wrong ratio/date pairing,
completed authorization range, or other duplicate reached the report. The
current BINI/OTCID delisted identity remains separate from historical
MULN/Nasdaq evidence. The section explanation accurately reports nine distinct
actions. The reverse-split score remains Limited rather than forcing a number,
which is safe settlement and separate from canonical-event correctness.

Known OpenAI cost was $0; synthesis was cost-blocked before any OpenAI request.
SEC made 18 requests, Nasdaq made three bounded public-data requests, Alpha
Vantage made two requests, and Twelve Data made zero. Alpha market context
completed while news was quota-limited. The report preserved completed SEC and
exchange evidence. First useful evidence arrived in 514 ms; internal pipeline
latency was 2,714 ms and whole-run latency was 3,292 ms.

The known live MULN parser blocker is resolved. Issue #55 and PR #74 remain open
because NIO correctly remains Limited under unavailable authoritative evidence
and independent sparse-category sample-size proof is still incomplete. MULN
must not be rerun again for this blocker.
