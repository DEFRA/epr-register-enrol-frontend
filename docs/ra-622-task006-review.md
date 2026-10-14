# Task 006 code review

Review scope: the complete-flow verification, restart checks, public workflow-version test and approach/runbook documentation. Each reviewer used `git diff <fixed-revision> --` against staged and working changes, with newly added files staged. `git log <fixed-revision>..HEAD --oneline` was empty during review. Runtime caches were excluded from the diff.

| Repository               | Fixed revision                             |
| ------------------------ | ------------------------------------------ |
| Operator frontend        | `785429487cc1971fbd99eff147b98175ca006498` |
| Management backend       | `4d55f697568b39c5daa614ecc7908a175f6b1392` |
| Operator browser tests   | `0a4182879823121e19c7dd580d53ffddfa93a58f` |
| Management browser tests | `57f432adcf133ab246155b6567d9ed803ca03605` |

The operator backend (`e6de0f8578cc093a49c90b59e1addaa43c1fabce`) and management frontend (`09dfd5715a3f4f7711566de292201438e3a13c2c`) required no change and were read as context. Task-start revisions supply the review's fixed points for the user-authorized task work.

Standards and Spec ran in separate parallel agents. Standards sources included repository instructions, README files, editor/lint configuration and the management work-item framework documentation, plus the skill's code-smell baseline. Spec sources were task 006 and its parent specification. The single-task/local-commit/no-push/no-external-ticket instruction overrides generic tracker and push instructions. Task 007 human acceptance is excluded.

## Standards

No findings. The public v1/v2 check uses the existing HTTP host and ephemeral Mongo infrastructure and a composed test-only declaration. Browser assertions use captured real correlation, public records and scoped test IDs. The worklist search uses its documented case-ID search. No documented-standard violations or actionable baseline smells were found; tooling-enforced rules were excluded.

Supplemental review cleared the formatted test block and evidence append. The runbook distinguishes the interrupted native-stderr launch from successful runner exits, records normal submission replay recovery, and accurately limits the whole-file C# formatting claim. The final-newline choice follows the backend editor configuration.

## Spec

No findings. Connected assertions cover refusal, submitted withdrawal and two approvals with distinct request/case/site identities, preserved starting sites/history, exclusion of non-approved proposals and restored Change. Restart checks compare complete public operator and management records, including frozen version, audit and delivery confirmation. The public version test proves v1 retains its action rules while new v2 cases use the changed declaration. Existing frontend template resolution and Add ORS v1 rendering checks are retained.

The approach/runbook record the technical questions, changes per service, sequence diagram, configuration, restart/repeat commands, actual identifiers, framework limits and follow-on scope. The supplemental repeat evidence confirms the same databases advance from eight to ten sites and ten to fourteen terminal attempts without reseeding or fabricated outcomes. No production workflow, second new change type, external ticket or final product signoff was added.

Outstanding findings: Standards 0; Spec 0. Validation evidence is recorded in [the runbook](ra-622-spike-runbook.md#task-006-complete-flow-durability-and-versioning). Technical review does not substitute for task 007 human acceptance.
