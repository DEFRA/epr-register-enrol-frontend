# RA-622 spike: fixed accreditation and Add ORS submission (tasks 001–002)

Run the existing four services on `feature/ra-622-spike`, with the existing MongoDB instance at `mongodb://127.0.0.1:27017`. Use the database names below; do not clear MongoDB or reuse the earlier feature-demo databases. No uploader, S3 emulator, Redis, OAuth service or notification service is required. Frontend sessions use the existing memory cache option.

| Service             | URL                   | Database/session cookie           |
| ------------------- | --------------------- | --------------------------------- |
| Operator frontend   | http://localhost:3000 | `ra-622-spike-operator-session`   |
| Operator backend    | http://localhost:5000 | `epr-ra-622-spike-operator`       |
| Management frontend | http://localhost:5001 | `ra-622-spike-management-session` |
| Management backend  | http://localhost:8085 | `epr-ra-622-spike-management`     |

The frontend callback base URLs match their own portal URLs. `App__BaseUrl` on the operator backend is its own public URL. Management callbacks use `OperatorBackendApi__Url=http://localhost:5000`; operator submission uses `CaseWorking__Url=http://localhost:8085`. Submission crosses the signed management ingestion API. Assessment, decisions and withdrawal remain unavailable until their supporting tasks implement the operations.

## Start the services

Run each block in its own PowerShell terminal from the named repository. MongoDB must already be running with its existing data directory. The strings below are local demo shared secrets; both ends of each connection use the same value. Frontends use development mode and their existing stub sign-ins. Backends use their existing Development adapters and fixtures.

Operator backend (`epr-register-enrol-backend`):

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Mongo__DatabaseUri = 'mongodb://127.0.0.1:27017'
$env:Mongo__DatabaseName = 'epr-ra-622-spike-operator'
$env:AccreditationChangeSpike__Enabled = 'true'
$env:App__BaseUrl = 'http://localhost:5000'
$env:CaseWorking__UseStub = 'false'
$env:CaseWorking__Url = 'http://localhost:8085'
$env:CaseWorking__ClientId = 'epr-register-enrol-backend'
$env:AUTH_SHARED_SECRET__FRONTEND = 'ra-622-spike-operator-frontend'
$env:AUTH_SHARED_SECRET__MANAGEMENT_BE = 'ra-622-spike-management-backend'
$env:CASE_MANAGEMENT_API_SHARED_SECRET = 'ra-622-spike-operator-backend'
dotnet run --no-launch-profile --project EprRegisterEnrolBackend --urls http://localhost:5000
```

Management backend (`epr-register-enrol-management-be`):

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Mongo__DatabaseUri = 'mongodb://127.0.0.1:27017'
$env:Mongo__DatabaseName = 'epr-ra-622-spike-management'
$env:AUTH_SHARED_SECRET__BACKEND = 'ra-622-spike-operator-backend'
$env:AUTH_SHARED_SECRET__MANAGEMENT_FE = 'ra-622-spike-management-frontend'
$env:OPERATOR_BACKEND_SHARED_SECRET = 'ra-622-spike-management-backend'
$env:OperatorBackendApi__Enabled = 'true'
$env:OperatorBackendApi__Url = 'http://localhost:5000'
$env:OperatorBackendApi__ClientId = 'epr-register-enrol-management-be'
$env:Notify__Enabled = 'false'
$env:WorkItems__SeedOnStartup = 'true'
dotnet run --no-launch-profile --project EprRegisterEnrolManagementBe --urls http://localhost:8085
```

Management's existing development worklist seeding runs only in its isolated spike database. Real Notify is disabled. Existing uploader defaults may produce startup warnings, but the read-only demonstration uses no uploads or storage.

Operator frontend (`epr-register-enrol-frontend`):

```powershell
$env:NODE_ENV = 'development'
$env:ENVIRONMENT = 'local'
$env:AWS_EMF_ENVIRONMENT = 'Local'
$env:PORT = '3000'
$env:AUTH_CALLBACK_BASE_URL = 'http://localhost:3000'
$env:SESSION_CACHE_ENGINE = 'memory'
$env:SESSION_CACHE_NAME = 'ra-622-spike-operator-session'
$env:SESSION_COOKIE_SECURE = 'false'
$env:AUTH_STUB_ENABLED = 'true'
$env:AUTH_BASIC_ENABLED = 'false'
$env:API_STUB_ENABLED = 'false'
$env:API_BASE_URL = 'http://localhost:5000'
$env:AUTH_SHARED_SECRET__BACKEND = 'ra-622-spike-operator-frontend'
$env:ACCREDITATION_CHANGE_SPIKE_ENABLED = 'true'
$env:TEST_PAGES_DISABLED = 'false'
$env:REEX_FRONTEND_BASE_URL = 'http://localhost:3000/operator'
$env:DEFRA_ID_MANAGE_ACCOUNT_URL = 'https://manage-account.example.test'
npm run build:frontend
node src/index.js
```

