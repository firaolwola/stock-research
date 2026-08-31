# Issue #55 AMC date-first effective confirmation 6

Date: 2026-08-31  
Mode: one approved live attempt; no retry

## Result

The zero-token SEC connectivity check passed with HTTP 200 and the approved
Fast run completed SEC retrieval in about 2.7 seconds. The report was valid
but partial: the completed AMC `2023-08-24 — 1-for-10` split remained absent.

Direct inspection of the public filing identified the remaining parser gap.
The authoritative clause spells the ratio as “one share of Class A common
stock for every ten shares of Class A common stock” and states that it is
effective as of August 24, 2023. The extractor only recognized compact
hyphenated forms such as `one-for-ten`; it therefore ignored the authoritative
occurrence and retained an unrelated `one-for-ten split-adjusted basis` table
mention whose date role was unknown. The safety invariant withheld that
occurrence as `resolved_lifecycle_required`.

Diagnostics for the withheld occurrence were accession
`0001104659-23-090981`, document `tm2323643d1_8k.htm`, ratio `1-for-10`,
effective date `2023-08-24`, `date_role=unknown_date_role`, and
`disposition=withheld`.

The run used 14 SEC requests and 2 Alpha Vantage requests (market completed;
news quota-limited). Twelve Data was not configured. OpenAI synthesis was
cost-blocked before request, so OpenAI cost was $0. No false corporate action
reached the report. Targeted completed-split recall was 0/1; the live parser
blocker therefore remains open.

## Offline correction

The parser now accepts a bounded `N share(s) ... for every M share(s)` ratio
when the intervening security description stays sentence-local. A deterministic
regression uses the filing-shaped wording and asserts one completed
`1-for-10` event on `2023-08-24`. Historical live artifacts and answer keys
remain unchanged. Another live confirmation requires separate approval.
