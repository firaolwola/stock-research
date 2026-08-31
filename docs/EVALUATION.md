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

### FCF comparability correction (2026-08-31)

The frozen 3/5 FCF result remains unchanged. Offline review found that the
normalizer selected OCF and capital expenditures independently, then required
those selections to share a period. A shorter quarterly OCF could therefore
hide a valid aligned YTD pair. FCF now selects the newest aligned SEC pair,
with deterministic duration ordering at a shared end date; it still requires
matching unit/period, never infers FCF from OCF alone, and leaves missing or
conflicting capex Limited/Unknown. A regression covers the quarter-vs-YTD
collision. No live or paid request was made; a separately approved
remeasurement is needed to determine whether this improves the affected
tickers' live coverage. See
`docs/results/FAST_RELIABILITY_2026-08-31-FCF-OFFLINE-CORRECTION.md`.

### FCF remeasurement 1 (2026-08-31)

The owner-approved AMC/NXL remeasurement ran exactly two Fast cases within the
20-second per-ticker and $0.06 aggregate bounds. Both reports were valid
safe-partial results: OCF was confirmed through 2026-06-30, but neither case
returned an aligned authoritative SEC capital-expenditure fact. FCF therefore
remained Unknown and its trend score remained Limited/Unscored. Alpha Vantage
used four requests; synthesis was cost-blocked before any OpenAI request, so
measured OpenAI cost was $0. The frozen same-five 3/5 FCF measurement is not
rewritten. This confirms an unavailable-authoritative-evidence gap for these
two live shapes rather than another period-selection defect. See
`docs/results/FAST_RELIABILITY_2026-08-31-FCF-REMEASUREMENT-1.md`.

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

The newly approved Verification-6 process produced one valid partial report and
did not retry. Recall was 9/9, but canonical precision remained 9/10 because an
overlapping 10-Q span still promoted August 1 as a completed 1-for-250 action.
One occurrence correctly classified the date as filing provenance and withheld
it; another used the retrospective-history fallback to classify the same date as
completion, passed the invariant, and made reconciliation ambiguous. Explanation
and settlement fidelity therefore failed with one severe misleading event. The
run cost $0 in OpenAI usage, took 3,657 ms, used 18 SEC requests and two Alpha
Vantage requests, and stayed inside all approved bounds. See
`docs/results/FAST_RELIABILITY_2026-08-28-MULN-VERIFICATION-6.md`.

The subsequent offline correction resolves interpretations of the same dated
source reference before canonical acceptance. Explicit effective/completion
language outranks filing provenance, filing provenance outranks retrospective
completion inference, and equal-strength role conflicts remain withheld. The
exact stored Verification-6 shape now preserves the full nine-event MULN history
while merging August 1 filing provenance into the August 4 effective event. See
`docs/results/FAST_RELIABILITY_2026-08-28-MULN-VERIFICATION-6-OFFLINE-CORRECTION.md`.

Verification-7 then exercised that exact conflict against the live SEC path in
one approved run. The report validated with all nine supported MULN actions,
9/9 recall, 9/9 precision, and no severe misleading event. The August 1
retrospective occurrence was suppressed by the stronger filing-date role, while
August 4 remained the canonical effective action. The live MULN parser blocker
is resolved and must not be rerun. Issue #55 remains open for NIO's unavailable
authoritative evidence and independent sparse-category sample-size proof. See
`docs/results/FAST_RELIABILITY_2026-08-28-MULN-VERIFICATION-7.md`.

The smallest proposed independent expansion is now frozen as a planning-only
three-ticker set in
`evaluation/plans/fast-reliability-sparse-expansion-proposal.json`. REKR covers
an active Nasdaq deficiency plus going concern; ZAPPF covers a Cayman foreign
private issuer using IFRS, a completed reverse split, Nasdaq delisting, and OTC
identity; GMBL independently covers completed splits, going concern, and a
voluntary Nasdaq-to-OTC transition. The proposal has no approval token and is
not executable. It would add only one new foreign/IFRS issuer and one new active
deficiency issuer, leaving those categories explicitly sparse even if all three
cases pass. No live execution is authorized.

Prospectively, NIO attributable annual net loss is
`unavailable_authoritative_evidence`, not a system miss, when bounded
authoritative retrieval completes, no safe Company Facts concept or implemented
SEC table fallback exists, and the score settles Limited/Unscored. This
classification does not alter any frozen batch measurement, answer key, or
reported recall.

