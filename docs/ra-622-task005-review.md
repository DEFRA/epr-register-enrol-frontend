# Task 005 code review

Review scope: submitted-request withdrawal across the six repositories. Each reviewer used `git diff <fixed-revision> --` against the staged and working changes before committing, with newly added files staged. `git log <fixed-revision>..HEAD --oneline` was empty. Runtime caches were excluded.

| Repository               | Fixed revision                             |
| ------------------------ | ------------------------------------------ |
| Operator frontend        | `83cb32177a9082fa417b2a12d155b6123af9b9e8` |
| Operator backend         | `ae2d3e41c7b5397a7dda5e15c50842e2e3fbeff8` |
| Management backend       | `d2bc9d9c79264b40b12bc1d02a8a65cc428e1c3d` |
| Management frontend      | `559a1d03d98365e8be4749999fad8ea9beec05e4` |
| Operator browser tests   | `76f24ad40e54a7931f30ba88cb8f45dd6a015257` |
| Management browser tests | `a71a516a961951fd1f0cb37634a578d445485137` |

Standards and Spec ran in separate parallel agents. Standards sources included repository instructions, README files, editor configuration and lint configuration, plus the skill's smell baseline. Spec sources were task 005 and its parent spike specification. The user's single-task/local-commit/no-push instructions override generic tracker/push instructions. Task 006/007 requirements were excluded.

## Standards

No actionable documented-standard violations or baseline smell findings across the six repositories. Existing integration and test idioms are followed. Tooling-enforced rules were excluded. The review includes the withdrawal route's request size limit, added after the full-suite guard identified its absence. A final focused review cleared the browser submission wait and the reference-generation correction discovered during connected execution.

## Spec

No actionable findings. Withdrawal uses authenticated transport and validates organisation, request, case, site and target correlation. Management applies stored workflow rules and optimistic concurrency guards. Confirmed closure atomically records Withdrawn and releases the operator slot; unconfirmed closure retains a visible retry. Old withdrawal replay cannot close a subsequent request, which receives distinct identities. Changes remain within submitted-request withdrawal scope.

Connected execution exposed an existing five-candidate reference limit for repeated same-target changes. A public six-request regression reproduced it. Appending the full stable change-request GUID to newly generated change-case references removes this blocker without changing re-accreditation inputs, existing stored references or replay receipts. Both reviewers cleared the additional fix; it is necessary for task 005's new request after withdrawal.

Outstanding findings: Standards 0; Spec 0. Validation and connected execution evidence are recorded in [the runbook](ra-622-spike-runbook.md#task-005-submitted-request-withdrawal).
