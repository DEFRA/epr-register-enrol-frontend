# Task 004: Approve and repeat ORS additions

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

High

## What to build

Approve an assessed request and display its ORS alongside the fixed accreditation's baseline sites. Then start and approve another request containing the same predefined details. Both approved additions remain visible, enabling repeated demos without resetting data.

## Acceptance criteria

- [x] Approve is available only in assessment and extends the module-owned decision path from task 003, with engine/audit/version guards and actual operator outcome delivery.
- [x] Confirmed approval closes the request, releases its active slot, records the terminal history and restores Change. Unconfirmed delivery retains the active slot and is observably retryable.
- [x] The fixed summary reconstructs approved sites from the unchanged ReEx baseline plus one entry per approved request. Refused, withdrawn and pending proposals contribute no site.
- [x] Each request has a stable distinct proposed-site identity. Two separately approved requests with identical prepared site details contribute two separate entries; retries/replays for either request contribute no additional entry.
- [x] Baseline sites, earlier approved additions, accreditation identity, Granted status and unrelated data are preserved. No ReEx mutation, mutable registry copy or next-year application amendment is added.
- [x] Connected browser checks approve twice through real management decisions without clearing data, verify different request/case/site identities, and compare the site-count increase against the starting view so retained earlier runs are valid.
- [x] Focused public API checks verify repeat delivery, wrong correlation and unchanged earlier requests/sites. Record the repeatable-site behaviour as a local demo assumption, with production duplicate-site policy deferred.

## Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`

## Completion notes

Completed task 004 across the six repositories on `feature/ra-622-spike`. Approval extends the existing module-owned decision service, stored v1 workflow, audit/state/version guards and authenticated callback. Failed delivery retains the request slot and offers retry of the same recorded decision. Confirmed approval atomically records terminal history, releases the slot and restores Change. The summary combines unchanged ReEx baseline sites with one projected addition per approved request, using its stable site identity. Identical prepared details in separate requests remain distinct; replay adds nothing and cannot alter earlier requests or a later active attempt. Production duplicate-site policy is explicitly deferred as a local demo assumption.

Validation: all four full suites passed (operator frontend 2,634; operator backend 1,630; management frontend 2,127; management backend 2,127 with nine external checks skipped). Both frontend coverage thresholds passed. Relevant builds, lint, formatting and audits passed. The connected five-phase browser sequence approved twice through real management decisions, preserved earlier refusals/history and the four-site baseline, and showed six sites, distinct request/case/site identities and restored Change. The runbook records exact identities, launch corrections, commands and evidence; the independent Standards and Spec reviews have no outstanding findings.

No blockers. Task 005 is next and has not been started. Withdrawal and the complete restart-durability proof remain in their later tasks. No ReEx mutation or next-year application amendment was added. All commits are local; no push.
