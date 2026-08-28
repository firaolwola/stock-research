# Research evaluation set

**Last reviewed:** 2026-08-27

The versioned evaluation set in `evaluation/cases.json` measures whether fast reports surface material risks without prescribing a brittle full answer. Each scenario records why it matters, an explicit `as_of` cutoff, the evidence areas to investigate, and dated known facts that a report should find or handle with the stated uncertainty. Evidence published after the cutoff is invalid for that scenario.

## Coverage

The set includes large-, mid-, small-, and micro-cap issuers plus ADR, ETF, warrant, OTC/delisted, and invalid-identifier cases. Expectations cover security/listing context, issuer lineage, reverse splits, dilution and offerings, warrants/convertibles, dividends, compliance, going-concern/accounting concerns, financial context, strong and weak catalysts, and explicit uncertainty. `ACME` and `XYZ` are fixture-backed calibration cases; they do not describe real issuers.

The cases are evidence expectations, not investment recommendations. Time-sensitive scenarios must be reviewed and re-dated before a new benchmark is reported. Confirmed expectations include a source available on or before the scenario cutoff, with SEC filings, exchange notices, and issuer materials preferred.

## Rubric

- **Material-risk recall:** detected known material facts divided by expected
  known material facts. Fast reliability requires approximately 95% overall and
  approximately 90% in every adequately sampled critical category; these are
  targets, not claims about current performance.
- **Completeness:** expected evidence areas visibly addressed, including explicit unknown or inapplicable results.
- **Source quality and factual support:** primary-source share, source appropriateness, and whether each detected claim is supported.
- **Issuer lineage:** prior ticker/name history is carried forward only when linkage is evidenced.
- **Uncertainty:** expected `unknown`, `limited_coverage`, and `not_applicable` states are preserved.
- **Operations and clarity:** p50/p95 latency, token use, web-search calls,
  average/maximum estimated cost, budget status, and a reviewer clarity rating
  from 1 through 5 accompany coverage and recall results.
- **Score calibration:** deterministic expected state/value checks are reported
  overall and by material-risk category; unresolved expected inputs must remain
  null rather than pass by becoming favorable numbers.

Score calibration for the redesigned methodology does not require one exact
ground-truth number. Review whether material facts were found and interpreted
correctly, the short explanation matches the evidence, the score lies within an
owner-reviewed reasonable range, and clearly riskier cases generally score worse
than cleaner cases.

Syntax errors, timeouts, configuration failures, malformed upstream responses, and other deterministic application failures are app reliability results. They are reported separately and never counted as missed research facts. A successful report that omits an expected fact is a research-quality miss.

## Token-free dry run

```powershell
npm run evaluate:dry
npm test
```

The dry sample uses only `evaluation/samples/mock-results.json`. It makes no
OpenAI call. Its synthetic operating values exercise the budget logic; they are
not live performance claims. The current sample evaluates two fictional research
reports plus three deterministic invalid-input cases; it does not run the real
ticker scenarios through production evidence-first Fast. Review every scenario
and source date when changing the set. The validator rejects incomplete coverage
and post-cutoff evidence.

The dry evaluator uses the executable $0.03 normal Fast maximum. Its sample costs
are intentionally below that ceiling and do not authorize or predict a live paid
run. The $0.05 difficult ceiling remains an explicit per-run policy rather than
the evaluator's default.

## Fast reliability gate

Critical Fast categories are:

- current security and listing identity;
- reverse splits;
- dilution and offerings;
- warrants and convertibles;
- exchange compliance;
- going-concern and accounting warnings;
- financial context;
- catalysts and news; and
- uncertainty handling.

Deeper issuer lineage remains evaluated, but exhaustive predecessor research is
not subject to the same Fast category gate. Current issuer resolution and obvious
recent identity changes remain critical.

For every category, report detected and expected fact counts, recall, sample
size, important misses, and whether each miss arose from retrieval,
interpretation, or unavailable evidence. A sparse category must disclose its
uncertainty and gather more cases before being declared reliable.

The milestone does not pass when:

- overall recall is below approximately 95%;
- an adequately sampled critical category is below approximately 90%; or
- a known severe misleading miss remains unresolved.