The subsequently approved three-ticker expansion ran REKR, ZAPPF, and GMBL once
each and stopped on GMBL final validation failure. It measured 10/20 (50%)
material-risk recall, 2/3 valid reports, 0/3 explanation fidelity, 2/3 settlement
accuracy, and two severe blockers. REKR retrieved the active deficiency and
going-concern warning but missed exact working-capital/note pressure. ZAPPF did
not resolve to Zapp/CIK 1955104. GMBL retained an unknown security type despite
confirmed terminal evidence and rendered its 1-for-400 action as 1-for-4. No
missing evidence became favorable. Offline correction is required before any
additional live sample. See
`docs/results/FAST_RELIABILITY_2026-08-28-SPARSE-EXPANSION-1.md`.

Offline corrective work now reproduces all four failure shapes without network
access: exact ZAPPF/ZAPP/CIK lineage reaches the foreign 20-F/6-K path; GMBL
settles authoritative OTC common-stock identity and retains 1-for-100 plus
1-for-400; and REKR preserves explicit working-capital-deficit and near-term
note-maturity disclosures. The measured 10/20 result remains frozen. A fresh
same-three verification is technically justified but is not authorized.

That approved verification improved the frozen same-three result from 10/20 to
17/20 (85%) with 3/3 valid reports. REKR passed all checks; ZAPPF identity and
foreign/OTC routing plus GMBL's exact 1-for-400 normalization held live. The gate
still failed because ZAPPF did not promote completed 1-for-20 evidence or the NT
20-F lateness reason, generic prospectus text created a false non-reliance
warning, and GMBL security type remained Limited despite authoritative
common-stock evidence elsewhere in the packet. No additional live run is
authorized. See
`docs/results/FAST_RELIABILITY_2026-08-28-SPARSE-EXPANSION-1-VERIFICATION-1.md`.

Offline stored-shape regression work now covers those four defects without
changing the frozen 17/20 measurement: a reviewed retrospective 20-F record can
promote ZAPPF's completed 1-for-20 action while its earlier authorization remains
non-completed provenance; NT annual filings receive a bounded selection slot and
an explicit delayed-filing warning; generic prospectus restatement risk language
cannot create non-reliance without Item 4.02 or an issuer/auditor accounting
determination; and identity-gated common-stock wording anywhere in the selected
packet may settle GMBL's security type. Another same-three live verification is
technically justified but requires fresh owner approval.

Sparse Expansion Verification-2 then ran those three frozen cases once. It
measured 20/20 recall, 3/3 valid reports, 3/3 settlement accuracy, 100% completed
corporate-action precision/recall, and zero severe misleading misses. All four
Verification-1 defects resolved live. The complete gate still failed: ZAPPF's NT
20-F used a generic fallback instead of its filing-specific delay reason, and
the NT selection slot surfaced irrelevant old NT forms for REKR and GMBL.
Explanation fidelity was 2/3. Active-deficiency and foreign/IFRS proof also
were sparse at two independent positive cases each at that time. No further live
work was authorized from that batch. See
`docs/results/FAST_RELIABILITY_2026-08-28-SPARSE-EXPANSION-1-VERIFICATION-2.md`.

Offline regression now constrains NT selection by filer regime, report period,
age, superseding periodic filings, and the current freshness gap. Stored ZAPPF
text preserves a filing-specific issuer reason; missing reasons remain explicitly
unavailable. Stored REKR and GMBL shapes no longer surface old cured NT forms.
No same-three rerun is proposed. The authoritative baseline pass rejected HUBC
because Nasdaq closed its MVLS deficiency and rejected XPEV as an IFRS proof case
because its SEC financial statements use U.S. GAAP. The one permitted replacement,
ONFO, is accepted for active-deficiency proof from its August 19, 2026 Form 10-Q.
Stantec (STN) was accepted as the clean foreign/IFRS replacement: its direct
common shares trade on NYSE and TSX, it files Form 40-F/6-K as a Canadian foreign
private issuer, and its 2025 SEC-filed statements explicitly use IFRS Accounting
Standards as issued by the IASB. The frozen ONFO/STN pair ran once on 2026-08-28.
ONFO retrieved newer authoritative closure of its bid-price matter while its
stockholders'-equity deficiency remained active; frozen historical baselines were
not rewritten. STN validated but did not promote foreign-private-issuer, 40-F/6-K,
direct-share/TSX, or IASB-IFRS semantics. The run measured 4/7 bundled material
claims, 2/2 valid reports, and one severe miss. Offline deterministic correction
then added bounded annual-exhibit retrieval. The subsequent confirmation passed
ONFO and STN at 7/7 targeted claims with zero severe misses, bringing active-
deficiency and foreign/IFRS coverage to three practical independent positive
cases each. This satisfies the local milestone minimum but is not a broad
statistical reliability claim. See
`docs/results/FAST_RELIABILITY_2026-08-28-FINAL-SPARSE-PROOF-1.md`.

