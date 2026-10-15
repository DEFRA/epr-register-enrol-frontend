# RA-622: proposed approach and plan for full delivery

## Objective

Deliver in-year changes to an existing granted accreditation through the normal operator and management services. The operator should be able to change an eligible granted accreditation without reopening or replacing that accreditation application. Each requested change should have its own identity, management case, workflow and recorded outcome. The RA-622 ticket includes tonnage-band changes and ORS/interim-site additions, with approved changes written back to Re-Ex.

The connected spike provides evidence that a new case type, independent workflow and correlated outcome can fit the existing services. It used Add ORS as one representative change. The plan below describes the full operator journey and the further product and Re-Ex work required; the spike itself did not deliver those production capabilities.

## Spike demo

The demo connects the operator and management services for a prepared ORS change: it submits an Add ORS case, exercises assessment, approval, refusal and pre-assessment withdrawal, and returns correlated outcomes to the operator request. It proves that a separate change request and case type can use the existing services and workflow framework. It does not deliver the full operator journey or write approved changes to live Re-Ex.

## Proposed operator journey

1. **Open an eligible accreditation.** The operator uses the normal operator frontend and opens an existing accreditation. Where the accreditation is granted and eligible for an in-year change, its usual summary page offers a **Change** link. Eligibility and the accreditation's current data come from an authoritative service read; the operator frontend must not rely on a hard-coded example or assume every granted accreditation is eligible.
2. **Complete the usual ORS journey.** Selecting Change starts a distinct change request and takes the operator through the established screens for adding an ORS: enter and validate site details, provide the required evidence, review answers, and complete the applicable declaration and submission steps. Reuse existing operator screens and components where their rules fit. The journey must support saving/resuming according to agreed product requirements and must clearly distinguish request status from the underlying accreditation's Granted status.
3. **Submit a correlated management case.** On submission, the operator service persists a stable request identity and payload, then sends it through the authenticated management ingestion API. Management creates an Add ORS case in its existing work-item store, preserving the request identity for idempotent replay. The operator receives the case identity/reference and displays the submitted request separately from the accreditation.
4. **Review and decide in case management.** A caseworker finds Add ORS in the existing worklist using its application-type filter, opens the type-specific case view, assesses the evidence and takes an allowed action. Management owns the workflow transition, audit and case version. The decision is sent back to the operator service with enough correlation to identify the exact request, case and accreditation.
5. **Apply the outcome and refresh the accreditation.** Follow the re-accreditation coordination pattern: management sends the decision status to the operator's Registration and Accreditation backend before committing the terminal case decision. For an approval, the operator backend validates the correlated request and applies the approved change through the required Re-Ex write API, then reads back the authoritative accreditation and updates its request/view. Management completes the case decision after receiving confirmation. Refusal or withdrawal adds no site. Re-Ex mutation is new capability; re-accreditation currently does not write approvals to Re-Ex.

## Case type and workflow design

Register Add ORS as an independent management case type, displayed and filtered in the existing worklist. Store it in the existing management database and shared `workItems` collection, using a type identifier to select its workflow and detail presentation. Keep its module behaviour independent of the re-accreditation module while reusing the existing work-item engine, persistence, audit, signing and template/version mechanisms where they fit.

Tonnage changes and interim-site changes may also need their own case types because their data, evidence and decision rules can differ from Add ORS. The worklist could group Add ORS, interim-site, tonnage and future accreditation-change cases under one **Accreditation change** application-type filter in the case worklist, while each case still displays its specific change type and uses its own workflow and detail view. Confirm the case-type boundaries and filter behaviour during scope/design refinement.

The spike demonstrated a minimal workflow: `Submitted → Assessment → Approved or Refused`, and `Submitted → Withdrawn`. It also demonstrated module-owned protected operations, engine-enforced transitions, state/version guards, audit, and a callback correlated to the originating operator request. Full delivery must refine this model with the actual assessment stages, evidence review, assignment, fees/payment, statutory clocks/SLA, query and correction, withdrawal eligibility, notifications and final decision rules. These rules must be agreed before expanding the workflow; the spike's five states are not a proposed statutory process.

