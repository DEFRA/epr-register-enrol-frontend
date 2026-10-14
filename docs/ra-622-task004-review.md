# Task 004 code review

Review scope: the approval and repeat-addition changes against the six task 003 revisions below. The review used each repository's working diff against that fixed revision, plus the new approval browser spec, before committing. No commits had been made after those baselines. Runtime caches were excluded.

| Repository               | Fixed revision                             |
| ------------------------ | ------------------------------------------ |
| Operator frontend        | `cb4f973400f8ba8d63c4597148bb59206d0be9df` |
| Operator backend         | `4ec7ce95d6a19af247f9e7a94298757a4cd70094` |
| Management backend       | `b48462458b90301967832ac0d325daa651e76bef` |
| Management frontend      | `d6dd8084ebcb7305b7a2b6ff159c41e2e82a6530` |
| Operator browser tests   | `256e231a23edcf92435e42839a9bd047df41a074` |
| Management browser tests | `20e9f3dcd5c8a659695b7749393a0bbd5c3321fd` |

The Standards and Spec axes ran in separate agents. Standards sources included repository instructions, editor configuration, operator i18n guidance, management work-item conventions and relevant ADRs, with the code-review skill's smell baseline. Spec sources were task 004 and its parent spike specification. Later withdrawal and final-proof tasks were excluded. The user's local-task/no-push instructions take precedence over the generic issue-tracker/push instructions.

## Standards

No hard documented violations found. Approval already exists in both v1 frozen workflow definitions, so exposing the module operation does not introduce a new transition or require a template-version bump.

One possible Duplicated Code smell was reported: the new approval browser spec repeated the approved-site selector/read mapping. A local `readSiteEntries()` helper now supplies all three preservation assertions. The Standards reviewer confirmed that this sole finding is resolved.

## Spec

No findings. Approval follows the module-owned engine transition and signed operator callback. Failed delivery remains observable and retryable. Confirmed callbacks release the active slot; approved history supplies one site per distinct request, preserving baseline sites and identical additions while making replay harmless. Focused API checks cover correlation, conflicting outcomes, earlier-request preservation and repeat approvals. Browser phases pass real identifiers between portals and compare additions against the starting view. No scope creep identified.

Outstanding findings: Standards 0; Spec 0. Validation and connected-run evidence are recorded in [the runbook](ra-622-spike-runbook.md#task-004-approval-and-repeatable-ors-additions).