The fresh same-five confirmation on 2026-08-28 replayed AAPL, AMC, NCPL, NXL,
and SMCI once against the unchanged Batch-3 baseline. It measured 82/86
(95.35%) with five valid reports and no favorable inference from missing data.
AAPL's clean-control warning and SMCI's restored-compliance projection were
corrected; NXL's August 28 split was excluded from the August 27 adjudication
cutoff. AMC's completed 1-for-10 split remains absent and NCPL's Item 4.02 /
non-reliance event was not surfaced, so two severe live misses remain. The
free-cash-flow category also remains below target. This confirmation therefore
does not satisfy the Issue #55 gate or authorize closure. See
`docs/results/FAST_RELIABILITY_2026-08-28-FINAL-FIVE-CONFIRMATION-1.md`.

### Targeted AMC/NCPL offline correction (2026-08-28)

The two remaining severe mechanisms were reproduced without network or paid
provider calls. AMC's stored live-shaped filing had a written ratio whose
effective date and lifecycle wording were not bound strongly enough for
canonical promotion; the parser now handles that bounded date/lifecycle shape
and also accepts sentence punctuation while still rejecting alphanumeric/hyphen
truncation. Explicit past effective dates are settled safely.
NCPL's Item 4.02 used authoritative “prevent future reliance on affected
previously issued financial statements” wording rather than the narrower
“should no longer be relied upon” phrase; the Item 4.02 extractor now recognizes
that bounded form and invalidates affected financial trend inputs. New
integration regressions cover both report outcomes and retain the existing
boilerplate negative controls. This is an offline correction only; a fresh live
confirmation requires separate owner approval and historical measured artifacts
remain unchanged.

The separately approved two-case confirmation then ran exactly one Fast request
for AMC and one for NCPL. NCPL's Item 4.02 prevention-of-reliance event was
surfaced as a critical warning and affected financial inputs remained
Limited/Unscored. AMC's completed 2023-08-24 1-for-10 split was still absent
from the live bounded packet, whose reverse-split section correctly settled
Limited rather than favorable. Both reports were valid and safely partial; the
targeted result was 1/2 (50%), so the AMC retrieval/filing-selection defect
remains open. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-NCPL-OFFLINE-CORRECTION-CONFIRMATION-1.md`.

### AMC split offline correction 2 (2026-08-28)

The live AMC diagnostics showed that the ratio/effective clause can occur more
than 260 characters after the `reverse stock split` anchor in inline-XBRL or
prospectus text. The bounded extractor now permits 900 characters after that
anchor while still stopping at the next action. A deterministic delayed-clause
fixture passes the completed 1-for-10/date binding and canonical invariant.
This remains offline-only; no new live result is implied. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-SPLIT-OFFLINE-CORRECTION-2.md`.

### AMC split offline correction 3 (2026-08-28)

The fresh AMC confirmation reached the delayed 2023 filing and extracted the
`1-for-10` ratio and `2023-08-24` effective date, but canonical acceptance
withheld it because the past-effective-date fallback did not retain a lifecycle
position. The parser now records an explicit effective-date fallback lifecycle
source and binds that lifecycle proof to the selected effective-date position,
without weakening date, issuer, competing-ratio, or authorization safeguards.
A deterministic regression covers the no-nearby-lifecycle-verb shape. The
live report and prior measurements remain unchanged; another AMC request still
requires separate approval. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-SPLIT-OFFLINE-CORRECTION-3.md`.

### AMC effective-date confirmation 3 (2026-08-28)

The separately approved single AMC run produced a valid safe-partial report in
about 2.6 seconds, but the live diagnostic still extracted `1-for-10` and
`2023-08-24` as `unknown_date_role` and withheld the event with
`resolved_lifecycle_required`. The targeted live check therefore measured 0/1
and the severe AMC blocker remains open. OpenAI synthesis was cost-blocked
before request; no retry was made. The next step is offline reproduction of the
exact live normalized text shape, not another blind live run. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-EFFECTIVE-DATE-CONFIRMATION-3.md`.

### AMC split offline correction 4 (2026-08-28)

