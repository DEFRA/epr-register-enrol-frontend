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

- [ ] Approve is available only in assessment and extends the module-owned decision path from task 003, with engine/audit/version guards and actual operator outcome delivery.
- [ ] Confirmed approval closes the request, releases its active slot, records the terminal history and restores Change. Unconfirmed delivery retains the active slot and is observably retryable.
- [ ] The fixed summary reconstructs approved sites from the unchanged ReEx baseline plus one entry per approved request. Refused, withdrawn and pending proposals contribute no site.
- [ ] Each request has a stable distinct proposed-site identity. Two separately approved requests with identical prepared site details contribute two separate entries; retries/replays for either request contribute no additional entry.
- [ ] Baseline sites, earlier approved additions, accreditation identity, Granted status and unrelated data are preserved. No ReEx mutation, mutable registry copy or next-year application amendment is added.
- [ ] Connected browser checks approve twice through real management decisions without clearing data, verify different request/case/site identities, and compare the site-count increase against the starting view so retained earlier runs are valid.
- [ ] Focused public API checks verify repeat delivery, wrong correlation and unchanged earlier requests/sites. Record the repeatable-site behaviour as a local demo assumption, with production duplicate-site policy deferred.

## Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`
