# RA-622 spike: Prove case types and case workflows

## Problem Statement

The existing applications support re-accreditation. Before delivering in-year accreditation changes, the team needs evidence that another case type can use the existing case management framework, declare its own workflow, and return an outcome to the correct operator request.

The spike should answer those technical questions with the smallest connected implementation. It is a foundation for later feature delivery, rather than a complete Add ORS journey. The broader RA-622 research includes tonnage changes and ORS/interim-site additions; this implementation uses one prepared ORS addition as its representative example and documents the implications for the other changes.

## Solution

Run the four existing application services locally. Provide a small operator demo page with one explicitly configured granted-accreditation target and one prepared proposed ORS. The demonstrator submits that example, finds the resulting Add ORS case in case management, starts assessment, approves it, and returns to the operator page to see the recorded request outcome.

The flow is:

1. The operator frontend displays the prepared target and proposal and offers Submit example.
2. The operator backend persists a separate request and submits it through the real management ingestion API.
3. Management displays the new case type, its target, proposal, case reference and current state.
4. The caseworker progresses the case from Submitted to Assessment to Approved using the registered workflow.
5. Management delivers the approval to the operator backend. The operator page reloads the persisted request outcome; the target accreditation remains Granted.

Successful approval proves delivery of a decision to an independent request. Updating approved sites in an accreditation or writing to ReEx is a later feature requirement.

### Questions the spike must answer

- Can another type be ingested, persisted, listed and rendered alongside re-accreditation?
- Can that type declare a different workflow whose actions and terminal state are enforced by the existing engine?
- Can it implement its own outcome behaviour without depending on the re-accreditation module?
- Can an outcome travel through the real service boundary and update only the correlated operator request?
- Do existing audit and template snapshots work for the new type, and which shared assumptions actually need changing?

### Completion boundary

The spike is complete when the connected approval path and focused technical checks below pass, and a short approach note records the findings and remaining delivery scope. Completion does not depend on building any deferred journey. Extra product behaviour requires a later ticket or an explicit change to this scope.

## User Stories

1. As a demonstrator, I want to submit a prepared ORS addition against one known accreditation, so that I can exercise another case type without completing a new capture journey.
2. As a demonstrator, I want the request and accreditation identified separately, so that I can prove requesting a change does not reopen the accreditation.
3. As a caseworker, I want to find and open an Add ORS case, so that I can demonstrate type-specific presentation within existing case management.
4. As a caseworker, I want to start assessment and approve the case, so that I can demonstrate the new module's state transitions.
5. As a demonstrator, I want to see the approval returned to the operator request, so that I can prove the outcome crosses the actual service boundary.
6. As a maintainer, I want invalid transitions and mismatched outcomes rejected, so that the demonstration establishes meaningful engine and correlation guarantees.
7. As a maintainer, I want persisted cases to retain their workflow version, so that later feature work can extend the module without silently changing existing cases.
8. As a delivery team member, I want the proven approach, limitations and remaining work recorded, so that the next ticket can build on this branch with a clear scope.

## Implementation Decisions

