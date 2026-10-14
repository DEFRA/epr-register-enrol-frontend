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

- [ ] Withdraw request is offered only while the management case is Submitted, using existing status/read transport to establish current eligibility. No elaborate reason wizard is introduced.
- [ ] A protected operator operation calls the real correlated management case using existing authenticated transport. The module-owned management service enforces current state/version/access rules and records Withdrawn with audit.
- [ ] Only confirmed closure records Withdrawn in the operator request and atomically releases its active slot. Failed/unconfirmed/rejected delivery leaves it active and visibly recoverable through the smallest existing or explicit retry.
- [ ] The fixed summary preserves Granted status, baseline sites and any earlier approved additions, retains the withdrawn attempt and restores Change.
- [ ] A subsequent submission creates new request/case/site identities. Replaying the old withdrawal is harmless and cannot close that new request.
- [ ] Withdrawal is absent after assessment starts, and a stale or forged operator action is rejected by management without closing the operator request or releasing its slot. Terminal cases cannot be withdrawn.
- [ ] Connected checks demonstrate actual management closure, operator readback and a new request after withdrawal. Focused public API checks cover correlation, replay and state/version guards without a comprehensive timing matrix.
- [ ] The slice introduces no withdrawal from assessment/query, query journey, payment/SLA behaviour or effects on re-accreditation.

## Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`