The failed confirmation's extracted date was recovered by nearby-date logic,
but the live normalized relationship wording (“effective date of which was …”)
was not recognized as an explicit effective-date role. The bounded grammar now
accepts that relationship form and uses the same local date as the safe
completed fallback lifecycle proof. An inline-XBRL-shaped regression passes;
no live result or historical measurement changed. A new live confirmation still
requires separate approval. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-SPLIT-OFFLINE-CORRECTION-4.md`.

### AMC effective-date confirmation 4 (2026-08-28)

The next approved AMC run again produced a valid safe-partial report but
withheld the extracted `1-for-10` / `2023-08-24` occurrence as
`unknown_date_role` / `resolved_lifecycle_required` (0/1 targeted recall).
OpenAI synthesis was cost-blocked before request and no retry was made. This
result remains frozen; the direct effective-date relationship correction is
covered offline and requires separate approval for any new live check. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-EFFECTIVE-DATE-CONFIRMATION-4.md`.

### AMC split offline correction 5 (2026-08-28)

The next approved AMC confirmation still extracted the ratio/date but retained
`unknown_date_role`. Offline replay identified the remaining common form as
“with an effective date of DATE” (plus equivalent `thereof` wording). The
bounded grammar now accepts direct `of`/`for` date relationships and keeps date
extraction and role classification aligned. An inline-XBRL-shaped regression
passes with a completed `1-for-10` event on `2023-08-24`; the failed live result
and historical measurements remain unchanged. Another live confirmation still
requires separate approval. See
`docs/results/FAST_RELIABILITY_2026-08-28-AMC-SPLIT-OFFLINE-CORRECTION-5.md`.

### AMC split offline inspection 6 (2026-08-31)

Inspection of the frozen confirmation-4 diagnostics narrowed the remaining
live gap to a date-first effective-date relationship. The SEC span extracted
`one-for-ten` / `2023-08-24`, with the date preceding the ratio, but the role
classifier returned `unknown_date_role` and the canonical invariant withheld
the event. The shared extractor/classifier now accept only a bounded form in
which that date is explicitly identified as the effective date of the nearby
reverse split. A deterministic HTML regression passes; the live result and
historical measurements remain unchanged. See
`docs/results/FAST_RELIABILITY_2026-08-31-AMC-SPLIT-OFFLINE-INSPECTION-6.md`.

### AMC date-first confirmation 5 (2026-08-31)

The one approved live attempt was blocked by the execution environment on the
initial SEC ticker-map request (`EACCES` nested in `AggregateError`; no
response received). It produced a valid safe-partial report with all
dependent areas Limited, zero OpenAI/optional-provider requests, and no retry.
The parser target was not evaluated; the result remains an infrastructure
failure, not evidence that the offline correction passed live. See
`docs/results/FAST_RELIABILITY_2026-08-31-AMC-DATE-FIRST-CONFIRMATION-5.md`.

### AMC date-first confirmation 6 (2026-08-31)

With network access restored, the approved AMC run completed SEC retrieval but
still missed the target split. Direct inspection found that the authoritative
filing spells the ratio as “one share ... for every ten shares”; the parser
only accepted hyphenated ratios and instead saw an unrelated table mention
with no date role. The run remains a valid, safe partial baseline (0/1 target
recall). A bounded verbose-ratio grammar and deterministic regression now cover
the filing shape; no live result or historical measurement changed. See
`docs/results/FAST_RELIABILITY_2026-08-31-AMC-DATE-FIRST-CONFIRMATION-6.md`.

## Offline adversarial and property evaluation roadmap

### Purpose and boundary

Issue #55 will use a small automated offline suite as the immediate feedback
mechanism for deterministic SEC interpretation work. Its purpose is to expose
semantic variants and cross-property contamination before another live
calibration, then guard the targeted evidence-binding rules used to correct those
classes. It complements the dated report-level evaluation set; it does not replace
live recall measurement or make a reliability claim about unseen issuers.

The implemented core suite is deterministic, token-free, and runnable with no network,
SEC, exchange, market-data, provider, or OpenAI access. An offline pass never
authorizes a paid or live run. The intended developer command is
`npm run evaluate:adversarial`. It emits machine-readable JSON and fails when a
development mutation or untouched holdout violates its reviewed invariant.

### Initial corpus

The first corpus contains 12 high-value cases rather than a broad filing archive.
It focuses on the final live ONFO/STN contamination classes, with XPEV-like and
foreign-ordinary controls plus four untouched category holdouts. Existing exact
Issue #55 tests continue to cover MULN, GMBL, NCPL, REKR, BIOR, ZAPPF, NIO, and
TUPBQ retrieval and normalization shapes.

Each fixture must retain:

- ticker, CIK, current security identity, and any confirmed effective-dated
  lineage needed by the case;
- accession, form, filing date, report date, document name, and authoritative
  source URL;
- the exact stored parser input, including block or section boundaries when they
  affect meaning;
- manually reviewed expected typed candidates and settled facts where exact
  outputs are appropriate;
