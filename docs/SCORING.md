# Fast score methodology

**Current methodology:** 2.1.0

**Historical comparison baselines:** 2.0.0 and 1.0.0
**Last reviewed:** 2026-08-27

The server calculates scores deterministically after evidence retrieval. OpenAI
cannot author a score. Every numeric result is 0–10, links its evidence and
components, states its direction and horizon, and is a research aid rather than
advice, an outcome probability, or a combined verdict.

## Shared 2.1 rules

- Missing, stale, conflicting, identity-mismatched, partial, or discovery-only
  evidence is `Limited`/`Unscored`; it never becomes zero risk or good quality.
- Confirmed material inputs need SEC, exchange, issuer/company-filed,
  attributable original reporting, or another approved primary source. Alpha
  Vantage discovery cannot independently support a material score. Its EOD bars
  may supply market context, not issuer-event facts.
- Confidence is the weakest linked source confidence. Unscored results use
  unknown confidence. Conflicts prevent the affected component from scoring.
- Values are clamped to 0–10 and rounded to one decimal. The documented weights
  are fixed; changes to constructs, gates, thresholds, or weights require a new
  methodology version.
- Low/medium/high examples below describe evidence patterns, not recommendations.

Financial-score inputs have a stricter source boundary: Company Facts and
SEC-filed 10-K, 10-Q, 20-F, 40-F, 8-K, 6-K, and relevant exhibits only. Comparable
series prefer Company Facts and periodic reports. A later 8-K/6-K can make the
periodic picture stale or increase current risk, but an isolated value is not a
trend observation unless it states a compatible standardized period. Nasdaq is
listing context; Alpha Vantage is discovery/EOD market context. Neither can fill
a financial-statement gap. OpenAI may explain approved normalized evidence but
cannot author, invent, or backfill a score input.

## The seven primary Fast constructs

### Historical dilution severity

Direction/horizon: higher is more risk; actual dilution in the past three years.
The input is confirmed share-base growth from completed issuance, expressed as
`percent_of_shares` with `evidence_role: actual_issuance`. Registration capacity is tracked separately; warrants and
convertibles are not historical dilution until issuance is supported.

Minimum evidence is a bounded authoritative history plus quantified actual share
change. A genuinely bounded `not_found` result scores 0. Otherwise missing terms,
denominators, lineage, or classification stay Limited. Cumulative thresholds are
0%=0, >0–5%=2, >5–15%=4, >15–30%=6, >30–60%=8, and >60%=10.

- Low: bounded review finds no completed issuance, or actual growth is at most 5%.
- Medium: supported actual share growth is roughly 5–30%.
- High: supported actual share growth exceeds 30%.

### Future dilution likelihood

Direction/horizon: higher is more risk; financing pressure in the next twelve
months, not a percentage probability. Inputs and weights are liquidity/runway
(40%), available current mechanisms such as offerings, warrants, or convertibles
(25%), total-debt pressure (20%), and resolved actual dilution history (15%).

Current comparable cash, cash consumption, true FCF, total debt, going-concern
state, and resolved history are the minimum. Missing runway inputs or unresolved
history remain Limited rather than receiving favorable defaults. Registration
capacity can identify a mechanism but does not prove issuance.

- Low: ample supported runway, low leverage, no active mechanism, clean bounded history.
- Medium: shorter runway, moderate leverage, or a current financing mechanism.
- High: going-concern evidence, very short runway, high leverage, or convertible pressure.

### Potential dilution impact

Direction/horizon: higher is more risk; potential ownership impact in the next
twelve months. It requires supported potential-share terms and a current share
denominator, normalized as `percent_of_shares` and explicitly classified as
`potential_issuance` or `instrument_overhang`. Proceeds divided by cash and raw
instrument counts are prohibited proxies. The same percent thresholds as
historical severity apply. Missing denominator, exercise/conversion terms,
currency comparability, or conflicts make the score Limited.

- Low: supported potential issuance is at most 5% of the denominator.
- Medium: supported potential issuance is roughly 5–30%.
- High: supported potential issuance exceeds 30%.

### Reverse-split risk

Direction/horizon: higher is more risk; next twelve months. Confirmed five-year
corporate-action history is 45%; specific current exchange/listing pressure is
55%. No history scores 0; one event starts at 6 and additional events add 2,
capped at 10. Active compliance pressure scores 9 and a current halt scores 10.

The minimum is resolved split history, current security/listing identity, and a
bounded compliance review. Generic filing boilerplate about possible exchange
risk is not a deficiency. Unresolved listing status or lineage stays Limited.

- Low: active listing, no specific pressure, no confirmed split in-window.
- Medium: confirmed split history without current listing pressure.
- High: specific current deficiency/halt, especially with prior splits.

### Financial health

Direction/horizon: higher is better; latest comparable period and next twelve
months. Inputs are liquidity/runway (30%), total-debt capacity (20%), true FCF
(20%), profitability (15%), and material warnings (15%). A going-concern finding
caps the result at 2; another severe accounting/liquidity warning caps it at 3.

