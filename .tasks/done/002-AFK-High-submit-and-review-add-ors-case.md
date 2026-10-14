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

- [x] Protected submission creates a minimal versioned operator request with stable request/site identities, exact target, baseline/proposal and active marker before calling management. Viewing the proposal remains read-only.
- [x] A database constraint or equivalent atomic operation enforces at most one active request per exact target. Another start resumes/reports that request; hiding Change alone is insufficient. Unsupported targets cannot start requests.
- [x] Real authenticated/signed ingestion creates one `add-overseas-site` work item linked to the operator request and target. Repeat submission retains the same request, proposed-site and case identities, including recovery when a receipt is retried. Unconfirmed submission keeps the active slot reserved.
- [x] Independent management frontend/backend modules register Add ORS using existing work-item persistence and template snapshots. Modules have no dependency on re-accreditation; only shared assumptions required for this crossing are adapted.
- [x] The case appears alongside existing types in the existing management list. The Application type filter includes Add ORS and selecting it returns only this type.
- [x] A minimal versioned detail page displays target identity, predefined proposal, request/case correlation and state. Later workflow operations are withheld until their supporting task is implemented.
- [x] The operator summary shows the persisted active request, hides another Change action while it is active, and retains Granted status and unchanged approved sites through refresh.
- [x] Both existing browser-test repositories verify actual submission and received case list/filter/detail. Focused public API tests cover simultaneous starts, repeated submission, fixed-target eligibility and existing access boundaries.
- [x] Relevant existing re-accreditation submission/list/template checks remain passing. No ORS wizard, fee, evidence or declaration requirements are introduced.

## Blocked by

- `.tasks/001-AFK-Medium-open-fixed-accreditation-and-prepared-change.md`

## Completion notes

Completed task 002 across all six existing repositories on `feature/ra-622-spike`. The protected operator submission persists a schema-v1 request and stable proposed-site identity before signed management ingestion. A partial unique MongoDB target index reserves one active request; management's separate request-identity index handles concurrent/repeated ingestion. Unconfirmed receipts keep the slot reserved and offer retry. The Add ORS modules have no re-accreditation dependency, use existing work-item snapshots/persistence, and expose list/filter/detail without later operations. The operator summary retains Granted and its unchanged approved sites through refresh.

Validation: operator frontend 2,628 tests and backend 1,627 tests passed; management frontend 2,108 tests passed with coverage thresholds met. Management backend's full run passed 2,124 tests and skipped nine opt-in external checks; one existing temporary-MongoDB startup timed out, then passed in the 77-test focused retry group alongside Add ORS and persistence checks. Both real connected browser checks passed using actual request/site/case identities, with no fabricated receipt. Build, lint and configured security-audit checks passed; management repositories retain documented pre-existing repository-wide formatting limitations, with changed files passing focused formatting.

The two independent code reviews have no outstanding findings. Exact configuration, test evidence, identities, limitations and supporting commits are recorded in `docs/ra-622-spike-runbook.md`; review findings and resolutions are in `docs/ra-622-task002-review.md`.

Task 003 remains pending. Assessment, decisions, withdrawal, callbacks and approval projection are not implemented by task 002. The v1 snapshot declares their states/transitions but keeps all actions non-caller-invocable until their owning module operations are implemented. No remote push is part of this session.
