# RA-622 spike: Approved task breakdown

Status: approved by the user; all seven numbered task files are published in the parent task directory. This document is retained as the approved planning record, outside the executable task frontier.

Parent specification: `.tasks/ra-622-spike.spec.md`.

All work uses `feature/ra-622-spike` in the four application repositories and two existing browser-test repositories. Preserve all `feature/ra-622` branches. Each implementation task includes focused checks of its own observable behaviour; final verification joins the completed paths rather than deferring all testing until the end.

AFK means implementation can proceed from the agreed specification without another product decision. HITL means the user reviews and accepts the resulting demo and approach.

## Approved breakdown

| Task | Title                                            | Type | Complexity | Blocked by | What it delivers                                                                                                                                    |
| ---- | ------------------------------------------------ | ---- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001  | Open the fixed accreditation and prepared change | AFK  | Medium     | None       | Run the four services locally; open the fixed Granted summary from the operator landing page and follow Change to the predefined ORS.               |
| 002  | Submit and review an Add ORS case                | AFK  | High       | 001        | Submit one persisted request, enforce one active request, and find its real case in the existing management list, Add ORS filter and detail page.   |
| 003  | Assess and refuse a change request               | AFK  | High       | 002        | Start assessment, refuse through a real outcome callback, retain history and raise a new request without adding an approved site.                   |
| 004  | Approve and repeat ORS additions                 | AFK  | High       | 003        | Approve a request, display its ORS on the fixed summary, then approve the same predefined details in another new request without resetting data.    |
| 005  | Withdraw a submitted request                     | AFK  | Medium     | 003        | Withdraw before assessment, close the actual management case, retain history and start another request; prevent withdrawal after assessment begins. |
| 006  | Prove the complete flow and record the approach  | AFK  | High       | 004, 005   | Join all paths, demonstrate restart persistence and workflow versioning, and document the proven design, limitations and follow-on delivery scope.  |
| 007  | Review and accept the spike demo                 | HITL | Low        | 006        | Walk through the running demo and review the technical conclusions and remaining feature work.                                                      |

Task 003 establishes assessment and the first terminal-decision/callback service. Task 004 extends that established path with approval effects. Task 005 needs submitted cases and assessment eligibility, so it depends on 003 but does not depend on approval. Implement one available task at a time; the graph does not require parallel agents.

No separate speculative prefactoring task is proposed. Any concrete shared-code extraction is made at the beginning of the slice that proves it necessary, with existing contracts retained.

## Published 001: Open the fixed accreditation and prepared change

Published filename: `.tasks/001-AFK-Medium-open-fixed-accreditation-and-prepared-change.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

Medium

### What to build

Run the four real services together using the smallest local configuration. From a new operator landing-page section, open one fixed granted accreditation summary and follow Change to its prepared ORS proposal. This task establishes the entry and exact target read without creating a request or submitting a case.

### Acceptance criteria

- [ ] The four application services start using existing configuration mechanisms, correct service/callback URLs and distinct frontend session cookies. The two backends select separate spike databases on existing MongoDB; prior feature-demo data is retained.
- [ ] Existing stub sign-ins and unchanged ReEx development fixtures are used. Frontend-to-backend calls are real; real notifications are disabled and upload/storage infrastructure is unnecessary.
- [ ] A new operator landing-page section links to exactly one explicitly configured accreditation; its summary shows the correct organisation, registration, accreditation, year/material, Granted status and baseline sites.
- [ ] Only the fixed target offers the spike Change link. Other granted accreditations gain no Change action, and the backend read/eligibility boundary cannot resolve an unsupported target as an eligible spike target.
- [ ] Change opens the predefined ORS proposal directly, with no editable capture, evidence, declaration or change-type selection. Submission is not advertised as operational until task 002.
- [ ] Viewing or refreshing the landing, summary or proposal neither seeds a re-accreditation application nor creates a request. Existing unrelated operator navigation remains usable.
- [ ] A focused connected operator browser check and public backend/route checks cover target identity, baseline read, protected access and absence of creation side effects. The management service/list can be reached using its normal sign-in.
- [ ] A short runbook records launch commands, target identifiers and isolated database configuration. No new orchestration platform or complete re-accreditation acceptance replay is introduced.

### Blocked by

None — can start immediately.

## Published 002: Submit and review an Add ORS case

Published filename: `.tasks/002-AFK-High-submit-and-review-add-ors-case.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

High

### What to build

Submit the prepared proposal as a separately persisted change request and find the actual resulting Add ORS case in management. The operator sees its active request and correlation while the accreditation remains Granted. This is the first complete crossing into the new case type.

### Acceptance criteria

