# Task 002: Submit and review an Add ORS case

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

High

## What to build

Submit the prepared proposal as a separately persisted change request and find the actual resulting Add ORS case in management. The operator sees its active request and correlation while the accreditation remains Granted. This is the first complete crossing into the new case type.

## Acceptance criteria

- [ ] Protected submission creates a minimal versioned operator request with stable request/site identities, exact target, baseline/proposal and active marker before calling management. Viewing the proposal remains read-only.
- [ ] A database constraint or equivalent atomic operation enforces at most one active request per exact target. Another start resumes/reports that request; hiding Change alone is insufficient. Unsupported targets cannot start requests.
- [ ] Real authenticated/signed ingestion creates one `add-overseas-site` work item linked to the operator request and target. Repeat submission retains the same request, proposed-site and case identities, including recovery when a receipt is retried. Unconfirmed submission keeps the active slot reserved.
- [ ] Independent management frontend/backend modules register Add ORS using existing work-item persistence and template snapshots. Modules have no dependency on re-accreditation; only shared assumptions required for this crossing are adapted.
- [ ] The case appears alongside existing types in the existing management list. The Application type filter includes Add ORS and selecting it returns only this type.
- [ ] A minimal versioned detail page displays target identity, predefined proposal, request/case correlation and state. Later workflow operations are withheld until their supporting task is implemented.
- [ ] The operator summary shows the persisted active request, hides another Change action while it is active, and retains Granted status and unchanged approved sites through refresh.
- [ ] Both existing browser-test repositories verify actual submission and received case list/filter/detail. Focused public API tests cover simultaneous starts, repeated submission, fixed-target eligibility and existing access boundaries.
- [ ] Relevant existing re-accreditation submission/list/template checks remain passing. No ORS wizard, fee, evidence or declaration requirements are introduced.

## Blocked by

- `.tasks/001-AFK-Medium-open-fixed-accreditation-and-prepared-change.md`