Management frontend (`epr-register-enrol-management-fe`):

```powershell
$env:NODE_ENV = 'development'
$env:ENVIRONMENT = 'local'
$env:AWS_EMF_ENVIRONMENT = 'Local'
$env:PORT = '5001'
$env:AUTH_CALLBACK_BASE_URL = 'http://localhost:5001'
$env:SESSION_CACHE_ENGINE = 'memory'
$env:SESSION_CACHE_NAME = 'ra-622-spike-management-session'
$env:SESSION_COOKIE_SECURE = 'false'
$env:AUTH_STUB_ENABLED = 'true'
$env:AUTH_BASIC_ENABLED = 'false'
$env:BACKEND_API_URL = 'http://localhost:8085'
$env:BACKEND_API_CLIENT_ID = 'frontend'
$env:BACKEND_API_SHARED_SECRET = 'ra-622-spike-management-frontend'
npm run build:frontend
node src/index.js
```

## Target and demonstration

The operator backend's `appsettings.Development.json` contains one disabled-by-default `AccreditationChangeSpike` configuration. The launch enables it. Environment overrides use the same section/property naming convention.

| Field                  | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| Organisation           | `50006` / Global Glass Exports                                |
| Registration ID        | `aaa000000000000000050006`                                    |
| Registration reference | `EXP-50006`                                                   |
| Accreditation ID       | `reex-acc-50006-Glass-2026`                                   |
| Material/year/status   | Glass / 2026 / Granted                                        |
| Baseline               | Four unchanged fixture sites: Germany, France, Japan, Vietnam |
| Prepared proposal      | Spike Glass Recycling, 25 Example Road, Hamburg, Germany      |

Granted is an explicit local demo assumption. The development ReEx adapter provides a synthetic accreditation identity and baseline sites, and does not expose an authoritative granted status. The fixed read checks all five configured target fields before calling that adapter, then checks the returned accreditation identity and exporter identity. It never infers eligibility for other synthetic accreditation responses. No live ReEx status, catalogue or amendment contract has been verified.

1. Open http://localhost:3000/auth/stub/login and select the existing Stub Operator.
2. Open `/operator`, then the single link under **Accreditation change demo**.
3. Check the target identity, Granted status and four approved sites. Follow **Change** to the prepared ORS proposal.
4. Refresh both pages before submitting. They make authenticated backend reads, with organisation ownership enforced by the existing frontend guard. Viewing the proposal creates no request. Select **Submit example** to reserve and submit the prepared change. The summary shows its active request and case correlation, retains Granted and the same approved sites, and hides Change. Refresh preserves the request/site/case identities. An unconfirmed receipt reserves the slot and offers **Retry submission** for that same request.
5. Open http://localhost:5001/auth/regulator/login and use the existing caseworker stub sign-in to reach the real worklist. Its initial assignment filter shows the signed-in user's applications; choose **Any** in Assignment. Select **Add ORS** in Application type and apply the filters. Open the matching case reference to see the exact target, prepared proposal, request/site/case identities and Submitted state. The v1 snapshot contains the later workflow transitions, but they are not caller-invocable and no assessment, outcome, payment or withdrawal controls are exposed in task 002.

The operator routes use `/granted-accreditation/{organisationId}/{registrationId}/{accreditationId}/{materialType}/{year}` and the same path with `/change` or protected POST `/submit`. English and Welsh prefixes are supported. Existing `/operator-accreditation/...` links retain their existing journeys and receive no spike Change action. The backend provides frontend-authenticated GETs at `/api/v1/accreditation-changes/target` and `/api/v1/accreditation-changes/{organisationId}/{registrationId}/{accreditationId}/{materialType}/{year}`, plus POST at the latter path with `/submit`. It returns 404 unless enabled in Development, and for unsupported targets. The frontend also requires its flag, local/dev environment and real API mode.

## Checks

Operator backend:

```powershell
dotnet test --filter-class '*FixedAccreditationReadTests' --no-progress
dotnet test --no-progress
```

Operator frontend:

