# Task 001 code review

Review scope: the four task 001 commits against their starting revisions recorded in [the runbook](ra-622-spike-runbook.md). The originating requirements are task 001 and its parent spike spec; later tasks are excluded. Standards and spec were reviewed by separate agents.

## Standards

No actionable Standards findings across the four repository diffs.

The frontend follows its documented Hapi plugin/controller pattern, uses the existing authenticated API client and organisation guard, applies `requireOperator` as required by `docs/authentication.md`, supplies English/Welsh translations, and adds test IDs to the new interactive elements. The backend uses existing configuration, adapter and frontend-authentication conventions.

No baseline smell warrants a change within this narrow spike. The repeated browser configuration occurs in independently runnable repositories; introducing shared infrastructure would expand the task unnecessarily. Tooling-enforced formatting findings were excluded.

## Spec

One P2 finding: optional demo failures blocked existing navigation in `src/server/operator/controller.js`. Task 001 requires: “Existing unrelated operator navigation remains usable.” With the spike enabled, a failed target read or organisation lookup replaced the landing page with a 404/503 and removed unrelated navigation.

Resolved: catch and log failures around the optional demo section, render the ordinary landing page without its link, and retain strict failures on the summary/proposal routes. Focused public-route tests exercise missing targets, unavailable backends and failed organisation lookups. Each failed before the fix and passed afterward.

No other actionable spec findings across the four task 001 diffs. The review also prompted an opt-in guard for both browser specs so ordinary suites skip the disabled demo; focused configurations enable them explicitly.

Standards: 0 findings. Spec: 1 finding, resolved; 0 outstanding. The spec finding concerned landing-page availability.
