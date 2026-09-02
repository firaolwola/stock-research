# Issue #55 Sparse Expansion 1 verification — 2026-08-28

The corrected implementation ran REKR, ZAPPF, and GMBL exactly once. No retry,
extra ticker, Deep run, hosted search, or difficult-budget escalation occurred.
The frozen original answer key was not changed.

## Result

- Material-risk recall: 17/20 (85%), up from 10/20 (50%).
- Valid reports: 3/3.
- Explanation fidelity: 1/3.
- Settlement accuracy: 1/3.
- Score/state safety: 3/3; missing evidence never became favorable.
- Completed corporate actions: 2/3 recall and 2/2 precision.
- Severe misleading misses: 1, the omitted completed ZAPPF split.

REKR passed all 6 checks. It retained the active Nasdaq deficiency and October
26, 2026 deadline, going concern, $6.598 million working-capital deficit, and
$15.0 million notes due December 15, 2026. It did not invent a completed split.

ZAPPF improved from 0/7 to 5/7. Exact ZAPPF → ZAPP → CIK 1955104 resolution,
Cayman foreign-private-issuer/IFRS routing, Nasdaq delisting, current OTC state,
and going concern all worked. The completed 1-for-20 split was not promoted from
the bounded filing set. The report settled stale financials Limited but omitted
the explicit NT 20-F reason and misclassified generic prospectus restatement
language as a company non-reliance event.

GMBL improved from 5/7 with an invalid report to 6/7 with a valid report. Its
1-for-100 and 1-for-400 events were exact, canonical, and duplicate-free.
However, terminal settlement remained `security_type=unknown`/Limited because
the latest compliance excerpt did not itself contain the common-stock wording
available elsewhere in the selected authoritative filings.

## Operations

- elapsed: REKR 4,311 ms; ZAPPF 2,473 ms; GMBL 2,955 ms;
- aggregate elapsed: 9,750 ms;
- measured OpenAI cost: $0 of $0.09 approved;
- Alpha Vantage: 6 of 6 approved requests;
- Twelve Data: unconfigured, 0 requests;
- combined optional-provider attempts: 6 of 12; and
- all individual and aggregate time ceilings passed.

## Gate and next step

Issue #55 and PR #74 remain open. The 95% recall and zero-severe-miss gates did
not pass. Before another live run, add stored-live-shape regressions and correct:

1. ZAPPF completed 1-for-20 filing selection/lifecycle promotion;
2. explicit NT 20-F lateness representation;
3. non-reliance negative controls for prospectus restatement boilerplate; and
4. GMBL security-type settlement from identity-gated authoritative evidence
   across the selected filing packet, not only the terminal compliance excerpt.

No further live verification is authorized.

## Prospective offline correction

The frozen measurements above remain unchanged. Stored Verification-1 shapes now
regress the four failures: ZAPPF's retrospective 20-F confirmation promotes the
completed split without promoting its authorization; NT 20-F lateness is selected
and represented explicitly; prospectus restatement boilerplate is a negative
non-reliance control; and GMBL common-stock identity settles from identity-gated
packet evidence rather than only the terminal excerpt. A fresh same-three live
verification is technically justified but requires separate owner approval.
