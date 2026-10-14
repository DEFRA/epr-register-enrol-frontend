# Task 003: Assess and refuse a change request

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

High

## What to build

A caseworker starts assessment from the Add ORS summary and refuses the request. The real management outcome closes the correct operator request without adding a site. Its history remains visible and Change permits a new request. This establishes the assessment and decision/callback path used by the approval slice.

## Acceptance criteria

- [x] Start assessment progresses Submitted to Assessment through the existing engine with audit/state/version guards; no payment, duly-making, SLA or assessment checklist is required.
- [x] Refuse is available in assessment and uses a module-owned decision service. The generic action endpoint cannot bypass required outcome behaviour. Approval remains unavailable until task 004.
- [x] The real authenticated management callback is correlated to the request, case and target and records Refused in the operator request. Existing public status/read transport exposes current case state as needed; no new polling platform is introduced.
- [x] Confirmed refusal atomically closes the operator request and releases the active slot. The summary retains terminal history, restores Change and leaves all approved sites and Granted accreditation details unchanged.
- [x] A subsequent explicit submission creates a distinct request, proposed-site and case identity using the same prepared details. Old callbacks remain attached to the old request and cannot close the new request.
- [x] Failed outcome delivery is observable and does not falsely close the operator request. Reuse acknowledgement/retry behaviour or provide the smallest explicit retry of the same recorded decision; no background reconciliation framework is required.
- [x] Public checks cover out-of-order actions, terminal mutation, mismatched/conflicting outcomes and harmless replay. Existing organisation/caseworker/support permissions are retained.
- [x] Connected checks in the existing browser suites show assessment, actual refusal readback, unchanged sites, retained history and a new submission after closure. Relevant shared transport/action regressions pass.

## Blocked by

- `.tasks/002-AFK-High-submit-and-review-add-ors-case.md`

## Completion notes

Completed task 003 across the six existing repositories on `feature/ra-622-spike`. Module-owned protected assessment/refusal operations use the existing engine and stored v1 snapshot. Management records refusal before attempting its signed callback, exposes delivery acknowledgement and offers explicit retry of that same decision. Generic transitions and approval remain unavailable. The operator checks exact request/case/site/target correlation, atomically closes the matching request, retains its history and reads current management state without treating an unconfirmed outcome as received. Granted and approved sites remain unchanged, and new explicit submissions have distinct request/site/case identities.

Validation: operator frontend 2,632 tests, operator backend 1,629 tests, management backend 2,126 tests and management frontend 2,120 tests passed; nine opt-in external backend checks were skipped. Both frontend coverage thresholds passed. The connected browser sequence passed submission, management list/detail/assessment/actual callback, operator refusal history/readback/new submission and management readback of the new case. Builds, relevant lint/formatting and configured audits passed. The Windows test-cache/setup and browser-timeout retries, exact identities and revisions are recorded in `docs/ra-622-spike-runbook.md`. The independent Standards and Spec reviews have no outstanding findings; see `docs/ra-622-task003-review.md`.

No blockers. Task 004 is next and has not been started. Approval, withdrawal and the final restart-durability proof remain in their later tasks. Outcome recovery deliberately uses the explicit refusal retry; no background reconciliation was added. All commits are local; no push.