- **Starting point:** all six repositories use `feature/ra-622-spike`, created directly from their current main branches. The existing `feature/ra-622` branches retain their implementation and history. Previous work can inform decisions, but wholesale cherry-picking completed feature slices is not part of the spike.
- **One representative type:** register an independent `add-overseas-site` module in the management backend and frontend, displayed as Add ORS. Re-accreditation supplies the existing contrasting type and workflow. A second new type, a subtype framework and a general change-type registry are unnecessary for this proof.
- **One prepared example:** use a single explicit local target with organisation, registration, accreditation, material and year identifiers, a Granted baseline, and a prepared proposed ORS. Read through the existing ReEx development adapter where useful, but do not infer eligibility from every synthetic response. Only the payload fields necessary for identity, presentation and the demonstrated outcome are required. The preparation belongs to local demo configuration; it is not a production accreditation catalogue or a copy of an application.
- **Minimal operator presentation:** use one demo entry/page showing the target, prepared proposal, Submit example and subsequent request status/case correlation. A refresh or return reads the persisted request. No Change menu, accreditation browser, editable ORS fields, check-your-answers, declaration, saved-draft wizard or application task list is required. Use existing form protection, auth, templates and navigation conventions. The demo entry is restricted to the existing local/development configuration.
- **Minimal operator record:** persist a separate change-request identity, change type, target identifiers, the displayed baseline/proposal, submission status, case correlation and received approval. Persist the identity before sending the submission so retrying the same submission can retain it. Use existing MongoDB and version conventions; do not introduce a general event model, revision history or draft lifecycle.
- **Real submission:** submit through the existing authenticated/signed management ingestion boundary with a type-aware payload. Retain the current re-accreditation contract. The spike must expose any hardcoded re-accreditation assumptions that prevent this, and make only the shared transport or ingestion changes required for the demonstrated path. Frontend API stubs and fabricated case receipts must not substitute for this crossing.
- **Minimal management presentation:** list the case in the existing worklist, identify it as Add ORS, and render a small type-specific detail view using the stored type/template version. Display target identifiers, the proposed site, request/case correlation, state and the implemented actions. Add the new Application type option if the worklist requires it for type selection. Existing unrelated filter combinations, evidence views and full application-summary reuse are not new acceptance requirements.
- **Three-state workflow:** declare `submitted`, `assessment-in-progress` and terminal `approved` states, with Start assessment and Approve as the two meaningful operations. No payment, duly making, SLA, query, refusal or withdrawal state is implemented. These are explicit demo simplifications, not a proposed final statutory workflow. Use existing display conventions where available and keep request status visibly separate from Granted accreditation status.
- **Engine and module ownership:** the backend engine remains authoritative for transitions. Use module-scoped services for behaviour and the existing audit/version/state guards. Approval must have one supported service operation that records the case decision and performs or tracks delivery of its required callback. An alternative generic action must not bypass that outcome behaviour. Do not build a replacement engine or make one work-item module depend on another; extract shared behaviour only where this path proves a concrete need.
- **Minimal outcome contract:** reuse the existing management-to-operator transport and signing where possible, with a type-aware route/contract owned by the change request. Correlate the approval with the persisted request, case and target. Reject mismatched or conflicting outcomes. Record one approval durably; replaying the same approval must be harmless. No re-accreditation application may receive the new type's outcome.
- **Honest delivery state:** make successful versus failed operator delivery observable. A failed callback must not appear as received on the operator page. Reuse existing acknowledgement/retry behaviour where applicable. If it cannot be reused without substantial work, provide the smallest explicit retry of the same recorded outcome and document that limitation. No background reconciliation system, general delivery framework or exhaustive failure matrix is required.
- **Persistence and versioning:** management uses existing work-item persistence, audit and template snapshots. The same request, case and approval must be readable after the application services restart with MongoDB retained. Versioning is proved through a focused backend check using two declarations of the same type; a second production workflow, version-switch UI or migration framework is unnecessary.
- **Local runtime:** connect the operator frontend/backend and management frontend/backend using existing configuration mechanisms, distinct frontend session cookie names and correct callback URLs. Prefer ports 3000, 5000, 3001 and 8085 respectively. Use existing stub sign-ins, MongoDB and unchanged ReEx development fixtures. Select separate spike databases so existing RA-622 demo data and receipts are preserved and cannot supply the new demonstration's results. Disable real notifications. Upload/storage infrastructure is unnecessary for prepared field data. Document the minimal launch commands and example identifiers; a reusable orchestration platform is out of scope.
- **Existing access rules:** retain organisation ownership, caseworker/support permissions and protected mutation routes. Do not introduce a new permission scheme. Use existing translation conventions for any added interface text; comprehensive Welsh or accessibility journey expansion is deferred.
- **Approach note:** record the observed changes per service, the recommended separate request and case-type design, a sequence diagram of the demonstrated submission/outcome flow, and any limitations in module isolation, ingestion, presentation or versioning. Compare the approach conceptually with tonnage changes and interim-site additions. Identify proposed ReEx amendment contracts, effective-date/issuing-limit questions, concurrency policy and fee/workflow decisions as unresolved delivery dependencies where they are not established by this proof. Do not claim that the live ReEx interface has been verified.

## Testing Decisions

