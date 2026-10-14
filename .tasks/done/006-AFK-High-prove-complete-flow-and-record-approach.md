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

- [x] The existing operator and management browser suites run the combined real-service flow using actual correlated identities. Refusal/withdrawal add no site; two new approvals add two entries; Change is restored after each confirmed closure.
- [x] Existing data is retained. Site assertions use a starting baseline, and the demonstration can run again on the same databases without reseeding over requests or fabricating outcomes.
- [x] One all-service restart preserves request/case/site identities, terminal history, approved additions and Change eligibility. Persisted records are read through public interfaces with MongoDB unchanged.
- [x] A focused backend public submission/read/action check proves a case submitted under v1 retains its frozen rules after v2 is registered, while a new case uses v2. No second production workflow, version-switch UI or migration platform is added.
- [x] Existing type/version template resolution is retained and checked for Add ORS where needed. Relevant shared re-accreditation regressions pass, without replaying its entire journey as a separate project.
- [x] Confirm the focused correlation/replay, single-active-request, terminal-state and access checks from earlier slices; broaden checks only for unresolved failures or integration gaps.
- [x] The runbook records actual configuration, launch/restart commands, example identifiers, compatible revisions, repeat-demo steps, performed checks and unresolved limitations. Real emails and external ReEx mutation are not claimed.
- [x] An approach note answers the spec's technical questions with observed changes per service and a sequence diagram. It records module-isolation/framework limitations and compares tonnage/interim-site implications conceptually without implementing another type.
- [x] The approach note includes the follow-on scope record Complete Add ORS changes against granted accreditations: real entry/capture/evidence/declaration; fee/duly-making/SLA; full outcomes and external amendments; query/resubmission/additional withdrawal stages; broader isolation/recovery; ReEx dependencies; final designs and delivery acceptance. Identify unresolved production duplicate-site policy and demo assumptions.
- [x] No external delivery tickets or full-feature implementation are created by this verification/documentation task.

## Blocked by

- `.tasks/004-AFK-High-approve-and-repeat-ors-additions.md`
- `.tasks/005-AFK-Medium-withdraw-submitted-request.md`

## Completion notes

Completed task 006 on `feature/ra-622-spike`. The existing browser repositories now carry a complete captured baseline through refusal, submitted withdrawal and two separate approvals, verify every new request/case/site correlation, and compare entire public records across restart. The management backend adds one public HTTP/Mongo test using a changed test-only v2 declaration; production remains v1. No production operator or management frontend changes were needed.

The first complete connected run retained six starting sites and earlier history and ended with eight sites and ten terminal attempts. One all-application restart changed all four application processes while MongoDB stayed running with its existing directory/databases. Operator public target equality and all ten management public case/audit records, frozen versions and terminal pages passed. A second complete sequence on the same retained databases passed all nine phases and ended with ten sites and fourteen terminal attempts. Refusal/withdrawal add no site; each new approval adds exactly one; the final target remains Granted, has no active request and restores Change. No receipts/outcomes were fabricated or data reset/reseeded.

Validation: focused public groups passed 12 operator and seven management checks, including frozen v1 behaviour/new v2 behaviour, active-slot/access/correlation/replay/state guarantees. Full suites passed: operator frontend 2,651; management frontend 2,128; operator backend 1,631; management backend 2,130 with nine opt-in external checks skipped. Both frontend coverage gates, builds, relevant lint/formatting/audit and Git whitespace checks passed. The newly formatted version test passed final compile/read/action verification. Existing compact C# bodies and management browser Windows formatting limitations remain documented rather than broadly reformatted. Independent Standards and Spec reviews, including supplemental evidence review, have zero outstanding findings.

The runbook records configuration, commands, actual IDs, compatible revisions, repeat/restart checks and launch-warning recovery. `docs/ra-622-spike-approach.md` records service changes, the sequence, technical answers, framework/module limits, conceptual tonnage/interim-site implications and the required **Complete Add ORS changes against granted accreditations** follow-on scope. Real emails, live ReEx mutation, production duplicate-site policy and final product/statutory signoff are not claimed.

No blockers. Task 007 human review remains next and has not been started; the parent spec remains open. The four services and retained final demo remain available. All commits are local; no push or external ticket.