- named invariants and allowed semantic transformations; and
- the failure taxonomy categories exercised by the fixture.

Stored live result JSON is diagnostic evidence, not automatically a parser-input
fixture. When an existing artifact lacks the exact contaminating source text, use
an explicitly labeled semantically faithful negative-control or distractor case
and improve prospective capture. Do not rewrite frozen live artifacts.

### Initial properties and transformations

The minimum suite should contain 12–20 explicit invariants covering at least:

- complete ratio-token parsing and action-local ratio/date/lifecycle binding;
- filing, announcement, authorization, scheduled-effective, effective,
  completion, and trading-effective date roles;
- duplicate and overlapping occurrence canonicalization;
- accounting-framework evidence bound to an authoritative statement-basis
  declaration;
- security/depositary structure bound to the issuer's current listed security;
- compliance lifecycle and explanation projection keyed by venue and rule;
- current versus historical listing evidence;
- Item 4.02 or actor/determination binding for non-reliance;
- NT-form relevance and supersession by the expected periodic filing;
- exact issuer/security lineage and filing-regime boundaries; and
- correct Limited or withheld settlement when authoritative evidence is absent
  or ambiguous.

Reviewed semantic-preserving transformations may include whitespace,
punctuation, harmless HTML or inline-XBRL wrappers, equivalent ratio/date forms,
duplicate corroborating blocks, reordering independent explicitly dated blocks,
and injection of unrelated ADS, ADR, IFRS, U.S.-GAAP, restatement, split, date,
or listing-rule language. A transformation must not remove negation, move a date
between dependent clauses, reorder a lifecycle whose order supplies meaning, or
otherwise change semantics while expecting an invariant result.

### Oracle hierarchy and failure classification

Use the following oracle order:

1. owner/reviewer-frozen structured facts from authoritative evidence;
2. manually specified invariants and metamorphic relationships independent of
   production parser implementation;
3. simple rule-derived expectations from separately documented rules;
4. old-versus-new output differences for triage only;
5. human adjudication for ambiguous generated cases; and
6. optional AI-generated test ideas or failure clustering, never normal CI truth.

Production regexes or settlement functions must not generate their own expected
answers. Do not build a second deterministic parser or make an LLM the offline
oracle.

Before changing production behavior, classify every failure as one of:

- invalid transformation or incorrect oracle;
- missing fixture or metadata coverage;
- isolated parser defect;
- recurring structural evidence-binding defect;
- correct Limited, withheld, or unavailable-authoritative-evidence behavior; or
- unresolved case requiring human adjudication.

Only the isolated and recurring parser categories justify production correction.
Recurring cross-property, issuer/security, date-role, section, evidence-precedence,
or lifecycle failures should prefer typed candidate and settlement improvements
over issuer-specific exceptions.

### Reporting, holdouts, and success criteria

Report fixture and transformation counts alongside:

- invariant pass rate by transformation family;
- canonical event precision and recall;
- cross-property contamination rate;
- false-promotion and false-suppression counts;
- lifecycle reconciliation results; and
- issuer and category holdout results.

Do not collapse these into one mutation score. A high aggregate rate must not hide
a complete failure in a critical category.

Keep at least two or three issuer cases untouched while developing each shared
binding correction, and use category holdouts where the corpus supports them.
Mutation parameters and distractor combinations must not merely restate the
production patterns under test. With a small deterministic corpus, this
development/holdout discipline is useful; a machine-learning-style training
program is not required.

The minimum suite is useful when it:

- represents every known severe Issue #55 parser bug class;
- catches intentionally reintroduced historical defects;
- exposes semantic variants not covered by exact regression fixtures;
- demonstrates that unrelated property distractors cannot change settled facts;
- preserves correct unknown, Limited, withheld, and unavailable outcomes;
- produces identical results for the same seed and inputs;
- runs offline within a practical CI budget, initially targeted below ten
  seconds; and
- passes together with the complete existing deterministic suite.

These criteria establish prospective parser protection only. Issue #55 still
requires its separately defined real-ticker reliability, sparse-category, severe
miss, explanation-fidelity, settlement, budget, and approval gates.

### Implemented offline result

The 2026-08-28 run passed 36/36 transformations across 12 fixtures and 20 named
invariants. Accounting binding passed 9/9, security binding 15/15, compliance
projection 6/6, and uncertainty/withholding 6/6. The untouched holdout partition
passed 12/12 and cross-property contamination was zero. The complete 340-test
suite also passed, retaining historical corporate-action, non-reliance, lineage,
NT-form, and runner-parity coverage. See
`docs/results/FAST_RELIABILITY_2026-08-28-OFFLINE-ADVERSARIAL-1.md`.