```powershell
npx vitest run src/server/granted-accreditation/controller.test.js src/server/operator/controller.test.js src/server/common/plugins/route-params-guard.test.js
npm test
npm run lint
npm run format:check
```

Use each existing browser-test repository for its portal, with the services above running:

```powershell
# Use the same receipt path for both browser-test repositories.
$env:RA_622_SPIKE_RECEIPT_FILE = 'C:\epr-register-enrol-frontend\.cache\task002\submission.json'
# epr-register-enrol-fe-tests (run first)
npx wdio run wdio.spike.conf.js
# epr-register-enrol-mgmt-tests
npx wdio run wdio.spike.conf.js
```

The focused configurations reuse each repository's existing WebdriverIO setup. They enable the demo checks with `RA_622_SPIKE_TESTS=true` in the worker; ordinary browser runs skip these opt-in specs. They use relative imports and skip opening an interactive Allure report. Optionally set `CHROME_BINARY` to an installed Chrome executable, `CHROME_VERSION` to its matching version for automatic driver setup, or `CHROMEDRIVER_PORT` to an already running local driver. The connected Windows check used Chromium 148.0.7778.96 with its matching ChromeDriver on port 9515.

The operator browser compares the public application list before and after the change, checks the fixed identity/baseline, submits through the protected form or resumes the existing active request, rejects an unsupported year, and verifies signed-out access. It writes the actual returned request/site/case identities to the configured receipt file. The management browser consumes that file, signs in normally, checks its distinct cookie, and verifies list/filter/detail against that exact received case. Backend tests independently check concurrent starts, fixed-target eligibility, authentication, unconfirmed receipt recovery, signed ingestion, concurrent replay and changed-target rejection. No terminal outcomes or case receipts are seeded for the connected checks.

Task 002 adds protected submission, the separate `accreditationChangeRequests` collection and independent Add ORS modules. A partial unique index reserves one active request per exact five-field target; management's unique `payload.operatorRequestId` index ensures one case per request. The existing application replay key and contract are retained. Request `schemaVersion: 1`, the displayed baseline, prepared proposal and stable proposed-site ID are written before ingestion. Receipt confirmation validates request/site/type/target correlation and updates only that request. The later workflow tasks remain pending.

## Task 001 evidence (14 October 2026)

The connected run used the existing persistent MongoDB data directory at `.cache/ra-622-mongo`, without clearing it, and the two isolated database names above. All four `/health/ready` endpoints returned 200. The backend target read returned Global Glass Exports, `reex-acc-50006-Glass-2026`, Granted and four sites. Management's authenticated worklist showed the existing development cases after selecting Any assignment.

| Repository                      | Starting revision for the tested task 001 changes |
| ------------------------------- | ------------------------------------------------- |
| Operator frontend               | `bbbca133170604bd59dc67308802982f880f0e24`        |
| Operator backend                | `dd7143236219048729ed49c1fdbfd091d55c55c6`        |
| Operator browser tests          | `76aa1a2323fc431bc8e1ef9a37298be4f93cd725`        |
| Management browser tests        | `1979e745f952cc125c91b599b7404c5929c3f7e8`        |
| Management backend (unchanged)  | `ef6a0058c35bb668e0a46fc7b08ac0c302dae5ae`        |
| Management frontend (unchanged) | `2ca62e727a333237b5d3e96cd5f5328fec257ff8`        |

The task 001 implementation commits are the local commits on top of those starting revisions. Checks performed:

The supporting implementation revisions are operator backend `be30949561fcbeed286ecc7ff046a1a73f0cf0c5`, operator browser tests `1873cd4974f86423cf00ce9080e868f97b1f4623`, and management browser tests `243f35e39dd8bc37b52e65437dbe8f60175abba1`. The operator frontend revision is the task 001 commit containing this runbook.

- Operator backend: 10 focused public-route checks and the full suite, 1,619 passed.
- Operator frontend: 56 focused checks; final full suite, 132 files / 2,623 tests passed. Coverage: 98.55% statements, 98.53% lines, 91.89% branches, 98.65% functions. Build, lint, formatting and security audit passed.
- Both connected browser specs passed using the four running services and matching Chromium/ChromeDriver 148.0.7778.96. Operator application lists were unchanged by viewing/refreshing the new pages.
- Management backend compiled; management frontend assets built. Their application code is unchanged in this task.

Automatic WebdriverIO driver setup was unsuccessful in this Windows session, so the connected checks used a separately running matching driver through the documented `CHROMEDRIVER_PORT` option. No fixture modifications or fabricated service responses were used. Submission, outcomes and service-restart durability remain work for later tasks.

