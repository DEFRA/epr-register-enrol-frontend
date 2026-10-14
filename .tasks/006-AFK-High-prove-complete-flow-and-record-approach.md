# Task 006: Prove the complete flow and record the approach

## Parent

`.tasks/ra-622-spike.spec.md`

## Type

AFK

## Complexity

High

## What to build

Join the completed paths into a repeatable connected demonstration: refuse, start a new request and withdraw, then approve two new requests with identical prepared site details. Demonstrate durability and workflow versioning, resolve observable integration gaps, and record what the spike establishes and what remains for feature delivery.

## Acceptance criteria

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

## Blocked by

- `.tasks/004-AFK-High-approve-and-repeat-ors-additions.md`
- `.tasks/005-AFK-Medium-withdraw-submitted-request.md`