### Explicit non-goals

The Issue #55 minimum does not include a generic random semantic fuzzer, mutation
DSL, automatic minimizer, comprehensive full-filing corpus, independent second
parser, LLM adjudication dependency, new provider, dashboard, or automatic live
evaluation. Broader work requires evidence that the minimum suite produced useful
new failures and a separately scoped follow-up issue.

## Paid live evaluation boundary

Final Sparse Proof 1 remains frozen at 4/7. Offline stored-shape regressions now
promote STN as a Canadian foreign private issuer under 40-F/6-K, IASB IFRS, CAD
presentation, and direct common shares on NYSE plus TSX without inventing an ADS
ratio. ONFO now reconciles its newer Rule 5550(a)(2) closure against the older bid
warning while leaving Rule 5550(b)(1) active.

The separately approved ONFO/STN confirmation ran exactly once per ticker on
2026-08-28. It stayed within every bound and produced 2/2 valid partial reports.
ONFO passed the targeted listing/split checks. STN passed identity, Canada,
foreign-private-issuer, 40-F/6-K, CAD, and NYSE context, but the selected live
filing text produced no typed IFRS/IASB or direct-common-share/TSX candidate. The
targeted result was 5/7 material claims, explanation fidelity 1/2, settlement
accuracy 1/2, score/state safety 2/2, and one severe false-suppression miss.
This was an interpretation/normalization defect, not unavailable authoritative
evidence; no false ADS or U.S.-GAAP promotion occurred.

The offline correction now retrieves a bounded set of SEC-hosted 99.x exhibits
linked from annual 20-F/40-F filings and includes a regression for the STN
audited exhibit shape. A fresh approved confirmation then ran once per ticker
and passed 7/7 targeted claims, 2/2 valid reports, 2/2 explanation fidelity,
2/2 settlement accuracy, 2/2 score/state safety, and zero severe misses. The
two-case confirmation does not establish broad reliability or close Issue #55;
independent sample-size review remains required, and no further run is
authorized automatically.

A paid evaluation must never run automatically or as part of routine tests. It
requires explicit owner approval for that run. Before requesting approval,
record the date, model/configuration, exact case IDs (at most five), maximum
budget, and output location. After an approved run, record input/output tokens,
web-search calls, estimated cost, per-case latency, app failures, and the full
rubric results. The evaluator rejects missing approval or measurement fields.
Redact credentials and do not commit sensitive provider payloads.

### AMC verbose-ratio confirmation 8 (2026-08-31)

The fresh approved one-run confirmation passed the SEC preflight and produced a
valid report in 2,982 ms. The canonical history contained exactly the expected
completed `1-for-10` reverse split effective 2023-08-24; the prior false
`550000000-for-10` event was absent. SEC retrieval completed with 14 requests,
Alpha Vantage used two requests (market completed, news quota-limited), and
OpenAI synthesis was cost-blocked before request. Targeted recall and
precision were 1/1 with safe partial settlement. The known AMC verbose-ratio
blocker is resolved for this shape; Issue #55 remains open for its broader
reliability and sampling gates. See
`docs/results/FAST_RELIABILITY_2026-08-31-AMC-VERBOSE-RATIO-CONFIRMATION-8.md`.

### AMC verbose-ratio confirmation 7 (2026-08-31)

The approved one-run confirmation passed the SEC connectivity preflight and
completed SEC retrieval in 10,319 ms. The expected completed `1-for-10` split
effective 2023-08-24 was found, but the verbose matcher also promoted a false
`550000000-for-10` completed event from an authorized-share count followed by
the real “one share ... for every ten shares” wording. The report remained
schema-valid and safely partial; OpenAI synthesis was cost-blocked before any
request. Target recall was 1/1, but canonical precision was 1/2 and explanation
fidelity failed. This severe precision result is frozen; no retry or additional
live run is authorized. The next step is an offline ratio-binding correction
and regression for authorized-share-count distractors. See
`docs/results/FAST_RELIABILITY_2026-08-31-AMC-VERBOSE-RATIO-CONFIRMATION-7.md`.

### AMC verbose-ratio binding correction (2026-08-31)

Offline replay of confirmation 7 now rejects the authorized-share-count
distractor by requiring an explicit `ratio of` cue for verbose share-for-every
ratios. The legitimate AMC phrase remains covered by regression. This is a
prospective parser correction only; the failed live result and all historical
measurements remain frozen. Any live confirmation requires separate approval.

### Issue #55 milestone review (2026-08-31)

