# Issue #55 independent sparse expansion — 2026-08-28

The owner-approved REKR, ZAPPF, and GMBL batch ran each ticker exactly once.
There were no retries, Deep runs, hosted searches, extra tickers, or difficult-
budget escalation. The process stopped after GMBL failed final validation.

## Result

- Material-risk recall: 10/20 (50%).
- Valid reports: 2/3 (66.67%).
- Explanation fidelity: 0/3.
- Settlement accuracy: 2/3 (66.67%).
- Score/state safety: 3/3; missing evidence never became favorable, although
  GMBL's final report was invalid.
- Severe misleading/system blockers: 2.

## Ticker adjudication

REKR retrieved correct identity, the active Nasdaq minimum-bid deficiency, its
October 26, 2026 deadline, the going-concern warning, and kept a possible reverse
split prospective. It carried current cash and negative operating cash flow but
omitted the frozen baseline's working-capital deficit and near-term note maturity.
Recall was 5/6; the report was valid and safely partial.

ZAPPF safely settled Limited but did not resolve its current OTC ticker to Zapp,
former Nasdaq ticker ZAPP, or CIK 1955104. It therefore missed all seven frozen
identity, filing-regime, split, delisting, going-concern, and freshness checks.
The absence of favorable scores was correct, but this is a severe bounded
historical-identity retrieval defect rather than acceptable unavailable evidence.

GMBL resolved the issuer and CIK, the 1-for-100 split, Nasdaq delisting/OTC
transition, going concern, and stale-financial limitation. It failed final
validation because confirmed security evidence retained `security_type=unknown`.
It also converted the authoritative one-for-four-hundred `(1-for-400)` action
into a user-facing `1-for-4` event. Recall was 5/7 and the ratio defect is severe.

## Category recall

- issuer/security identity: 1/3 (33.33%);
- completed reverse-split history: 1/3 (33.33%);
- active listing deficiency: 1/1 (100%);
- going concern/bankruptcy: 2/3 (66.67%);
- foreign issuer/ADR/IFRS: 0/1 (0%);
- OTC/delisted: 1/2 (50%);
- liquidity/freshness context: 1/4 (25%); and
- prospective-action uncertainty: 1/1 (100%).

## Operations

- elapsed: REKR 2,205 ms; ZAPPF 10 ms; GMBL 5,338 ms;
- aggregate elapsed: 7,563 ms;
- measured OpenAI cost: $0 of the approved $0.09;
- Alpha Vantage: 4 requests of 6 approved; market completed for REKR/GMBL,
  while news returned provider quota;
- Twelve Data: unconfigured, 0 requests of 6 approved;
- combined optional-provider attempts: 4 of 12; and
- every individual run and the aggregate stayed within the approved ceilings.

## Gate and next step

Issue #55 and PR #74 remain open. The reliability gate failed. Before any new
live ticker is proposed, offline work must add stored-shape regressions and fix:

1. exact ZAPPF-to-ZAPP/CIK historical OTC identity resolution;
2. terminal OTC common-stock security-type settlement before confirmation; and
3. complete multi-digit numeric-ratio preservation for GMBL's 1-for-400 action.

The REKR working-capital/note omission should receive a bounded extraction
fixture in the same offline pass. Historical measurements and answer keys remain
unchanged.

## Offline corrective status

The subsequent offline pass added stored-shape regressions and corrected all
identified deterministic mechanisms: exact ZAPPF/ZAPP/CIK lineage and foreign
filing routing, authoritative GMBL OTC common-stock settlement, complete
1-for-400 parsing alongside the 1-for-100 event, and bounded REKR
working-capital-deficit and dated note-maturity extraction. The original 50%
measurement above is immutable. No live rerun has been performed; a same-three
verification requires fresh owner approval.