The request, case and accreditation remain distinct records. Use stable identities and explicit correlation across them. Enforce the agreed active-request/conflict rule atomically, retain completed attempts for audit, and make repeated ingestion or outcome delivery idempotent. Persist workflow/template versions so existing cases retain their original behaviour when a later version is introduced. Review shared filters, reference generation, archiving and other re-accreditation assumptions when adding each type; the spike showed that adding a type requires some shared worklist and ingestion integration as well as the module itself.

## User scenario diagrams

The journeys below are shown as numbered service handoffs because each flow is linear. The Re-Ex amendment/readback step is required by RA-622 but was not exercised by the spike.

### Approved

1. **Operator frontend:** The operator opens a granted accreditation. The frontend checks eligibility and shows **Change** when allowed.
2. **Operator frontend:** The operator completes the usual ORS screens, including site details, evidence, review and declaration, then submits the request.
3. **Operator backend:** The backend saves the request identity and payload, then submits a signed Add ORS case to management.
4. **Management backend:** Management creates the case. A caseworker finds it in the worklist, assesses it and approves it.
5. **Management backend to operator backend:** Before committing the terminal case decision, management sends the correlated approval status to the operator backend, following the existing re-accreditation decision gate.
6. **Operator backend:** The operator backend validates the request, case and accreditation correlation, writes the approved ORS change to Re-Ex, reads back the authoritative result and updates its change-request view.
7. **Management backend:** After the operator backend confirms the update, management commits and audits the terminal case decision.
8. **Operator frontend:** The frontend reads the updated accreditation and shows the approved ORS.

### Rejected

1. **Operator frontend:** The operator opens an eligible granted accreditation, selects **Change**, completes the usual ORS screens and submits the request.
2. **Operator backend to management backend:** The operator backend saves the request identity and payload, then submits a signed Add ORS case.
3. **Management frontend and backend:** A caseworker finds and assesses the case, then refuses it. Before committing the terminal case decision, management sends the correlated refusal status to the operator backend.
4. **Operator backend:** The backend validates the correlation, records the refusal and retains the request history. It sends no amendment to Re-Ex, so no ORS is added.
5. **Operator frontend:** The operator sees the Refused outcome; the accreditation remains unchanged. The next Change is offered according to policy.

### Withdrawn before assessment

1. **Operator frontend:** The operator opens an eligible granted accreditation, selects **Change**, completes the usual ORS screens and submits the request.
2. **Operator backend to management backend:** The operator backend saves the request identity and payload, then submits a signed Add ORS case. Management persists it as Submitted.
3. **Operator frontend:** The operator sees the Submitted request and chooses **Withdraw** before assessment starts.
4. **Operator backend to management backend:** The operator backend sends a signed withdrawal for the correlated case. Management verifies that the case is still Submitted, records Withdrawn and confirms closure.
5. **Operator backend:** The backend validates the confirmation, closes the request and retains its history. It sends no amendment to Re-Ex, so no ORS is added.
6. **Operator frontend:** The operator sees Withdrawn; the accreditation remains unchanged. The next Change is offered according to policy.

## Re-Ex integration required for approved changes

The spike did not write an amendment to Re-Ex. Its approved-site view was a local projection over synthetic development data. Full delivery needs an agreed Re-Ex API and operational contract for reading and applying authoritative changes.

The current re-accreditation flow does not write an approved application to Re-Ex. Management first obtains an accreditation number through the operator backend, then sends the decision status to the operator's Registration and Accreditation backend before committing the terminal management decision. The operator backend updates the corresponding application status. Management then records the approved state, accreditation number and start date on its work item. The Re-Ex adapter reads existing Re-Ex data to seed applications; it does not amend an existing accreditation.

