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

- [ ] Start assessment progresses Submitted to Assessment through the existing engine with audit/state/version guards; no payment, duly-making, SLA or assessment checklist is required.
- [ ] Refuse is available in assessment and uses a module-owned decision service. The generic action endpoint cannot bypass required outcome behaviour. Approval remains unavailable until task 004.
- [ ] The real authenticated management callback is correlated to the request, case and target and records Refused in the operator request. Existing public status/read transport exposes current case state as needed; no new polling platform is introduced.
- [ ] Confirmed refusal atomically closes the operator request and releases the active slot. The summary retains terminal history, restores Change and leaves all approved sites and Granted accreditation details unchanged.
- [ ] A subsequent explicit submission creates a distinct request, proposed-site and case identity using the same prepared details. Old callbacks remain attached to the old request and cannot close the new request.
- [ ] Failed outcome delivery is observable and does not falsely close the operator request. Reuse acknowledgement/retry behaviour or provide the smallest explicit retry of the same recorded decision; no background reconciliation framework is required.
- [ ] Public checks cover out-of-order actions, terminal mutation, mismatched/conflicting outcomes and harmless replay. Existing organisation/caseworker/support permissions are retained.
- [ ] Connected checks in the existing browser suites show assessment, actual refusal readback, unchanged sites, retained history and a new submission after closure. Relevant shared transport/action regressions pass.

## Blocked by

- `.tasks/002-AFK-High-submit-and-review-add-ors-case.md`