Minimum evidence is fresh, comparable cash, cash consumption, true FCF, total
debt, profitability, and resolved going-concern evidence with compatible units,
currency, and periods. OCF alone is never FCF; one debt component is never total
debt. Missing burn never implies unlimited runway. Stale, conflicting, partial,
or currency-mismatched inputs stay Limited.

- Low health: short supported runway, debt well above cash, negative FCF/losses, warnings.
- Medium health: mixed cash generation, leverage, and profitability.
- High health: supported runway, manageable total debt, positive FCF/profitability, no warning.

Financial Health retains the 2.0 construct and weights above. It does not average
or consume the six supporting trend scores, so there is no circular dependency.
The supporting rows add historical direction; Financial Health remains a current
resilience assessment. All score-affecting financial claims now also pass the
SEC-only source gate.

## Six supporting financial trend constructs added in 2.1.0

All six are higher-is-stronger, company-relative 0–10 scores. Raw company size
does not score. For revenue, net income/loss, FCF, and OCF, a newer pair of
same-length comparable interim periods takes precedence over an older annual
series; otherwise the server uses compatible annual history. Cash and debt
prefer fresh consecutive quarter-end balances, then compatible annual period
ends. Annual and interim observations never mix in one calculation.

Minimum evidence is two chronological observations with one definition, unit,
currency, cadence, issuer identity, and confirmed SEC-only claim chain. Two
periods cap confidence at low, three at medium, and four or more at high; the
weakest linked SEC source confidence can lower that cap.
Cash/debt and quarterly flows require the newest observation to be no more than
180 days old; an annual flow series may be at most 550 days old to accommodate
the normal annual filing cycle. One
point, a source conflict, stale balance, mixed currency/unit/cadence/concept,
identity mismatch, or any secondary-provider value makes the score Limited.
A later authoritative non-reliance/restatement event invalidates affected flow
series until corrected comparable statements are available. A severe control
warning remains visible and caps Financial Health even when unaffected trend
inputs are strong.

### Revenue trend and cash trend

For each transition, change is `(current - prior) / max(abs(prior), 10% of
abs(current), 1)`. The score is 55% average-change score + 30% latest-change
score + 15% share of non-negative transitions. Each change score is `clamp(5 +
20 × change, 0, 10)`. Revenue rewards sustained comparable sales growth; cash
rewards fresh stable/growing liquidity. Neither rewards absolute company size.

### Debt trend

Debt uses the same formula with the change sign reversed and counts
non-increasing transitions as consistent. Declining/stable total debt scores
higher and rapid growth lower. This is a trajectory construct, not an assertion
that all debt is bad; debt relative to cash and generation remains in Financial
Health.

### Net income/loss, free-cash-flow, and operating-cash-flow trends

Let `scale` be the largest absolute observation, floored at 1. Each score is 45%
latest sign/level (`clamp(5 + 5 × latest / scale)`), 40% first-to-latest
improvement (`clamp(5 + 5 × (latest - first) / scale)`), and 15% share of
improving transitions. This rewards positive/improving generation, shrinking
losses, and crossings into profit or positive cash flow; it penalizes worsening
losses and negative/deteriorating cash flow.

Individual rows remain compact. Their supported values, gaps, formulas, and SEC
sources roll up primarily under Financial Health details. Shares outstanding is
not a higher-is-stronger financial score and continues to support dilution and
capital-structure interpretation only.

### Catalyst strength

Direction/horizon: higher is better; the current catalyst only. Inputs are
potential significance (30%), specificity (25%), credibility (20%), novelty
(15%), and recency (10%); high/medium/low map to 9/6/2.

The event and every factor require identity-gated SEC, exchange, issuer, or
attributable original evidence. Discovery-only news, unsupported summaries, a
missing material term, or a primary-source conflict keeps the score Limited.
Historical catalyst analogues are deliberately Deep-only.

- Low: supported but routine, stale, nonspecific, or low-significance event.
- Medium: current credible event with moderate specificity/significance.
- High: current, specific, credible, novel, materially significant event.

### Near-term setup quality

Direction/horizon: higher is better; next five trading days, not a profit
prediction. Inputs are supported catalyst strength (60%), latest EOD price change
(20%), and latest volume versus a bounded prior-session baseline (20%). Price
bands map severe negative/negative/flat/positive/strong positive context to
1/3/5/7/9; relative volume maps <0.75/0.75–1.5/1.5–3/>=3 to 2/5/7/9.

Minimum evidence is a fully scored catalyst plus fresh Alpha Vantage or exchange
EOD price and relative-volume records. Provider failure, stale bars, insufficient
baseline history, or discovery-only catalyst evidence stays Limited. Historical
reaction analogues and profit forecasts are excluded from Fast.