- **Primary seam:** one connected scenario crosses the four real services through their public interfaces: prepared request submission, worklist/detail, Start assessment, approval and operator outcome readback. Use the two existing browser-test repositories for their respective portal portions, passing the actual request/case identifiers between them. A manual walkthrough uses the same scenario. No new test repository or browser framework is needed.
- **Focused API checks:** use existing public backend integration patterns, with existing MongoDB test infrastructure where persistence matters, to check invalid/out-of-order transitions, terminal-state mutation, wrong request/case/target callback correlation, and harmless duplicate approval delivery. Reuse submission correlation/retry behaviour where available and verify repeating the demonstrated submission retains one request/case.
- **Versioning check:** submit under v1, register a changed v2 declaration in the existing backend test setup, and verify that the v1 case retains its stored version and action rules while a newly submitted case uses v2. Exercise public submission/read/action behaviour rather than private engine hooks. Frontend template resolution uses the existing versioned registry; reuse its coverage and add a new-type assertion only if needed.
- **Durability check:** restart the application services once without clearing MongoDB and verify the same request/case identities and recorded approval. Unsaved frontend session recovery is not required.
- **Existing behaviour:** run relevant existing checks for any shared submission, worklist, template or transport code changed. Verify the existing re-accreditation type can still be listed/read and its relevant actions are unaffected; do not reproduce its entire journey as a separate prerequisite project.
- **Test quality:** test observable behaviour and genuine boundaries. Avoid tests that mirror declarations, comprehensive product acceptance suites, repeated full-suite runs without a reason, or new test seams below existing public endpoints.
- **Evidence:** the approach note records the exact demo configuration, repository revisions, checks actually performed, limitations and any unresolved failures. Successful callback receipt must come from management, not from a directly seeded operator outcome.

## Out of Scope

- A complete Add ORS product journey or production rollout.
- Full ORS/interim-site capture, country/material rules, evidence uploads/scanning/downloads, check-your-answers and declaration.
- Current-accreditation catalogue, Change selection, save-and-return drafting, comprehensive request history and multiple concurrent operator journeys.
- Fees, payment details, payment dates, duly making, SLA calculation/extension and statutory workflow confirmation.
- Refusal, query/resubmit, query-origin recovery, withdrawal and starting subsequent requests.
- Approved-site projection, changes to ReEx fixtures, live ReEx reads/writes, issuing-limit amendments and Public Register changes.
- Tonnage-change or interim-site implementation; only their design implications are recorded.
- A second new case type, cross-type abstraction framework, task checklist framework, broad framework redesign or speculative shared-code extraction.
- Full filter-combination coverage, comprehensive localization/accessibility acceptance, real notifications and production entitlement-policy changes.
- Comprehensive concurrency/recovery hardening, background effect workers and production reconciliation. The narrow correlation, replay and state guarantees specified above remain in scope.
- Generating implementation tasks, implementing the demo or creating external delivery tickets during this specification step.

## Further Notes

### Carrying the spike into feature delivery

After the demo and approach are approved, the spike branch is the foundation for the full feature. Keep the useful transport, independent request identity, module registration, engine integration and callback code. Replace the prepared-data entry with the real operator journey, and extend the workflow with a new template version. The simplified spike workflow must not silently acquire final-feature rules for already persisted cases.

The approach note must include a follow-on work record titled **Complete Add ORS changes against granted accreditations**. This is a scope record for later ticket refinement, not another executable task list. It should identify what the spike already proves and describe the remaining work:

| Remaining area            | Scope to refine for the next ticket                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Operator journey          | Real eligible-accreditation entry, request creation/resumption, full ORS validation, evidence and declaration.                          |
| Assessment and money      | Confirm fees and SLA; implement payment details, duly making, assignment and the intended assessment progression.                       |
| Outcomes                  | Complete approval/refusal, authorized effects, delivery recovery and agreed accreditation amendment/readback.                           |
| Corrections and closure   | Query, full proposal/evidence correction, submitted revisions, resubmission, withdrawal and subsequent requests.                        |
| Isolation and reliability | Agree overlapping-change policy; protect concurrent writes, retries, case/request ownership and independence from re-accreditation.     |
| External dependencies     | Confirm ReEx amendment support, effective dates, issuing-limit effects, authoritative target data and any required work in other teams. |
| Delivery acceptance       | Final designs, localization/accessibility, complete journey/regression coverage, operational configuration and rollout requirements.    |

Where an area still needs product, design or external-team decisions, record those dependencies rather than inventing an answer. If full RA-622 delivery includes tonnage changes or interim sites, record them as separately refined scope; this ORS proof does not deliver those journeys.

### Review

The human review demonstrates the connected approval path and inspects the approach note and follow-on scope. Approval confirms that the technical approach is a suitable basis for delivery; it does not sign off final designs, tariffs, statutory workflow or external registry behaviour.

No existing RA-622 feature commits are included in the spike baseline. Existing local runtime caches are outside the branch's implementation and must not be mistaken for evidence produced by the new demo.
