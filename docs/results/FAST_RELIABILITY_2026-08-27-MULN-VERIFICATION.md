# Issue #55 MULN-only verification — 2026-08-27

The one approved process was started once and was not retried. It terminated
before returning a report because the dedicated one-case runner omitted the
event-loop keep-alive handle used by the established batch runner. Node reported
an unsettled top-level await at `researchTicker` and exited before the runner
could persist provider telemetry or corporate-action diagnostics.

No report was received, so the live MULN corporate-action fix is neither passed
nor failed by this run. Known OpenAI cost is zero; optional-provider usage is
unknown and is not represented as zero. Historical artifacts and frozen answer
keys remain unchanged.

The runner now includes the established keep-alive guard, but the consumed
approval is not reused. Another process requires new explicit owner approval
after token-free runner lifecycle coverage. Issue #55 and PR #74 remain open.