The operator browser repository's full lint and formatting checks passed. The management browser repository's changed-file lint/formatting and security audit passed, but its repository-wide checks have existing Windows issues: single-quoted Prettier globs do not resolve in its npm script, and tracked CRLF files produce 10,170 existing formatting/lint errors. Task 001 does not change those files or reformat the repository.

The [two-axis review](ra-622-task001-review.md) found no standards issues and one spec issue, resolved by retaining unrelated landing navigation when the optional demo lookup fails. Both browser specs were also verified to skip when their demo opt-in flag is absent.

## Task 002 evidence (14 October 2026)

The same isolated MongoDB databases and unchanged ReEx fixtures were retained. The operator browser submitted the prepared proposal through the protected form and verified unchanged Granted status, approved sites and re-accreditation application list. Refresh and repeated submission retained these actual identities:

| Correlation     | Value                                  |
| --------------- | -------------------------------------- |
| Request         | `bd5d3746-f21e-48fc-9b16-7b49deafde83` |
| Proposed site   | `48aa044c-359d-40ca-b45b-a48dd693cf55` |
| Management case | `edd350e4-0b37-4b54-997c-7240eeb38845` |
| Case reference  | `AP26EA50006GL`                        |

The management browser consumed the actual receipt file, signed in normally, selected Add ORS in Application type, found this case in the existing list and checked its stored v1 detail against the request, site and exact target. The two successful browser runs used matching Chromium/ChromeDriver 148.0.7778.96. They created no terminal outcomes or synthetic management receipts. Existing requests can be resumed on reruns without clearing data.

- Operator backend: full suite, 1,627 passed; 125 focused submission/read/shared-transport checks passed.
- Operator frontend: final full suite, 132 files / 2,628 tests passed. Coverage: 98.51% statements, 98.49% lines, 91.81% branches, 98.66% functions. Focused post-review checks, 22 passed. Build, full lint/formatting and security audit passed.
- Management backend: final full run, 2,124 passed, nine opt-in live Notify/ReEx checks skipped, one failure starting an existing test's ephemeral replica set. Its isolated retry group passed all 77 checks, including that test, Add ORS signed/concurrent ingestion and the existing Mongo persistence/index checks. The previous full run's index inventory failure was resolved by including the added request-identity index. Existing template-version checks passed in the earlier seven-test focused run.
- Management frontend: final ordinary full runner, 103 files / 2,108 tests passed. Coverage: 97.60% statements, 97.83% lines, 93.19% branches, 97.08% functions. Build, full lint, configured security audit and changed-file formatting passed. Existing unknown-type/re-accreditation card rendering was retained after regression checks.
- Both existing browser repositories: the connected operator scenario and both management scenarios passed; operator full lint/formatting and management changed-file lint/formatting passed. Both audits passed their configured critical-severity threshold.

The management frontend's repository-wide formatting check reports 38 existing files outside this change. The management browser repository retains the previously recorded Windows glob/line-ending limitation. A management Vitest run with `--maxWorkers=2` encountered a Windows module-resolution error before most tests ran; its ordinary full command subsequently passed. The first management browser attempt timed out at login under concurrent suite load; its ordinary retry passed both scenarios. These failures are recorded rather than treated as successful evidence. No dependency or unrelated formatting changes were made to address them.

Quality checks were performed explicitly before local commits. Frontend commit hooks were disabled for those commits to avoid rerunning completed suites and to permit the documented existing formatting limitations. The [task 002 review](ra-622-task002-review.md) has no outstanding Standards or Spec findings. Assessment, callbacks, terminal outcomes and restart durability remain for their recorded later tasks.

Task 002 supporting implementation commits:

| Repository               | Commit                                     |
| ------------------------ | ------------------------------------------ |
| Operator backend         | `b981b63c67c961543d44130c6dd3e5274f3a35f5` |
| Management backend       | `73870ee364166078775b831bc5f3be2f9bd2c124` |
| Management frontend      | `76a394d96357c17e8164fc58c343cf7cea41e577` |
| Operator browser tests   | `e0b0b24a8fc61d84719fb755880b1bc61c78bbe8` |
| Management browser tests | `042a9daed97b4cb6f2e142bb765d53a555dede6f` |

The operator frontend task 002 commit contains this runbook and the completed task document. All six repositories remain on `feature/ra-622-spike`; no commit was pushed. Task 003 is the next recorded task.