The frozen calibration record was reviewed after AMC confirmation 8. The latest
targeted AMC result is 1/1 with exact `1-for-10` canonical history and no false
`550000000-for-10` event. This resolves that targeted parser blocker but does not
rewrite the 82/86 same-five confirmation or other historical denominators.
Practical positive-case counts now reach 5 completed reverse-split, 3 active
deficiency, 4 going-concern/bankruptcy, 3 foreign/ADR/IFRS, and 5 OTC/delisted
cases. The frozen same-five FCF result remains 3/5 (60%), below the approximately
90% category gate. NIO attributable annual net loss remains
`unavailable_authoritative_evidence`, not a system miss. Because denominators
overlap across batches and FCF remains below gate, Issue #55 stays open and PR
#74 is not merge-ready. See
`docs/results/FAST_RELIABILITY_2026-08-31-MILESTONE-REVIEW.md`.

### Zero-token SEC connectivity preflight (#75, 2026-08-31)

Before any approved live Fast verification runner constructs an OpenAI or
bounded-provider client, it performs exactly one bounded GET of the SEC
ticker-map endpoint using the configured server-side User-Agent. The response
body is never read or logged. HTTP 200 is the only success state; non-200,
timeout, and network-denial outcomes stop the run before research, provider
quota, or OpenAI budget work begins. Diagnostics include only the endpoint
category, elapsed time, status when available, response-received flag, cache
state, request count, and sanitized error names/codes. This gate is now wired
into every approved live-calibration runner and is covered by deterministic
HTTP, timeout, and network-denial tests. It does not alter historical
calibration artifacts or authorize a new live batch; the next active step is
the Issue #55 aggregate reliability decision. When the execution environment
denies outbound access (for example, a sandbox EACCES), the runner must be
restarted with the required network permission before requesting or executing
another AMC/ticker confirmation.

### Final Issue #55 milestone adjudication (2026-08-31)

The frozen results and later targeted confirmations were reviewed without
rewriting historical denominators. Known AMC, NCPL, AAPL, NXL, SMCI, ONFO, and
STN binding mechanisms are corrected or confirmed for their covered shapes, and
the latest independent sparse cohorts passed their targeted claims. The
milestone nevertheless remains open: the frozen same-five FCF category is
3/5 (60%), Batch 3 score-range calibration is 30/57 (52.63%), and overlapping
rubrics do not yield one defensible pooled recall number. NIO attributable
annual net loss remains `unavailable_authoritative_evidence` and is excluded
from system-miss counts because the bounded authoritative path correctly could
not establish a safe concept. Practical sparse-category counts are reported
without claiming statistical reliability. See
`docs/results/FAST_RELIABILITY_2026-08-31-FINAL-ADJUDICATION.md`.

### FCF remeasurement 2 (2026-08-31)

The approved independent MSFT/RIVN run validated both directions of the
corrected SEC FCF derivation: MSFT produced positive FCF from aligned annual
OCF/capex ($66.987B), while RIVN produced negative FCF from an aligned
six-month pair (-$1.924B). Both reports were valid and synthesis was
cost-blocked before any OpenAI request. This confirms the parser on clean
positive/negative shapes but does not rewrite the frozen same-five 3/5 FCF
denominator; AMC, NCPL, and NXL remain Limited/Unscored where authoritative
capex is unavailable or invalidated. See
`docs/results/FAST_RELIABILITY_2026-08-31-FCF-REMEASUREMENT-2.md`.

### Post-review prioritized backlog (2026-08-31)

The final #55 adjudication remains open. The next work is deliberately
offline-first and is tracked as a dependency chain rather than another blind
live batch:

