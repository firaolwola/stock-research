# Issue #55 AMC split offline correction 2

Date: 2026-08-28  
Mode: deterministic reproduction only; no live or paid-provider calls

## Finding

The targeted live confirmation recorded `complete_ratio_token_required` for
AMC's older reverse-split filings. The extractor's local span ended 260
characters after the `reverse stock split` anchor, so an inline-XBRL/prospectus
table clause that stated the ratio and effective date later in the same action
was discarded before parsing.

## Correction

The bounded local span now permits up to 900 characters after the anchor while
still stopping at the next reverse-split anchor. This allows a complete ratio,
lifecycle, and effective-date clause to be assembled without permitting a
neighboring action to supply its date or ratio. A deterministic delayed-clause
regression confirms completed `1-for-10` on `2023-08-24` and the canonical
acceptance invariant.

This is an offline correction only. No historical calibration result or answer
key changed, and a fresh AMC-only live confirmation still requires separate
owner approval.
