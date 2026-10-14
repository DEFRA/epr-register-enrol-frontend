# RA-622 spike: approach and delivery boundary

The spike establishes a separate operator change request and an independent management case type as a workable basis for Add ORS delivery. A change does not reopen or copy a re-accreditation application. The fixed target stays Granted while each request has its own lifecycle. The connected evidence and exact runtime commands are in [the runbook](ra-622-spike-runbook.md#task-006-complete-flow-durability-and-versioning).

This is a local technical proof. Granted eligibility, the target and the proposal are prepared demo configuration. Approval changes the operator's local read projection; it does not amend ReEx. There is no evidence of live ReEx contract compatibility, real email delivery, agreed tariffs, statutory workflow or production readiness. Task 007 separately records human acceptance of this approach.

## Observed changes by service

| Service             | Changes established by tasks 001–005                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verification added by task 006                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator frontend   | Local/development landing section, fixed Granted summary, prepared proposal, protected submit/retry/withdraw forms, correlated active request and retained terminal history. English/Welsh text follows existing translation conventions. Organisation access uses the existing route guard.                                                                                                                                                                                                                                                | Existing browser phases retain one starting public record and carry actual identities through the complete sequence. Final/restart readback checks the entire public target record, original sites/history, terminal correlations, two additions and restored Change.                                                   |
| Operator backend    | `AccreditationChanges` owns the fixed read, separate Mongo request, submission, status read, outcome and withdrawal. A partial unique target index enforces one active request. Identity and prepared data precede signed ingestion. Receipt/outcome correlation validates the request, case, proposal and exact target. Confirmed closure releases the slot atomically. Approved proposals are projected over unchanged development ReEx sites.                                                                                            | Existing public-route checks reconfirm concurrency, access, replay, failed delivery, correlation and terminal guards. No additional production operator behaviour was needed.                                                                                                                                           |
| Management backend  | `AddOverseasSite` declares five states, owns assessment/approval/refusal/withdrawal services and uses the existing engine, persistence, optimistic version guards and audit. Ingestion accepts an independent request identity and retains the existing application contract. A unique request index makes replay resolve to the same case. Stable request GUIDs in generated change-case references remove the old five-candidate repeat limit. Decisions use signed operator callbacks; withdrawal returns the confirmed correlated case. | One HTTP integration check registers a test-only v2 declaration against the same ephemeral Mongo database and compares old/new case reads and actions. Existing engine/version and re-accreditation regressions are reused. Connected signed public reads compare complete case records and audit before/after restart. |
| Management frontend | Independent Add ORS module/routes, v1 detail template, worklist type/filter and protected standard-caseworker controls. Support users can read without decision controls. Recorded decision delivery/retry is visible.                                                                                                                                                                                                                                                                                                                      | Existing real-browser list/filter/detail/decision checks are combined with terminal-case durability reads. Existing template registry and Add ORS page coverage is retained. No second production template or workflow is introduced.                                                                                   |

Both existing WebdriverIO repositories keep their framework. The operator writes an ignored receipt file from real submissions; management consumes its actual IDs. Restart capture reads all the retained target's terminal cases, including earlier demo runs, through authenticated public endpoints and their rendered pages. No synthetic receipts or terminal seeding supplies the evidence.

## Submission and closure

```mermaid
sequenceDiagram
    actor Operator
    participant OF as Operator frontend
    participant OB as Operator backend
    participant OD as Operator MongoDB
    participant MB as Management backend
    participant MD as Management MongoDB
    participant MF as Management frontend
    actor Caseworker
    Operator->>OF: Open fixed Granted target, Change, Submit example
    OF->>OB: Protected submit for owned target
    OB->>OD: Reserve active slot; persist request and stable proposed-site ID
    OB->>MB: Signed Add ORS ingestion with exact target and request identity
    MB->>MD: Persist case, frozen v1 template and audit; unique request correlation
    MB-->>OB: Real case identity/reference and correlated receipt
    OB->>OD: Confirm receipt on the same request
    OB-->>OF: Granted target with separate Submitted request
    alt Caseworker decision
        Caseworker->>MF: Find Add ORS, Start assessment, Approve or Refuse
        MF->>MB: Protected module operation with signed caseworker role
        MB->>MD: Engine checks frozen rules/version; records terminal state and audit
        MB->>OB: Signed request/case/site/target outcome
        OB->>OD: Validate correlation; record outcome and release active slot atomically
        OB-->>MB: Outcome acknowledged
        MB->>MD: Persist delivery confirmation
    else Operator withdrawal while Submitted
        Operator->>OF: Withdraw the displayed request
        OF->>OB: Protected withdrawal with displayed request identity
        OB->>MB: Signed withdrawal of the correlated management case
        MB->>MD: Check correlation/frozen state/version; record Withdrawn and audit
        MB-->>OB: Confirmed Withdrawn case with matching correlation
        OB->>OD: Record withdrawal and release slot atomically
    end
    Operator->>OF: Refresh fixed summary
    OF->>OB: Read retained target and requests
    OB->>OD: Read active request, terminal history and approved proposals
    OB-->>OF: Granted baseline plus one entry per approved request; Change restored
```

The engine is authoritative. `callerInvocable: false` prevents generic action calls from selecting transitions that require module-owned effects. The module calls the existing engine rather than implementing another state machine. Refusal and withdrawal contribute no approved site. Each approved request contributes its own stable site identity, so two requests with identical prepared details produce two entries. Replay of either callback changes no entry count and cannot close a later active request.

Cross-service effects are not one transaction. A decision is stored in management before callback delivery. A failed callback remains visibly unconfirmed and can retry only the same recorded outcome. Withdrawal reserves the operator slot until management closure is confirmed; an unconfirmed response exposes a retry of the same request. Correlation makes these narrow retries safe, but there is no background reconciliation worker or general delivery guarantee. The focused tests cover the agreed narrow failure/replay seams; they do not establish exhaustive timing or crash recovery.

## Answers to the technical questions

| Question                                                         | Observed answer and practical limit                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can another type be ingested, persisted, listed and rendered?    | Yes. `add-overseas-site` passes real signed ingestion and appears as Add ORS in the existing worklist/filter and its stored v1 detail. Re-accreditation remains registered and its relevant shared tests pass.                                                                                                                                                         |
| Can it declare a different workflow with alternative outcomes?   | Yes. Submitted → Assessment → Granted/Refused and Submitted → Withdrawn use engine guards and audit. Generic bypass, invalid ordering, post-assessment withdrawal and terminal mutations are rejected by the backend. Payment/duly-making/SLA/query stages are deliberately absent.                                                                                    |
| Can outcome behaviour remain independent of re-accreditation?    | The Add ORS module's decision and withdrawal code does not import that module. It uses core persistence/engine and common signed transport. The framework still has re-accreditation assumptions described below, so this proves useful module ownership rather than complete framework isolation.                                                                     |
| Do decisions and withdrawal cross the actual boundary?           | Yes. Browser decisions trigger management callbacks to the real operator backend. Operator withdrawal closes the real management case. Public readback verifies the same request/case/site/target identities. No re-accreditation application receives these outcomes.                                                                                                 |
| Does approval affect the target, while other closures do not?    | Yes, for the local operator read projection. The starting approved sites and earlier additions are retained; two new approvals each add one entry. Refusal/withdrawal do not change that view. ReEx fixtures and the target's Granted identity remain unchanged.                                                                                                       |
| Can one active request and repeatable retained attempts coexist? | Yes. The Mongo partial unique index enforces the target slot atomically. Confirmed terminal outcomes free it, old attempts remain readable, and new submissions have different request/case/site identities. Permitting identical site details is a demo assumption requiring a production duplicate-site policy.                                                      |
| Do audit and version/template snapshots work?                    | Yes. Signed public reads preserve the terminal case/audit across restart. The test-only v2 removes Start assessment: an existing v1 case still accepts it through the module HTTP route, while a new v2 case rejects it and stays Submitted. Replay retains the original v1 case. Existing frontend `(type, version)` resolution and Add ORS v1 rendering checks pass. |

## Framework and isolation limits

The independent modules fit the existing registration and template mechanisms, but introducing a type is not confined to a single new folder. Shared ingestion/persistence required an independent `operatorRequestId` replay/index path alongside `operatorApplicationId`. Shared reference generation needed a distinct change-request suffix for repeatable same-target submissions. Presentation required Application type validation/labels and new detail decoration/controls.

Existing list filters, reference generation, SLA, archival and legacy migration infrastructure retain re-accreditation vocabulary and assumptions. For example, common query models reference re-accreditation nation values, applicant-type filtering derives exporter/reprocessor categories from payloads, and `approved` is the existing archive convention. The Add ORS payload does not establish meaningful behaviour for every old filter combination. The spike does not generalize those contracts, rebuild the framework, or introduce a second new type. Future types should expose concrete conflicts before shared code is extracted.

Backend workflow snapshots freeze state/action declarations. Frontend templates are resolved by stored type/version, and old versions must remain registered. A future workflow extension needs a new declaration/template version and retention of old rendering; the check does not prove automatic migration or production version rollout. The v2 declaration exists only inside the integration test host, never as a runtime switch or production workflow.

Organisation ownership and caseworker/support access use existing portal guards and signed service identities. Authentication is not a new cross-type entitlement model. Wider cross-organisation ownership, simultaneous edits and cross-change conflicts need delivery refinement. Frontend sessions use memory and are lost on restart; signing in again is sufficient for this persistence proof.

## Implications for other accreditation changes

Tonnage changes can use the same separation of accreditation target, independent request, module-owned workflow and correlated outcome. Unlike an additional ORS list entry, they need an agreed old/new tonnage and issuing-limit amendment, effective date, authoritative readback and a policy for multiple changes against one accreditation. Fees, evidence and progression may differ; this spike does not settle them or implement the type.

Interim-site additions may resemble ORS proposals but require their own capture/validation, relationship to an overseas site, evidence and final statutory rules. Whether they are a subtype or distinct case type is a later product/framework decision. Shared correlation and submission transport are useful foundations; copying Add ORS assumptions about site identity or duplicates would be premature.

Both comparisons depend on authoritative ReEx target and amendment contracts. Proposed delivery contracts must identify the target accreditation, stable change identity, version/expected current state, amended data, effective date and idempotent result/readback. The actual API, permissions, issuing-limit effects and external-team responsibilities remain unverified dependencies.

## Complete Add ORS changes against granted accreditations

This is the follow-on scope record for ticket refinement. No external delivery ticket or additional implementation task is created here. The reusable foundation is the separate request/case identity, active-slot constraint, module registration, engine/audit snapshots, correlated signing and approval projection demonstrated above.

| Remaining area          | Scope and decisions to refine                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator journey        | Replace the fixed target/prepared example with authoritative eligible-accreditation entry, real request creation/resumption, full ORS/country/material capture and validation, evidence uploads/scanning/readback, check answers and declaration. Confirm final designs and navigation.                               |
| Assessment and money    | Confirm actual tariffs, payment details/dates, duly making, assignment, statutory assessment progression and SLA calculation/extension. Extend with a new workflow version; do not silently change stored spike cases.                                                                                                |
| Outcomes                | Define full approval/refusal payloads, authorized external amendments, issuing-limit/effective-date consequences, delivery recovery and authoritative accreditation readback. The local projection proves presentation only. Confirm real notification requirements separately.                                       |
| Corrections and closure | Query, proposal/evidence corrections, submitted revisions, resubmission, withdrawal at additional eligible stages and further distinct additions. Confirm which stages and rules apply rather than extending Submitted withdrawal by assumption.                                                                      |
| Isolation and recovery  | Define concurrency across other change types and re-accreditation; broaden ownership, concurrent-write, retry/crash recovery and operational reconciliation guarantees. Agree production site identity and duplicate-site policy: identical prepared details across distinct requests are allowed only for this demo. |
| ReEx dependencies       | Confirm amendment support and ownership, authoritative Granted eligibility/target data, effective dates, issuing-limit effects, conflict/version handling and any required external-team work. The synthetic development adapter proves none of those live contracts.                                                 |
| Delivery acceptance     | Final product/design decisions, localization/accessibility acceptance, full journey and relevant regressions, operational configuration, monitoring/recovery and rollout acceptance. Technical spike acceptance does not approve statutory rules, prices or production readiness.                                     |

Tonnage changes and interim sites, if included in full RA-622 delivery, require separately refined scope. They are not delivered by this ORS proof.