Severe milestone-blocking misses include:

- wrong-issuer or wrong-security evidence;
- false or misattributed current catalyst or news;
- missed recent material dilution, offering, warrant, or convertible overhang;
- missed meaningful reverse-split history relevant to current risk;
- missed active exchange deficiency or delisting risk;
- missed going-concern, restatement, non-reliance, or major accounting warning;
- materially wrong cash, debt, runway, or freshness context that makes an issuer
  appear safer;
- missing or uncertain evidence converted into a favorable score; and
- a scoring or explanation error that materially reverses risk direction.

## Evidence-first Fast phase-one result

Token-free SEC fixtures verify architecture coverage, not real-ticker recall:

- security/listing identity and CIK: confirmed;
- former-name lineage with bounded SEC dates: confirmed when present;
- recent financing-form discovery: limited coverage;
- standardized cash and revenue facts: confirmed in the fixture;
- recent 8-K/6-K catalyst discovery: limited coverage; and
- reverse-split terms, warrants/convertibles, compliance text,
  going-concern/accounting language, dividends, and non-SEC news: unknown or
  limited coverage.

The bounded filing-text fixture now improves architecture coverage as follows:

- reverse-split ratios: explicit terms produce confirmed items;
- offerings: actual/agreed issuance is confirmed, while registration capacity
  remains limited coverage;
- warrants and convertibles: explicit instrument language produces confirmed
  items;
- going-concern, accounting/restatement, and listing-deficiency language:
  explicit statements produce confirmed warnings;
- current 8-K/6-K substance: a specific material-event sentence produces a
  confirmed current catalyst; and
- stale standardized financial periods: periods older than 180 days produce a
  sourced high-severity freshness warning.

These deterministic phrase fixtures improve category capability but do not
measure recall on the dated real-ticker cases. They do not establish the 95%
recall target. The existing dry evaluator
continues to measure its checked-in report samples. A future approved dated
evaluation must measure the new retrieval path against real case facts.

The deterministic regression suite also preserves the severe shapes discovered
in the 2026-08-27 Issue #55 batch: same-end quarter/YTD Company Facts, AMC-style
completed reverse splits and issuance growth, NCPL-style non-reliance
invalidation, and SMCI-style material weaknesses, recent cash-flow deterioration,
and forward-split share normalization. These tests correct known mechanisms but
do not replace a separately approved live batch or prove recall targets.

The approved same-five-ticker repeat on 2026-08-27 improved recall from 66.28%
to 82.56% but still failed the milestone. Current-flow precedence and the worst
split-as-dilution wording improved, while live evidence exposed overbroad
non-reliance matching, persistent corporate-action selection gaps, an omitted
SMCI material weakness, and an invalid Limited shares series. The independent
result is in `docs/results/FAST_RELIABILITY_2026-08-27-BATCH-2.md`. The same-five
Batch 3 plan was subsequently approved and frozen. The owner then approved the
Alpha Vantage-first/Twelve Data-fallback policy with at most 10 requests per
provider and 20 optional-provider attempts combined. Prior artifacts and the
independent answer key remain unchanged.

Batch 3 completed all five bounded runs and improved recall to 83/86 (96.51%),
with five valid reports. It did not pass the milestone: reverse-split and FCF
category recall remained below 90%; AAPL control language, AMC split history,
NXL split timing, and SMCI listing context produced severe misses; and required
sparse categories remain unproven. The independent result is recorded in
`docs/results/FAST_RELIABILITY_2026-08-27-BATCH-3.md`.

Post-Batch-3 offline regressions now cover the four reproduced severe mechanisms:
positive-control language no longer becomes a weakness; historical submissions
can supply AMC's authoritative completed split; NXL-style future-effective
actions remain scheduled until their cutoff passes; and financing/listing
covenants do not become active exchange deficiencies. True SMCI weakness and
active Nasdaq-notice controls remain detected. These corrections do not change
the measured Batch 3 result and are not another calibration run. AMC/NXL FCF
remains honestly Limited because the stored evidence has no aligned capex fact.

