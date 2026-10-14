# RA-622 Add ORS demo startup

This starts the four local demo services: operator backend, management backend, operator frontend and management frontend. It uses the isolated RA-622 MongoDB databases and local development sign-in. Start MongoDB first, then open **four separate PowerShell terminals** and run one section in each, from the repository root named in that section.

For either frontend, the command is `npm run dev`. This is the existing package script: it starts the frontend asset watcher and the Hapi server watcher together. No `npm run demo` script is required.

The demo is local only. These settings use local shared secrets, development adapters and a prepared example accreditation; they are not production settings.

**Important:** the commands below run each process directly on the Windows host. Their `localhost` URLs are not suitable when the services run in Docker containers. Inside a container, `localhost` refers to that same container. The Docker guidance below is for standalone containers with their service ports published to the Windows host; it does not require Docker Compose.

## 1. Operator backend

Repository: `epr-register-enrol-backend` (run from its root)

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

## 2. Management backend

Repository: `epr-register-enrol-management-be` (run from its root)

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
$env:WorkItems__SeedOnStartup = 'false'
dotnet run --no-launch-profile --project EprRegisterEnrolManagementBe --urls http://localhost:8085
```

The management backend sends decisions to the operator backend at `OperatorBackendApi__Url`. `OPERATOR_BACKEND_SHARED_SECRET` must match the operator backend's `CASE_MANAGEMENT_API_SHARED_SECRET`. If the backends run in separate containers, change the callback URL to an address reachable from the management backend.

## 3. Operator frontend

Repository: `epr-register-enrol-frontend` (run from its root)

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
npm run dev
```

## 4. Management frontend

Repository: `epr-register-enrol-management-fe` (run from its root)

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
npm run dev
```

## Open the demo

Once all four services are ready:

- Operator portal: <http://localhost:3000>
- Management portal: <http://localhost:5001>
- Operator backend readiness: <http://localhost:5000/health/ready>
- Management backend readiness: <http://localhost:8085/health/ready>

Use the existing local stub sign-ins. In the operator portal, open the Add ORS demo from the operator landing page. In case management, select **Any** in Assignment and **Add ORS** in Application type to find the submitted case.

Keep `WorkItems__SeedOnStartup` set to `false` when reusing the demo database. Do not clear the databases to recover a failed decision delivery: retry the recorded decision in case management so its correlated outcome reaches the operator backend.

## Reset the Add ORS demo data

To start the demo from a clean state, stop the operator backend and management backend first so they cannot write while the reset is running. The operator change-request collection is dedicated to this spike; the management `workItems` collection is shared, so remove only `add-overseas-site` cases. These commands preserve other management work-item types.

Open `mongosh` against the same local MongoDB instance used by the backends and inspect the counts:

```javascript
use epr-ra-622-spike-operator
db.accreditationChangeRequests.countDocuments({})

use epr-ra-622-spike-management
db.workItems.countDocuments({ typeId: 'add-overseas-site' })
```

If those are the disposable demo databases, remove their Add ORS data:

```javascript
use epr-ra-622-spike-operator
db.accreditationChangeRequests.deleteMany({})

use epr-ra-622-spike-management
db.workItems.deleteMany({ typeId: 'add-overseas-site' })
```

An earlier run may have used the ordinary management database (`epr-register-case-management`). If that happened, inspect it too:

```javascript
use epr-register-case-management
db.workItems.countDocuments({ typeId: 'add-overseas-site' })
```

Only if those cases are from this disposable local demo, remove them with:

```javascript
db.workItems.deleteMany({ typeId: 'add-overseas-site' })
```

Restart the backends with the isolated database names in sections 1 and 2, then restart the frontends. The Add ORS demo will create a fresh request and case on its next submission. This reset is for local demo data; do not run these deletes against shared or deployed databases.

## Standalone Docker containers

When each service runs in its own container and its port is published to the Windows host, use `host.docker.internal` for calls between containers. This hostname is provided by Docker Desktop and routes from a container back to the host, where the published port is available. Ensure the container publishes the service port (`5000`, `5001`, `8085`, or `3000`) and that the service listens on `0.0.0.0` inside its container.

| Setting                                                                       | Host-run value above        | Standalone Docker value with published ports |
| ----------------------------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| Operator backend `CaseWorking__Url`                                           | `http://localhost:8085`     | `http://host.docker.internal:8085`           |
| Management backend `OperatorBackendApi__Url`                                  | `http://localhost:5000`     | `http://host.docker.internal:5000`           |
| Operator frontend `API_BASE_URL`                                              | `http://localhost:5000`     | `http://host.docker.internal:5000`           |
| Management frontend `BACKEND_API_URL`                                         | `http://localhost:8085`     | `http://host.docker.internal:8085`           |
| Both backend `Mongo__DatabaseUri` values, if MongoDB runs on the Windows host | `mongodb://127.0.0.1:27017` | `mongodb://host.docker.internal:27017`       |

The public portal URLs and their `AUTH_CALLBACK_BASE_URL` values depend on how the ports are published to the host and should remain browser-reachable (normally `http://localhost:3000` and `http://localhost:5001`). The operator backend's management API secret must still match the management backend's `AUTH_SHARED_SECRET__BACKEND`; the management backend's callback secret must still match the operator backend's `CASE_MANAGEMENT_API_SHARED_SECRET`.

If the containers are attached to the same user-defined Docker network, they can instead call each other by container name, provided those names resolve on that network and each application listens on `0.0.0.0`. Do not use `localhost` for a different container. If MongoDB is in a container on that same network, set both database URIs to `mongodb://<mongodb-container-name>:27017`.

## Demo database names

The operator backend writes its Add ORS change-request records to `epr-ra-622-spike-operator`. The management backend writes its cases to `epr-ra-622-spike-management`. Both use the local MongoDB server at `mongodb://127.0.0.1:27017`. Keep these isolated database names for the demo rather than pointing the spike at the ordinary development databases.
