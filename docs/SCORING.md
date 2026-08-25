# Score methodology

**Methodology version:** 1.0.0  
**Last reviewed:** 2026-08-25

Scores are deterministic summaries of the validated report evidence. The server
replaces provider-authored score values before final validation and response.
Every score retains its inputs, weights, evidence state, confidence, time
horizon, explanation, and claim links. Scores are research aids—not outcome
probabilities, price forecasts, or trade instructions.

## Shared rules

- All components use 0–10. Risk scores use `higher_is_more_risk`; quality scores
  use `higher_is_better`.
- Only sufficient, confirmed inputs produce a number. A required unknown,
  limited, or inapplicable input produces a null score with the corresponding
  state; it never becomes zero risk or favorable quality.
- Final values are clamped to 0–10 and rounded to one decimal. Weighted means
  divide by the included positive weights.
- Score confidence is the weakest confidence among linked sources: any low
  source yields low; otherwise any medium/unknown source yields medium; all-high
  sources yield high. Unscored results use unknown confidence.
- `not_found` can support a numeric component only when it represents a sourced,
  bounded search. It never proves lifetime absence.

## Constructs and inputs

| Score | Direction and horizon | Reproducible inputs |
|---|---|---|
| Historical dilution severity | More risk; past 3 years | Offering 2 points, warrant 1, convertible 2, other dilution 1; sum capped at 10. Bounded not-found is 0. |
| Future dilution likelihood | More risk; next 12 months | 40% historical severity, 35% cash-flow pressure, 25% debt/instrument pressure. This is a relative evidence score, not a percentage probability. |
| Potential dilution impact | More risk; next 12 months | 75% documented offering value relative to cash, 25% confirmed warrant/convertible overhang. It is not an ownership-dilution percentage. |
| Reverse-split risk | More risk; next 12 months | 65% five-year split history, 35% current listing pressure. A bounded no-split result retains a baseline of 1. |
| Financial health | Better; latest period/next 12 months | Equal-weight metric trends, then fixed adjustments for positive profitability/free cash flow, debt above cash, and going-concern evidence. |
| Long-term company quality | Better; multi-year | 60% financial health, 20% dilution resilience, 20% compliance quality. Catalyst/setup inputs are excluded. |
| Catalyst strength | Better; current catalyst | Equal 20% weights for recency, specificity, credibility, novelty, and potential significance. High/medium/low map to 9/6/2. Any unresolved factor leaves the score null. |
| Near-term setup quality | Better; next 5 trading days | 60% catalyst strength, 25% qualitative implication, 15% bounded issuer reactions. Long-term company quality is excluded. Missing analogue evidence leaves the score null rather than predicting a reaction. |

The source of truth for executable details is `lib/scoring.js`. Any formula,
threshold, required-input, or meaning change requires a methodology version and
contract review.

## Optional roll-ups

No roll-up is emitted in the normal report because unlike directions and time
horizons can conceal tradeoffs. `buildScoreRollup` supports an explicit optional
equal-weight summary only for components with the same direction. It always
returns every component score and confidence. One unresolved component makes
the roll-up null and limited coverage; opposite directions are rejected.

## Token-free calibration findings

`npm run evaluate:dry` compares the checked-in ACME and XYZ fixture scores with
methodology 1.0.0 expectations. It reports overall and category-level score-check
pass rates alongside material-risk recall. The 2026-08-25 calibration contains
13 score checks across dilution, reverse splits, financial context, and
catalysts; all pass. ACME's unresolved catalyst significance correctly leaves
catalyst strength and near-term setup unscored, while XYZ's incomplete evidence
produces only unknown or limited-coverage scores.

These results establish deterministic behavior, not predictive validity. The
fixtures are synthetic, potential dilution uses cash as a context proxy rather
than an ownership percentage, historical reactions are sparse, and no approved
live outcome study has been run. Calibration should therefore be revisited with
dated evidence and owner approval before changing thresholds or claiming
predictive performance.
