# Issue #55 FCF offline correction (2026-08-31)

The frozen same-five confirmation remains unchanged at 3/5 for free cash flow.
This note records a prospective deterministic correction and does not remeasure
that live result.

## Finding

The Fast SEC normalizer selected operating cash flow and capital expenditures
independently. It required those two selected facts to have the same start and
end dates before calculating free cash flow. SEC Company Facts can expose a
shorter quarterly OCF alongside a YTD capex fact ending on the same date. In
that shape, a valid aligned YTD pair was discarded and FCF became Unknown even
though both authoritative inputs were available for a comparable period.

The existing safety rule is preserved: OCF alone never becomes FCF, and a
missing, conflicting, stale, or currency-mismatched capex input remains
Limited/Unknown.

## Correction

FCF now selects the newest identity-, unit-, and period-aligned OCF/capex pair
from SEC Company Facts. Periods at the same end date are ordered by shortest
duration first, so quarter, YTD, and annual observations remain distinct and a
valid cadence is selected deterministically. Comparable FCF observations still
require matching periods and use the same cadence filter; stale values continue
to settle Limited.

## Deterministic coverage

The regression suite now covers a quarter-vs-YTD latest-duration collision: a
valid current YTD OCF/capex pair is selected and calculated while the visible
OCF metric retains its independently selected quarter. Existing tests continue
to prove that OCF-only and currency-mismatched inputs do not produce FCF.

This correction is offline-only. No SEC, provider, OpenAI, or live calibration
request was made, and all historical calibration artifacts and answer keys are
unchanged. A separate owner-approved live remeasurement is required to learn
whether AMC/NXL now have aligned authoritative capex in the current SEC path.
