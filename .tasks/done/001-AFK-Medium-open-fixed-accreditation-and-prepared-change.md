# Task 001: Open the fixed accreditation and prepared change

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

Medium

## What to build

Run the four real services together using the smallest local configuration. From a new operator landing-page section, open one fixed granted accreditation summary and follow Change to its prepared ORS proposal. This task establishes the entry and exact target read without creating a request or submitting a case.

## Acceptance criteria

- [x] The four application services start using existing configuration mechanisms, correct service/callback URLs and distinct frontend session cookies. The two backends select separate spike databases on existing MongoDB; prior feature-demo data is retained.
- [x] Existing stub sign-ins and unchanged ReEx development fixtures are used. Frontend-to-backend calls are real; real notifications are disabled and upload/storage infrastructure is unnecessary.
- [x] A new operator landing-page section links to exactly one explicitly configured accreditation; its summary shows the correct organisation, registration, accreditation, year/material, Granted status and baseline sites.
- [x] Only the fixed target offers the spike Change link. Other granted accreditations gain no Change action, and the backend read/eligibility boundary cannot resolve an unsupported target as an eligible spike target.
- [x] Change opens the predefined ORS proposal directly, with no editable capture, evidence, declaration or change-type selection. Submission is not advertised as operational until task 002.
- [x] Viewing or refreshing the landing, summary or proposal neither seeds a re-accreditation application nor creates a request. Existing unrelated operator navigation remains usable.
- [x] A focused connected operator browser check and public backend/route checks cover target identity, baseline read, protected access and absence of creation side effects. The management service/list can be reached using its normal sign-in.
- [x] A short runbook records launch commands, target identifiers and isolated database configuration. No new orchestration platform or complete re-accreditation acceptance replay is introduced.

## Blocked by

None — can start immediately.

## Completion notes

Completed task 001 across the operator frontend/backend and the two existing browser-test repositories. The management application code and ReEx fixtures are unchanged. The new entry and proposal use authenticated reads, fixed-target eligibility and existing organisation ownership, with no request/application creation or submission action.

Validation: operator backend 1,619 tests passed; final operator frontend suite 2,623 tests passed with coverage thresholds met; both connected browser checks passed; all four readiness endpoints returned 200. Launch commands, target identifiers, isolated databases, starting revisions and limitations are recorded in docs/ra-622-spike-runbook.md. The two-axis code review has no outstanding findings; its navigation finding was resolved and retested. Both browser specs skip ordinary runs and pass when opted in.

Task 002 remains pending. This task does not implement protected submission, request persistence or the Add ORS management module.

Check limitation: full lint/formatting in the management browser repository fails on existing Windows single-quoted glob and CRLF issues; the changed files pass focused lint and formatting. Its connected browser check and security audit pass.
