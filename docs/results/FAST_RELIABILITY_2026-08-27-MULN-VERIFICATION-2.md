# Issue #55 corrected-runner MULN verification — 2026-08-27

The corrected one-case runner produced one valid partial MULN report in 3,208 ms.
No retry, Deep request, hosted search, difficult-budget escalation, or other
ticker was run.

All three frozen ratio/date pairs were retrieved, but the completed-action gate
failed: May 4, 2023 1-for-25 was completed; August 11, 2023 1-for-9 and December
21, 2023 1-for-100 remained `unknown`. The report also created a false completed
1-for-100 event on August 4, 2025 by borrowing the following 1-for-250 action's
date. This is a severe misleading miss. Historical MULN/Nasdaq context remained
separate from current BINI/OTCID delisted status.

The internal packet contains 160 corporate-action dispositions: 10 accepted,
10 merged, 31 withheld, and 109 rejected. Authorization ranges were withheld,
undated orphan mentions did not become standalone events, and corroborating
claims merged. The remaining defects are lifecycle inference for dated history
lists and cross-action date borrowing.

The report validated and settled partial safely. OpenAI cost was $0; Alpha
Vantage made two quota-limited attempts; Twelve Data was unconfigured and made
zero requests; combined optional attempts were 2/4. Issue #55 and PR #74 remain
open. No further live run is authorized.