The subsequently approved four-ticker sparse batch is recorded in
`docs/results/FAST_RELIABILITY_2026-08-27-SPARSE-1.md`. It produced four valid
reports but only 3/16 material checks (18.75%). BIOR, former ticker MULN, and
TUPBQ were absent from the current SEC ticker map and exposed the lack of a
historical-ticker/OTC identity fallback; their finished work also remained
incorrectly labeled Pending. NIO exercised the foreign 20-F/6-K path but exposed
an effective-controls false positive and inconsistent foreign Company Facts
selection. The batch therefore proves neither the sparse categories nor the
milestone and authorizes no additional paid run.

Offline corrective coverage now resolves those reproduced mechanisms without
changing the measured 18.75% result. A bounded SEC-backed historical identity
registry links BIOR, MULN/BINI, and TUP/TUPBQ to exact CIKs; it is never fuzzy,
and unresolved symbols settle terminally Limited. Authoritative filing seeds
retain completed splits, financing, bankruptcy, going-concern, and delisting
evidence after lineage resolution. Foreign-filer normalization accepts
compatible IFRS revenue and attributable-profit aliases, while positive 20-F
control language is excluded from material-weakness findings. The frozen plan
remains unchanged; stale identity facts are recorded separately in
`evaluation/plans/fast-reliability-2026-08-27-sparse-corrections.json`.

The separately approved same-four Sparse-2 verification then measured 13/16
(81.25%) material checks, up from 3/16, and terminal settlement passed 4/4. It
still failed: only NIO validated; BIOR/MULN had lineage source-link defects;
MULN omitted older split history and retained stale listing semantics; NIO still
missed annual net loss; and TUPBQ used a 404 delisting seed and an invalid
catalyst classification. Explanation fidelity remained 0/4 and score/state
checks remained 7/18. See
`docs/results/FAST_RELIABILITY_2026-08-27-SPARSE-2.md`.

The post-Batch-2 corrective branch now reproduces those mechanisms offline. It
uses dedicated bounded filing slots for Item 4.02, Item 5.03, compliance, and
control disclosures; requires event-specific non-reliance language; separates
resolved exchange history from active deficiencies; clears scoreable
observations when a share series is Limited by an unresolved split; and accepts
additional SEC revenue taxonomy aliases without merging incompatible periods.
The score-range diagnostic at
`evaluation/diagnostics/fast-score-ranges-2026-08-27-batch-2.json` preserves the
measured reports and records every failed owner range with normalized inputs,
periods, sources, formula components, confidence, and a cause classification.
These are regression fixes, not new calibration measurements; historical and
later measured artifacts remain unchanged. Another live batch still requires
owner approval.

The post-Sparse-2 corrective pass now also covers the four invalid-report
mechanisms without changing any measured artifact: reciprocal source links for
former-name lineage, bounded extraction of multiple completed splits from one
filing, dated terminal OTC/delisting identity precedence, and contract-safe
catalyst classification. NIO-specific SEC attributable-net-loss aliases are
accepted only for its exact CIK. The stored NIO revenue inputs reproduce the
reported 9.6 score under methodology 2.1.0, so the owner range is recorded as
too narrow rather than used to tune the method. Another live run remains a
separately approved verification, not part of this offline correction.

The separately approved Sparse-3 same-four verification restored final-report
validity from 1/4 to 4/4 and improved material-check recall from 13/16 (81.25%)
to 14/16 (87.5%). It did not pass the reliability gate. MULN still omitted the
three required 2023 completed splits, NIO still lacked a safely normalized
attributable annual net-loss series, and split extraction still duplicated or
misdated some occurrences across filings. Explanation fidelity remained 0/4
and score/state checks remained 7/18. Alpha Vantage exhausted or reported its
provider quota on all eight bounded attempts; Twelve Data was unconfigured;
completed SEC evidence survived. See
`docs/results/FAST_RELIABILITY_2026-08-27-SPARSE-3.md`.

