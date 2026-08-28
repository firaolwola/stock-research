# Issue #55 final sparse proof — 2026-08-28

The locked runner executed ONFO and STN exactly once. It made no retry, Deep
request, hosted-search request, extra-ticker run, or difficult-budget escalation.
Both reports validated, but the reliability gate did not pass.

## Result

- material-fact recall: 4/7 (57.14%);
- valid reports: 2/2;
- explanation fidelity: 0/2;
- settlement accuracy: 1/2;
- score/state safety: 2/2; and
- severe misleading misses: one.

ONFO resolved correctly to Onfolio Holdings Inc., CIK 0001825452, Nasdaq common
stock. Fast retrieved the active Rule 5550(b)(1) stockholders'-equity deficiency,
the completed August 10 1-for-50 reverse split, the older bid-price deficiency,
and a newer August 27 Form 8-K stating that bid-price compliance had been regained
and the Rule 5550(a)(2) matter was closed. That newer authoritative fact
prospectively supersedes the frozen baseline's active-bid statement. Historical
artifacts and answer keys were not rewritten. Fast nevertheless retained old
active and newer closed bid-state text without clearly settling the current state.

STN resolved to Stantec Inc., CIK 0001131383, active NYSE common stock, and its
report remained valid and safely partial. SEC retrieval reached the selected Form
40-F and CAD Company Facts, but normalization did not promote the Canadian
foreign-private-issuer regime, Form 40-F/6-K routing, direct common-share and TSX
relationship, or IFRS Accounting Standards as issued by the IASB. This is a
deterministic interpretation/normalization defect, not unavailable evidence.

## Operations

- ONFO: 2,483 ms, $0 OpenAI;
- STN: 6,341 ms, $0.014620 OpenAI;
- aggregate: 8,831 ms;
- Alpha Vantage: 4/4 requests;
- Twelve Data: unconfigured, 0/4 requests;
- combined optional-provider attempts: 4/8; and
- all approved time, call, and cost bounds passed.

Alpha Vantage returned market context but quota-limited news discovery. ONFO
skipped synthesis at the normal cost ceiling; STN's tool-disabled synthesis
completed. Neither outcome converted missing evidence into favorable evidence.

## Gate

Issue #55 remains open. Active-deficiency coverage now has three practical
independent positive cases, but foreign/IFRS has only two passing cases out of
three attempted and remains sparse. The next work is offline: promote bounded
authoritative foreign-filer/accounting-basis evidence and reconcile newer resolved
listing evidence over older active warnings. No further live run is authorized.