1. [Issue #76](https://github.com/firaolwola/stock-research/issues/76) adds
   bounded SEC filing-table capex coverage for FCF. It must preserve strict
   issuer/accession/period/currency/unit/cadence/accounting-validity gates and
   leave unavailable shapes Limited/Unscored.
2. [Issue #77](https://github.com/firaolwola/stock-research/issues/77) calibrates
   score ranges, explanation fidelity, and relative ordering with deterministic
   fixtures and untouched holdouts, without silently changing Methodology
   2.1.0.
3. [Issue #78](https://github.com/firaolwola/stock-research/issues/78) performs
   the final frozen-artifact adjudication and can close #55 only if the 95%
   overall, 90% adequately sampled category, zero-severe-miss, and Definition
   of Done gates are actually satisfied.

Creating this backlog does not authorize live or paid evaluation. NIO's
`unavailable_authoritative_evidence` classification remains prospective and is
not a system miss; all prior measured batches and answer keys remain frozen.

## Issue #78 final adjudication (2026-08-31)

The reproducible adjudicator reads frozen cohort summaries and the offline
score-calibration diagnostic, hash-audits the source artifacts, and refuses to
pool overlapping rubrics. It records the descriptive Batch 1/2/3 and final-
five recall values, category/sample-size results, cause classifications, and
the NIO unavailable-authoritative-evidence treatment. The closure gate remains
failed: frozen same-five FCF is 3/5, broad score/explanation calibration is not
a milestone claim, and overlapping cohorts do not establish an overall recall
denominator. A separate offline audit now passes five practical independent
reverse-split cases (15/15 canonical events) with no severe misses; it does not
rewrite the frozen same-five result or claim statistical reliability. The next
scoped work is tracked in Issue #81; its separately approved confirmation is
recorded below and does not change this adjudication.

## Issue #77 offline score calibration

`evaluation/plans/fast-score-calibration-2026-08-31.json` and its diagnostic
output run the same production scoring path used by Express without network,
provider, or OpenAI access. The matrix covers every 2.1.0 score direction,
range, dated evidence link, explanation fidelity, and honest unresolved state;
holdouts check company-relative trends and risk ordering. It does not alter
frozen #55 measurements or claim live reliability. Run with
`npm run evaluate:calibration` before any separately approved live work.

## Issue #81 FCF denominator adjudication

`npm run evaluate:fcf-gate` keeps the frozen same-five FCF denominator (3/5,
60%) separate from the independent MSFT/RIVN clean-control cohort (2/2,
informational only). The evaluator hash-audits the source plans and summaries,
classifies the two frozen misses as unavailable authoritative capex evidence,
and records an approval-gated five-case remeasurement proposal. The separately
approved five-case remeasurement is recorded below; this command itself remains
offline and the #55 closure gate remains open.

### Issue #81 FCF gate confirmation (2026-08-31)

The owner-approved confirmation ran exactly once for AAPL, AMC, NCPL, NXL, and
SMCI. All five reports were valid safe-partial reports. AAPL and SMCI retained
comparable SEC-derived FCF observations (2/5 strict usable coverage); AMC and
NXL had no aligned authoritative capex pair, while NCPL's affected flow history
was invalidated by the recent non-reliance event. Those three cases remained
Limited/Unscored, with no favorable inference. Safe settlement was 5/5.

The run used 10 Alpha Vantage requests, no Twelve Data requests, no retries,
Deep, hosted search, or OpenAI request; measured OpenAI cost was $0. Aggregate
elapsed time was 10,507 ms (maximum ticker 2,350 ms). This descriptive result
does not rewrite the frozen same-five 3/5 FCF denominator. Numeric FCF coverage
remains unproven, while safe unresolved settlement passed 5/5; Issue #55
remains open for its other reliability and sample-size gates. See
`evaluation/live/2026-08-31-fcf-gate-confirmation-1/summary.json`.

### Offline FCF coverage audit (2026-08-31)

`npm run evaluate:fcf-coverage` inspects the captured confirmation packets
without network or provider calls. It separates a confirmed comparable SEC
OCF/capex pair from an honest Limited/Unscored settlement and classifies
remaining cases as parser/binding gaps, accounting-invalidated evidence, or
unavailable authoritative evidence. The audit found two usable pairs, one
non-reliance-invalidated case, and two unavailable capex cases; no captured
filing-table capex record was discarded after retrieval. A further same-five
paid run is therefore not justified by a known parser defect. Numeric coverage
and safe settlement are tracked as separate FCF gate dimensions.

### Issue #76 offline implementation (2026-08-31)

Fast now has a bounded SEC filing-table capex fallback for already retrieved
10-K/10-Q/20-F/40-F documents. Deterministic fixtures cover annual, YTD, and
quarter-style tables, explicit unit/scale normalization, negative FCF,
currency/column ambiguity, unsupported forms, source provenance, and
non-reliance invalidation. No live calibration or paid provider call was made;
the frozen same-five FCF result (3/5) is unchanged and still requires later
remeasurement after #77/#78.

### Offline reverse-split adjudication (2026-08-31)

`npm run evaluate:reverse-split` audits the latest frozen authoritative-shaped
artifacts without network, provider, or OpenAI access. Five independent positive
cases (BIOR, MULN, ZAPPF, GMBL, and ONFO) contain 15 expected canonical
completed reverse-split events. All 15 were present with no false completed
events (100% event recall and 100% canonical precision); all five reports were
valid and safely settled, with zero severe misses. This is a practical
minimum-sized category audit, not a pooled or broad statistical reliability
claim. The historical same-five denominator and every prior measured artifact
remain unchanged. Reverse-split failure is therefore removed from the current
final gate, while Issue #55 remains open for independent overall recall, FCF
numeric coverage, and score/explanation gates.