The post-Sparse-3 offline correction preserves those measurements and adds
regressions for the reproduced failure shapes. Filing HTML is normalized to
visible text before the bounded evidence window is applied, so large inline-XBRL
markup cannot hide a selected filing's later corporate-action disclosure.
Reverse-split occurrences now retain separate filing, announcement, effective,
and completion dates; event identity uses the action date and ratio, while
corroborating filings contribute source links rather than duplicate events.
Current OTC/delisted identity now makes earlier exchange deficiencies explicitly
historical in the explanation. A NIO-only attributable-loss fallback requires
the exact issuer CIK, an exact semantic label, CNY units, and otherwise comparable
SEC periods. The frozen Sparse-3 payload did not retain the unmatched live
Company Facts tag/label, so the exact live alias remains unverified until a
separately approved run. Capital-score sufficiency diagnostics enumerate missing
inputs and retain `Limited`; they do not force a numeric score. See
`evaluation/diagnostics/capital-sufficiency-sparse-3.json` and
`evaluation/diagnostics/nio-attributable-loss-sparse-3.json`.

The separately approved Sparse-4 live verification remained at 14/16 material
checks (87.5%) with 4/4 valid reports and 4/4 safe settlement. Current-versus-
historical listing wording improved enough for TUPBQ to pass explanation review,
but BIOR retained undated duplicate split occurrences, MULN still lacked a
correct complete dated 2023 split series, and NIO still lacked attributable
annual net loss. The NIO run artifact also did not preserve the rejected Company
Facts concept metadata needed for exact alias diagnosis. Explanation fidelity
therefore improved only to 1/4 and score/state checks remained 7/18. See
`docs/results/FAST_RELIABILITY_2026-08-27-SPARSE-4.md`.

The post-Sparse-4 offline correction does not change that measurement. Split
regressions now bind ratios, lifecycle language, and dates inside one bounded
local mention, then reconcile raw mentions into canonical events keyed by ratio
and authoritative action date. Corroborating claims survive without creating
extra user-facing occurrences; ambiguous undated mentions are withheld rather
than assigned another action's date. BIOR fixtures settle to exactly two dated
events, and a close-packed MULN fixture retains the May 4 1-for-25, August 11
1-for-9, and December 21 1-for-100 actions without promoting an authorization
range to a completed 1-for-60 event. Rejected Company Facts candidates now emit
bounded, non-evidentiary structural diagnostics in the evaluation packet. These
are deterministic readiness checks, not a new reliability result.

The approved Sparse-5 verification remained at 14/16 material checks (87.5%)
with 4/4 valid reports, 4/4 safe settlement, and 7/18 score/state checks. BIOR's
canonical split reconciliation passed and explanation fidelity improved to 3/4.
MULN's live filing shape still produced an incomplete and partly false corporate-
action history. NIO's diagnostic now identifies the exact limitation: the live
Company Facts candidates represent total, noncontrolling-interest, or
comprehensive income/loss, not a safely established annual loss attributable to
ordinary shareholders. The semantic gate was not broadened. See
`docs/results/FAST_RELIABILITY_2026-08-27-SPARSE-5.md`.

The post-Sparse-5 offline correction does not alter that frozen result. The
MULN live-shaped regression now retains the May 4 1-for-25, August 11 1-for-9,
and December 21 1-for-100 actions, while authorization ranges and undated orphan
occurrences remain diagnostic-only. Internal corporate-action diagnostics record
the accession, form, local span, ratio, lifecycle, effective and filing dates,
canonical event ID, disposition, and reason without entering the report.

The NIO review concluded that no safe Company Facts equivalent exists in the
captured candidates. A bounded 20-F exact-table fallback is not supportable from
the stored evidence with the current parser. Prospectively, a correctly settled
`Limited` result after bounded candidate adjudication should be classified as
`unavailable_authoritative_evidence`, separately from retrieval and normalization
misses. This rule does not revise frozen answer keys or historical batch recall.
See `evaluation/diagnostics/nio-attributable-loss-sparse-5-decision.json`.

The approved MULN-only live process on 2026-08-27 produced no research result.
The dedicated runner omitted the established event-loop keep-alive handle, so
Node exited with an unsettled top-level await before report, diagnostics, or
provider telemetry were persisted. The process was not retried; known OpenAI
cost is zero and optional-provider usage is unknown. This is a runner failure,
not evidence that the parser passed or failed. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION.md`.

The separately approved corrected-runner MULN verification produced a valid
partial report, but failed the corporate-action gate. It retrieved all three
frozen ratio/date pairs, classified only the May 4 1-for-25 action completed,
left the August 11 1-for-9 and December 21 1-for-100 actions unresolved, and
created a false completed 1-for-100 action on August 4, 2025 beside the actual
1-for-250 action. The captured diagnostics isolate lifecycle inference in dated
history lists and cross-action date borrowing. No retry occurred. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION-2.md`.