- [ ] Protected submission creates a minimal versioned operator request with stable request/site identities, exact target, baseline/proposal and active marker before calling management. Viewing the proposal remains read-only.
- [ ] A database constraint or equivalent atomic operation enforces at most one active request per exact target. Another start resumes/reports that request; hiding Change alone is insufficient. Unsupported targets cannot start requests.
- [ ] Real authenticated/signed ingestion creates one `add-overseas-site` work item linked to the operator request and target. Repeat submission retains the same request, proposed-site and case identities, including recovery when a receipt is retried. Unconfirmed submission keeps the active slot reserved.
- [ ] Independent management frontend/backend modules register Add ORS using existing work-item persistence and template snapshots. Modules have no dependency on re-accreditation; only shared assumptions required for this crossing are adapted.
- [ ] The case appears alongside existing types in the existing management list. The Application type filter includes Add ORS and selecting it returns only this type.
- [ ] A minimal versioned detail page displays target identity, predefined proposal, request/case correlation and state. Later workflow operations are withheld until their supporting task is implemented.
- [ ] The operator summary shows the persisted active request, hides another Change action while it is active, and retains Granted status and unchanged approved sites through refresh.
- [ ] Both existing browser-test repositories verify actual submission and received case list/filter/detail. Focused public API tests cover simultaneous starts, repeated submission, fixed-target eligibility and existing access boundaries.
- [ ] Relevant existing re-accreditation submission/list/template checks remain passing. No ORS wizard, fee, evidence or declaration requirements are introduced.

### Blocked by

- `.tasks/001-AFK-Medium-open-fixed-accreditation-and-prepared-change.md`

## Published 003: Assess and refuse a change request

Published filename: `.tasks/003-AFK-High-assess-and-refuse-change-request.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

High

### What to build

A caseworker starts assessment from the Add ORS summary and refuses the request. The real management outcome closes the correct operator request without adding a site. Its history remains visible and Change permits a new request. This establishes the assessment and decision/callback path used by the approval slice.

### Acceptance criteria

- [ ] Start assessment progresses Submitted to Assessment through the existing engine with audit/state/version guards; no payment, duly-making, SLA or assessment checklist is required.
- [ ] Refuse is available in assessment and uses a module-owned decision service. The generic action endpoint cannot bypass required outcome behaviour. Approval remains unavailable until task 004.
- [ ] The real authenticated management callback is correlated to the request, case and target and records Refused in the operator request. Existing public status/read transport exposes current case state as needed; no new polling platform is introduced.
- [ ] Confirmed refusal atomically closes the operator request and releases the active slot. The summary retains terminal history, restores Change and leaves all approved sites and Granted accreditation details unchanged.
- [ ] A subsequent explicit submission creates a distinct request, proposed-site and case identity using the same prepared details. Old callbacks remain attached to the old request and cannot close the new request.
- [ ] Failed outcome delivery is observable and does not falsely close the operator request. Reuse acknowledgement/retry behaviour or provide the smallest explicit retry of the same recorded decision; no background reconciliation framework is required.
- [ ] Public checks cover out-of-order actions, terminal mutation, mismatched/conflicting outcomes and harmless replay. Existing organisation/caseworker/support permissions are retained.
- [ ] Connected checks in the existing browser suites show assessment, actual refusal readback, unchanged sites, retained history and a new submission after closure. Relevant shared transport/action regressions pass.

### Blocked by

- `.tasks/002-AFK-High-submit-and-review-add-ors-case.md`

## Published 004: Approve and repeat ORS additions

Published filename: `.tasks/004-AFK-High-approve-and-repeat-ors-additions.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

High

### What to build

Approve an assessed request and display its ORS alongside the fixed accreditation's baseline sites. Then start and approve another request containing the same predefined details. Both approved additions remain visible, enabling repeated demos without resetting data.

### Acceptance criteria

- [ ] Approve is available only in assessment and extends the module-owned decision path from task 003, with engine/audit/version guards and actual operator outcome delivery.
- [ ] Confirmed approval closes the request, releases its active slot, records the terminal history and restores Change. Unconfirmed delivery retains the active slot and is observably retryable.
- [ ] The fixed summary reconstructs approved sites from the unchanged ReEx baseline plus one entry per approved request. Refused, withdrawn and pending proposals contribute no site.
- [ ] Each request has a stable distinct proposed-site identity. Two separately approved requests with identical prepared site details contribute two separate entries; retries/replays for either request contribute no additional entry.
- [ ] Baseline sites, earlier approved additions, accreditation identity, Granted status and unrelated data are preserved. No ReEx mutation, mutable registry copy or next-year application amendment is added.
- [ ] Connected browser checks approve twice through real management decisions without clearing data, verify different request/case/site identities, and compare the site-count increase against the starting view so retained earlier runs are valid.
- [ ] Focused public API checks verify repeat delivery, wrong correlation and unchanged earlier requests/sites. Record the repeatable-site behaviour as a local demo assumption, with production duplicate-site policy deferred.

### Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`

## Published 005: Withdraw a submitted request

