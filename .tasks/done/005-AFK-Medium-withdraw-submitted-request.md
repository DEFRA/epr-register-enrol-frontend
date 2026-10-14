# Task 005: Withdraw a submitted request

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

Medium

## What to build

The operator withdraws a request while its management case is Submitted. Withdrawal closes the real linked case and operator request, retains history and restores Change so another request can be submitted. Assessment removes withdrawal eligibility.

## Acceptance criteria

- [x] Withdraw request is offered only while the management case is Submitted, using existing status/read transport to establish current eligibility. No elaborate reason wizard is introduced.
- [x] A protected operator operation calls the real correlated management case using existing authenticated transport. The module-owned management service enforces current state/version/access rules and records Withdrawn with audit.
- [x] Only confirmed closure records Withdrawn in the operator request and atomically releases its active slot. Failed/unconfirmed/rejected delivery leaves it active and visibly recoverable through the smallest existing or explicit retry.
- [x] The fixed summary preserves Granted status, baseline sites and any earlier approved additions, retains the withdrawn attempt and restores Change.
- [x] A subsequent submission creates new request/case/site identities. Replaying the old withdrawal is harmless and cannot close that new request.
- [x] Withdrawal is absent after assessment starts, and a stale or forged operator action is rejected by management without closing the operator request or releasing its slot. Terminal cases cannot be withdrawn.
- [x] Connected checks demonstrate actual management closure, operator readback and a new request after withdrawal. Focused public API checks cover correlation, replay and state/version guards without a comprehensive timing matrix.
- [x] The slice introduces no withdrawal from assessment/query, query journey, payment/SLA behaviour or effects on re-accreditation.

## Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`

## Completion notes

Completed task 005 across the six repositories on `feature/ra-622-spike`. The protected operator form identifies the displayed request and uses existing signed transport to its real correlated management case. The independent module withdrawal operation enforces organisation/request/site/target correlation and uses the existing frozen workflow, audit and optimistic concurrency guard. Only its confirmed Withdrawn response atomically closes the operator request and releases the slot. Lost or mismatched responses retain a durable pending marker and an explicit retry of the same withdrawal. Assessment and decided cases reject withdrawal, and replay cannot affect a later attempt.

Connected execution exposed the existing five-candidate reference limit for repeated same-target cases. A public six-request regression reproduced it. Newly generated change-case references now include the full stable request GUID; existing re-accreditation inputs and persisted references are unchanged. This narrow shared correction permits the required subsequent submission on retained data.

Validation: all four full suites passed (operator frontend 2,651; operator backend 1,631; management frontend 2,128; management backend 2,129 with nine opt-in external checks skipped). Both frontend coverage gates passed. Relevant formatting, lint, build and operator audit checks passed. The successful connected browser sequence withdrew the actual case, verified operator history and restored Change, submitted new request/case/site identities, replayed the old withdrawal harmlessly and verified both actual management cases. All six starting approved-site entries remain, including both earlier approvals. The runbook records identities, commands, failed attempts and their fixes. Independent Standards and Spec reviews, including the reference correction, have no outstanding findings.

No blockers. Task 006 remains next and has not been started. The retained demo has two Refused, two Granted and two Withdrawn attempts, with one new Submitted request; the baseline and two approved additions remain unchanged. Combined-flow, all-service restart and v1/v2 proofs remain for task 006. Recovery remains an explicit retry. All commits are local; no push.