The stored verification-2 shape now has deterministic regression coverage.
Segment-local extraction completes the May 4, August 11, and December 21, 2023
MULN actions from authoritative retrospective history, preserves the August 4,
2025 1-for-250 action, and suppresses the false same-date 1-for-100 event. This
is offline evidence only; another live verification requires separate owner
approval and Issue #55 remains open.

The subsequently approved final MULN process did not reach research. Its nested
child plan inherited only one parent level, leaving the frozen baseline reference
undefined during local plan validation. No network client was created, provider
usage and OpenAI cost were zero, and no retry occurred. This is a runner
composition failure, so the live parser remains unadjudicated. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION-3.md`.

The nested-plan defect now has prospective offline correction. Evaluation plans
resolve recursively with descendant precedence, parent-integrity checks,
cycle/missing-parent protection, required-field validation before runtime setup,
and leaf-level source provenance. The exact Verification-3 chain now resolves
its grandparent baseline, provider policy, approval bounds, and frozen MULN case
ID deterministically. The failed artifact remains unchanged and its authorization
is not reusable; a new live run still requires separate owner approval.

The fresh recursive-plan MULN verification reached research and produced a valid
partial report, but failed the severe canonical-action gate. It retrieved all
five frozen completed splits, yet retained the false August 4, 2025 1-for-100
event and added a false August 1, 2025 1-for-2 event by truncating written
1-for-250 text. Both accepted occurrences had `competing_ratio_detected=true`.
The parser blocker therefore remains open; no retry occurred. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION-4.md`.

The two false-positive mechanisms are now corrected offline against the frozen
Verification-4 shape. Complete number-word ratios no longer truncate, action
dates cannot cross an intervening ratio, and canonicalization independently
enforces the extraction acceptance invariant. Stored evidence supports nine
prospective canonical actions; restored-compliance dates and both Verification-4
false actions are excluded. The live artifact and its five-event answer key were
not changed. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION-4-OFFLINE-CORRECTION.md`.

The separately approved Verification-5 live process retrieved all five frozen
events and all four post-freeze supported actions, and removed the four known
false Verification-4 pairs. It still failed canonical precision: the August 1
certificate-filing date was promoted as a separate completed 1-for-250 event
beside the correct August 4 effective event. The complete word ratio was parsed
correctly, but the truncated competing-ratio span passed the action-binding
invariant. Recall was 5/5 plus 4/4; precision was 9/10. No retry occurred. See
`docs/results/FAST_RELIABILITY_2026-08-27-MULN-VERIFICATION-5.md`.

The Verification-5 filing-date defect now has deterministic offline correction.
Corporate-action dates are classified as filing, announcement, authorization,
scheduled-effective, effective, completion, trading-effective, or unknown.
Certificate filing dates cannot establish Completed actions. One same-issuer,
same-direction, same-ratio filing reference may corroborate exactly one
effective/completion event within seven days; the action date wins and ambiguous
or unmatched filing references remain withheld. The replay retains all nine
supported MULN actions and removes the August 1 duplicate while preserving its
claim/source as provenance. Frozen measurements and artifacts are unchanged.
See `docs/results/FAST_RELIABILITY_2026-08-28-MULN-VERIFICATION-5-OFFLINE-CORRECTION.md`
and `evaluation/diagnostics/muln-verification-5-date-role-reconciliation.json`.

## Paid live evaluation boundary

A paid evaluation must never run automatically or as part of routine tests. It
requires explicit owner approval for that run. Before requesting approval,
record the date, model/configuration, exact case IDs (at most five), maximum
budget, and output location. After an approved run, record input/output tokens,
web-search calls, estimated cost, per-case latency, app failures, and the full
rubric results. The evaluator rejects missing approval or measurement fields.
Redact credentials and do not commit sensitive provider payloads.