- Low: weak supported catalyst with negative/low-participation context.
- Medium: moderate catalyst and ordinary price/volume context.
- High: strong supported catalyst with strong current participation.

## Deep-only long-term quality

The v4 report retains `long_term_company_quality` for compatibility, but
methodology 2.0 always leaves it Limited in Fast. Deep can research durable
business quality with broader history; Fast must not manufacture a multi-year
quality judgment from a bounded risk packet.

## Historical methodology 2.0.0 baseline

Version 2.0.0 is preserved as the immediate historical baseline. Its seven
primary constructs, gates, weights, and thresholds remain intact in 2.1.0,
while the financial source boundary becomes explicitly SEC-only. Version 2.0.0
did not emit six independent financial trend scores; the dashboard either
borrowed a Financial Health component or showed Unscored.

The checked-in ACME fixture illustrates the display change. Under 2.0, revenue,
cash, and OCF had no independent stars, while net income, debt, and FCF borrowed
overall-health components. Under 2.1, the same SEC histories independently score
revenue 7.1 (high confidence), net income/loss 10 (high), debt 4.0 (low, because
the fresh quarter-end pair rose slightly despite the older annual decline), FCF
10 (high), cash 9.2 (low), and OCF 10 (high). These are deterministic fixture
examples, not cross-company rankings or predictive validation.

## Historical methodology 1.0.0 baseline

Version 1.0.0 is preserved here for reproducible comparison, not execution by
the current endpoint. It counted offerings/warrants/convertibles with fixed
historical points; weighted future dilution 40/35/25 across history, cash-flow,
and debt/instruments; proxied potential impact with offering dollars versus cash;
weighted split history/listing pressure 65/35; used equal metric trends plus
financial adjustments; combined financial/dilution/compliance into long-term
quality; equally weighted five catalyst factors; and made setup depend 60/25/15
on catalyst, qualitative implication, and historical reactions.

The checked-in evaluation sample records the changed 1.0-to-2.0 outcomes. Most
notably, ACME's registration-style offering no longer produces historical or
potential dilution numbers, financial health moves from 9.1 to 7.4 under the
current-evidence formula, clean split risk moves from baseline 1 to 0, and
long-term quality becomes Deep-only. These are intentional construct corrections,
not evidence loss.

## Optional roll-ups and calibration limits

Normal reports emit no combined score. `buildScoreRollup` permits an explicit
equal-weight roll-up only for same-direction constructs and becomes null if any
component is unresolved. Token-free fixtures prove deterministic gates and
ordering; they do not establish predictive validity or the 95% material-risk
recall target. Issue #55 remains responsible for real-ticker calibration with
sample sizes and uncertainty disclosed.

### SEC filing-table FCF fallback (Issue #76)

When Company Facts does not expose a usable capital-expenditure concept, Fast
may inspect a bounded set of already-retrieved issuer 10-K, 10-Q, 20-F, or 40-F
HTML/iXBRL documents. The fallback accepts only an isolated capital-expenditure
row with explicit currency, scale, comparable period labels, and aligned values.
The filing is already identity/accession-gated by SEC retrieval; accounting
invalidity, non-reliance, stale periods, conflicting facts, unsupported forms,
or unit/cadence mismatches with operating cash flow keep FCF Limited/Unscored.
Operating cash flow alone is never treated as free cash flow. Accepted table
facts remain SEC-authoritative, dated, and source-linked to the FCF claim; the
fallback is intentionally bounded and does not add a parser dependency.

Qualifying explicit cash purchases of long-lived operating intangible assets
(for example, patents, trademarks, or other separately identified intangible
assets) may be included alongside property/equipment capex. The normalizer
preserves the asset subtype and source provenance, aggregates distinct
qualifying rows for the same comparable period, and computes
`FCF = OCF − |property/equipment capex| − |qualifying intangible purchases|`.
Business acquisitions, non-cash transactions, vague investing outflows, and
rows whose units, periods, currency, or accounting validity cannot be aligned
remain excluded and settle Limited/Unscored.

The bounded extractor also accepts multiple qualifying rows plus unit and scale
notes immediately adjacent to the selected table (including `US$ in millions`)
while stopping at neighboring
table boundaries. This addresses common SEC presentation variation without
borrowing units, periods, or values from unrelated tables. A table still must
provide one or more isolated qualifying capex rows and aligned comparable
periods; otherwise FCF remains Limited/Unscored.

### Fast calibration contract (Issue #77)

The deterministic matrix in `evaluation/plans/fast-score-calibration-2026-08-31.json`
exercises every Methodology 2.1.0 component. It checks direction, horizon,
0–10 range, dated claim/source links, and that Limited, Unscored,
Researching, and not-applicable states never carry fake numbers. Confirmed
financial trend explanations name the normalized SEC values and period ends
used by the formula. Synthetic holdouts check company-relative trajectories
and risk ordering; this is a consistency gate, not a predictive-accuracy claim
or a replacement for frozen Issue #55 results.
