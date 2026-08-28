# Issue #55 AMC effective-date confirmation 3

Date: 2026-08-28  
Mode: one approved live Fast run; no retry, Deep, hosted search, or paid OpenAI
synthesis

## Result

The AMC report was produced and valid, with safe partial settlement in about
2.6 seconds. SEC retrieval reached accession `0001104659-23-090981` and the
internal diagnostic extracted `1-for-10` and `2023-08-24`, but the occurrence
was still withheld as `unknown_date_role` / `resolved_lifecycle_required`.
The user-facing reverse-split section therefore remained Limited. This is a
severe live extraction miss, not a favorable inference.

## Operations

- OpenAI spend: `$0`; synthesis was cost-blocked before request.
- Alpha Vantage: 2 approved attempts (market and news); both Limited by quota.
- Twelve Data: 0 requests; not configured.
- Retries: 0; hosted web-search calls: 0.

The live result does not authorize another run. The next step is offline
reproduction of the exact normalized filing text/date-role shape, followed by a
new owner approval if another confirmation is needed. Prior calibration
artifacts and answer keys remain unchanged.
