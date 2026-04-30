# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Build & Test

```bash
npm install
npm test          # Vitest with coverage (TZ=UTC)
npm run test:watch
npm run dev       # Nodemon dev server on :3000
```

## Architecture Overview

Hapi 21 server with Nunjucks templating and GOV.UK Frontend. Bilingual (en/cy) via hapi-i18n.
All route modules follow the Hapi plugin pattern: `index.js` registers routes, `controller.js` exports handler.
API calls use `src/server/common/api-client.js` which throws on non-OK responses.
Auth uses scope helpers from `src/server/common/helpers/auth/auth-scopes.js`.

## Conventions & Patterns

- Tests use Vitest; server integration tests use `server.inject()` with mock apiClient via `vi.spyOn`
- GDS tag classes: grey=Saved, blue=Started, turquoise=Sent, green=Approved, red=Rejected
- Translations live in `src/locales/{en,cy}/translation.json` under `pages.<routeName>`
- `data-testid` attributes on all interactive/testable elements for e2e and unit tests
- No comments that explain what code does; only non-obvious why