To keep Add ORS consistent with that coordination pattern while meeting RA-622's Re-Ex writeback requirement, management should own the case decision and send a signed, correlated approval to the operator backend as a pre-commit gate. The operator backend should validate the request/case/accreditation identities, apply the approved amendment through a new Re-Ex write API, read back the authoritative result, update its change-request view and acknowledge completion. Management should only complete the terminal case transition after that acknowledgement. Make the amendment idempotent so retries after a lost response do not duplicate a site or affect a later request. A failed update should leave the management decision uncommitted and offer a retry, matching the existing decision gate.

The spike's local approved-site projection did not call Re-Ex and does not prove this write path. Confirm the Re-Ex team's endpoint, permissions, supported ORS and tonnage mutations, current-value/version conflict handling, effective dates and issuing-limit effects. Define behavior for the case where Re-Ex applies an amendment but the response is lost; retries must use a stable change identity and reconcile through authoritative readback. Do not treat the existing decision callback or accreditation-number endpoint as a Re-Ex amendment API.

## Delivery plan and decisions

1. **Refine scope and rules:** confirm which change types RA-622 includes; decide whether tonnage changes and interim-site additions are separate case types or variants; agree eligibility, concurrency, site identity/duplicate rules, evidence and validation, decision roles, fees, timing and withdrawal/correction rules.
2. **Agree the Re-Ex writeback contract:** RA-622 requires approved changes to be written to Re-Ex. Confirm the owning team, supported amendment payloads, conflict/version handling, effective dates, issuing-limit effects, idempotency, authoritative readback and recovery behavior.
3. **Build the normal operator journey:** add Change to eligible granted accreditation pages and implement the full ORS screens, persistence/resume, validation, evidence, review, declaration and submission using established frontend patterns.
4. **Complete request and case integration:** create durable operator requests, enforce the agreed active/conflict policy, submit idempotently into the shared management work-item store, add Add ORS list filtering and case detail, and preserve correlation and versioned workflow/template behaviour.
5. **Implement the agreed case workflow and outcomes:** add the refined assessment and decision stages, audit and permissions, plus withdrawal/correction paths as required. Deliver the correlated pre-commit operator status update and explicit failure/retry behaviour.
6. **Apply and verify Re-Ex amendments:** integrate the agreed write API, reconcile ambiguous or failed responses, and verify the operator reads back the updated accreditation.
7. **Validate delivery readiness:** exercise the end-to-end journeys and relevant failure/replay/concurrency paths; confirm accessibility, localization, security, monitoring, operational runbooks and rollout/support acceptance.

Tonnage changes and interim-site additions need separately refined data, evidence, workflow and Re-Ex outcome rules. Do not assume they can reuse Add ORS behaviour unchanged. The spike establishes a reusable case-type and correlation approach, not the product rules or complete scope for those journeys.

For tonnage-band upgrades, the ticket describes charging the band-price difference plus £100 through the existing offline bank-transfer process; confirm the fee calculation and where it belongs in the service model during refinement. The ticket also calls for draft service delivery tickets with rough sizes sequenced toward 1 December 2026, and a follow-up spike for regulator actions such as suspend/unsuspend, cancel/reinstate and withdrawing ORS approval.

## Evidence base and scope limits

The connected spike demonstrated that Add ORS can be ingested, persisted, filtered, rendered, assessed and correlated back to the correct operator request using the existing four services. It exercised refusal, submitted-request withdrawal, approval, retries, retained history, repeat submissions and versioned case behaviour. It did not verify a live Re-Ex amendment API or production eligibility, pricing, statutory rules or readiness.

The source ticket is `.tasks/ra-622.md`. It specifies tonnage-band changes and ORS/interim-site additions, requires Re-Ex writeback in the end-to-end scope, and lists the planned user flows, technical dependency list, sized delivery tickets and regulator-actions follow-up as deliverables.