Published filename: `.tasks/005-AFK-Medium-withdraw-submitted-request.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

Medium

### What to build

The operator withdraws a request while its management case is Submitted. Withdrawal closes the real linked case and operator request, retains history and restores Change so another request can be submitted. Assessment removes withdrawal eligibility.

### Acceptance criteria

- [ ] Withdraw request is offered only while the management case is Submitted, using existing status/read transport to establish current eligibility. No elaborate reason wizard is introduced.
- [ ] A protected operator operation calls the real correlated management case using existing authenticated transport. The module-owned management service enforces current state/version/access rules and records Withdrawn with audit.
- [ ] Only confirmed closure records Withdrawn in the operator request and atomically releases its active slot. Failed/unconfirmed/rejected delivery leaves it active and visibly recoverable through the smallest existing or explicit retry.
- [ ] The fixed summary preserves Granted status, baseline sites and any earlier approved additions, retains the withdrawn attempt and restores Change.
- [ ] A subsequent submission creates new request/case/site identities. Replaying the old withdrawal is harmless and cannot close that new request.
- [ ] Withdrawal is absent after assessment starts, and a stale or forged operator action is rejected by management without closing the operator request or releasing its slot. Terminal cases cannot be withdrawn.
- [ ] Connected checks demonstrate actual management closure, operator readback and a new request after withdrawal. Focused public API checks cover correlation, replay and state/version guards without a comprehensive timing matrix.
- [ ] The slice introduces no withdrawal from assessment/query, query journey, payment/SLA behaviour or effects on re-accreditation.

### Blocked by

- `.tasks/003-AFK-High-assess-and-refuse-change-request.md`

## Published 006: Prove the complete flow and record the approach

Published filename: `.tasks/006-AFK-High-prove-complete-flow-and-record-approach.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

AFK

### Complexity

High

### What to build

Join the completed paths into a repeatable connected demonstration: refuse, start a new request and withdraw, then approve two new requests with identical prepared site details. Demonstrate durability and workflow versioning, resolve observable integration gaps, and record what the spike establishes and what remains for feature delivery.

### Acceptance criteria

- [ ] The existing operator and management browser suites run the combined real-service flow using actual correlated identities. Refusal/withdrawal add no site; two new approvals add two entries; Change is restored after each confirmed closure.
- [ ] Existing data is retained. Site assertions use a starting baseline, and the demonstration can run again on the same databases without reseeding over requests or fabricating outcomes.
- [ ] One all-service restart preserves request/case/site identities, terminal history, approved additions and Change eligibility. Persisted records are read through public interfaces with MongoDB unchanged.
- [ ] A focused backend public submission/read/action check proves a case submitted under v1 retains its frozen rules after v2 is registered, while a new case uses v2. No second production workflow, version-switch UI or migration platform is added.
- [ ] Existing type/version template resolution is retained and checked for Add ORS where needed. Relevant shared re-accreditation regressions pass, without replaying its entire journey as a separate project.
- [ ] Confirm the focused correlation/replay, single-active-request, terminal-state and access checks from earlier slices; broaden checks only for unresolved failures or integration gaps.
- [ ] The runbook records actual configuration, launch/restart commands, example identifiers, compatible revisions, repeat-demo steps, performed checks and unresolved limitations. Real emails and external ReEx mutation are not claimed.
- [ ] An approach note answers the spec's technical questions with observed changes per service and a sequence diagram. It records module-isolation/framework limitations and compares tonnage/interim-site implications conceptually without implementing another type.
- [ ] The approach note includes the follow-on scope record Complete Add ORS changes against granted accreditations: real entry/capture/evidence/declaration; fee/duly-making/SLA; full outcomes and external amendments; query/resubmission/additional withdrawal stages; broader isolation/recovery; ReEx dependencies; final designs and delivery acceptance. Identify unresolved production duplicate-site policy and demo assumptions.
- [ ] No external delivery tickets or full-feature implementation are created by this verification/documentation task.

### Blocked by

- `.tasks/004-AFK-High-approve-and-repeat-ors-additions.md`
- `.tasks/005-AFK-Medium-withdraw-submitted-request.md`

## Published 007: Review and accept the spike demo

Published filename: `.tasks/007-HITL-Low-review-and-accept-spike-demo.md`.

### Parent

`.tasks/ra-622-spike.spec.md`

### Type

HITL

### Complexity

Low

### What to build

Walk the user through the completed local spike and its technical conclusions. Record whether the demonstrated approach and follow-on scope are accepted as the foundation for full feature delivery.

### Acceptance criteria

- [ ] Demonstrate the new landing-page section, fixed Granted summary, Change entry, predefined proposal, separate request and Add ORS worklist/filter/detail.
- [ ] Demonstrate Start assessment and the approval/refusal actions, submitted-request withdrawal, one-active-request enforcement, retained terminal history and another request after closure.
- [ ] Show two approvals of the same prepared ORS through separate requests, with one site entry per approved request, retained data and no reset requirement.
- [ ] Present recorded durability/versioning evidence and the approach note, including limitations, local projection boundaries and remaining feature scope.
- [ ] Obtain and record the user's decision on the spike demo and technical approach. Product designs, actual tariffs/statutory workflow, external ReEx behaviour and production readiness are not treated as signed off.

### Blocked by

- `.tasks/006-AFK-High-prove-complete-flow-and-record-approach.md`
