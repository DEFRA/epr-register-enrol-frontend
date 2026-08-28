# epr-register-enrol-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_epr-register-enrol-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_epr-register-enrol-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_epr-register-enrol-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_epr-register-enrol-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_epr-register-enrol-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_epr-register-enrol-frontend)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Configuration](#configuration)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Development without a backend](#development-without-a-backend)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [File Upload and Download](#file-upload-and-download)
  - [Overview](#overview)
  - [Upload flow](#upload-flow)
  - [Download flow](#download-flow)
  - [Key source files](#key-source-files)
  - [Environment variables](#environment-variables)
  - [Running locally](#running-locally)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v9`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd epr-register-enrol-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Configuration

Config is managed via [`convict`](https://github.com/mozilla/node-convict) —
see [`src/config/config.js`](src/config/config.js) for the full schema, and
[`.env.example`](.env.example) for a ready-to-copy local file (`cp
.env.example .env` — see [Setup](#setup) below). The tables below cover the
vars from the CDP secrets tab plus their closely-related config; platform/
infra boilerplate (`PORT`, `HOST`, `LOG_LEVEL`, proxy vars, etc.) is left to
`.env.example`, which already documents it.

### Defra ID (end-user sign-in)

| Variable                 | Secret? | Description                                |
| ------------------------ | ------- | ------------------------------------------ |
| `DEFRA_ID_CLIENT_ID`     | Yes     | OAuth2 client ID for Defra ID sign-in      |
| `DEFRA_ID_CLIENT_SECRET` | Yes     | Paired client secret                       |
| `DEFRA_ID_DISCOVERY_URL` | No      | OIDC discovery/metadata URL                |
| `DEFRA_ID_SERVICE_ID`    | No      | Defra ID service ID assigned at onboarding |

Required in production whenever `AUTH_STUB_ENABLED=false`; boot fails loudly
if `AUTH_STUB_ENABLED=true` while `ENVIRONMENT=prod`. Leave blank for a local
run under stub auth.

### Entra ID (internal/regulator sign-in)

| Variable                        | Secret? | Description                                                                                         |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `ENTRA_CLIENT_ID`               | Yes     | Azure Entra ID client ID                                                                            |
| `ENTRA_CLIENT_SECRET`           | Yes     | Paired client secret                                                                                |
| `ENTRA_TENANT_ID`               | No      | Azure AD tenant ID                                                                                  |
| `ENTRA_REGULATOR_ROLE_VALUE`    | No      | Entra app-role name mapped to "regulator, standard" (default `Waste.Regulator.Standard`)            |
| `ENTRA_SUPPORT_USER_ROLE_VALUE` | No      | Entra app-role name mapped to "regulator, read-only support" (default `Waste.SupportUser.ReadOnly`) |

### Service-to-service auth

| Variable                      | Secret? | Description                                                                                                                            |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SHARED_SECRET__BACKEND` | Yes     | Bearer token sent on every outbound call to `epr-register-enrol-backend` — must match backend's `AUTH_SHARED_SECRET__FRONTEND` exactly |
| `AUTH_CALLBACK_BASE_URL`      | No      | Base URL used to build both Defra ID and Entra ID OAuth callback URLs. Default `http://localhost:3000`                                 |
| `AUTH_STUB_ENABLED`           | No      | Bypasses real OAuth, auto-authenticates every request as a fixed stub user. Boot fails loudly if `true` while `ENVIRONMENT=prod`       |

### Session and cache

| Variable                                                         | Secret?                      | Description                                                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_COOKIE_PASSWORD`                                        | Yes                          | Yar/Hapi session-cookie encryption key, ≥32 chars. Boot fails loudly if the shipped local placeholder is still set once `NODE_ENV=production` or `SESSION_COOKIE_SECURE=true` |
| `SESSION_CACHE_ENGINE`                                           | No                           | `memory` or `redis`                                                                                                                                                           |
| `REDIS_HOST` / `REDIS_USERNAME` / `REDIS_PASSWORD` / `REDIS_TLS` | `REDIS_PASSWORD` is a secret | Redis connection, only relevant when `SESSION_CACHE_ENGINE=redis`. Boot fails loudly in production/TLS if the host is still localhost or username/password is blank           |

### File upload

| Variable                | Secret? | Description                                                                                                                                           |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FILE_UPLOAD_S3_BUCKET` | No      | S3 bucket the CDP Uploader stores sampling-plan/BES-evidence uploads in — must match `epr-register-enrol-management-fe`'s own `FILE_UPLOAD_S3_BUCKET` |

> The [File Upload and Download](#file-upload-and-download) section further
> down this README documents an older `src/server/file-upload/*` plugin and
> `FILE_UPLOAD_S3_ENDPOINT`. That plugin has since been removed — current
> uploads go through `src/server/accreditation/sampling-plan-upload/` and
> `.../upload-bes-evidence/`, and `FILE_UPLOAD_S3_ENDPOINT` isn't read
> anywhere in `src/` today. That section is out of date and due a refresh.

### HTTP Basic Auth (preview-environment gate)

| Variable             | Secret? | Description                                                                                   |
| -------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `AUTH_BASIC_ENABLED` | No      | Gates the whole app behind HTTP Basic Auth (e.g. for a preview environment). Defaults `false` |
| `BASIC_USER`         | No      | Basic-auth username, required when the flag above is enabled                                  |
| `BASIC_PASSWD`       | Yes     | Basic-auth password, required when the flag above is enabled                                  |

### Backend API client

| Variable           | Secret? | Description                                                                                                                                                                            |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`     | No      | Base URL of `epr-register-enrol-backend`                                                                                                                                               |
| `API_TIMEOUT`      | No      | Backend request timeout (ms)                                                                                                                                                           |
| `API_STUB_ENABLED` | No      | Replaces all backend API calls with in-memory fixture data — see [Development without a backend](#development-without-a-backend). Boot fails loudly if `true` while `ENVIRONMENT=prod` |

### Example local/testing values

```bash
DEFRA_ID_CLIENT_ID=local-dev-defra-id-client-id
DEFRA_ID_CLIENT_SECRET=local-dev-fake-secret-value
ENTRA_CLIENT_ID=local-dev-entra-client-id
ENTRA_CLIENT_SECRET=local-dev-fake-entra-secret
ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
AUTH_SHARED_SECRET__BACKEND=local-dev-shared-secret-not-real
SESSION_COOKIE_PASSWORD=the-password-must-be-at-least-32-characters-long
FILE_UPLOAD_S3_BUCKET=epr-register-enrol-file-uploads
```

`AUTH_STUB_ENABLED=true` (the local default) makes the Defra ID/Entra ID
values above irrelevant for a plain local run — see
[`.env.example`](.env.example) for every var's actual default.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

Copy the example environment file and fill in any values you need:

```bash
cp .env.example .env
```

`.env` is loaded automatically by nodemon when you run `npm run dev` — no shell exports needed. See `.env.example` for all available variables and their defaults.

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Development without a backend

To run the frontend without a running backend API, set `API_STUB_ENABLED=true` in your `.env` file, or pass it inline:

```bash
API_STUB_ENABLED=true npm run dev
```

This replaces all API calls with in-memory fixture data, so no backend is required. The stub is implemented in [src/server/common/stub-api-client.js](src/server/common/stub-api-client.js) and returns two example accreditation applications and one organisation. Writes (PATCH, POST, DELETE) are accepted silently.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag epr-register-enrol-frontend`

Build:

```bash
docker build --target development --no-cache --tag epr-register-enrol-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 epr-register-enrol-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag epr-register-enrol-frontend .
```

Run:

```bash
docker run -p 3000:3000 epr-register-enrol-frontend
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

If local changes are not reflected in the docker container, delete the frontend container, delete the image and rebuild:

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## File Upload and Download

### Overview

File upload and download is handled by a dedicated CDP uploader service that acts as an intermediary between the browser and S3. The frontend never receives the raw file bytes during upload — the browser posts directly to the CDP uploader, which handles virus scanning and S3 storage before notifying the frontend that the file is ready.

```
Browser ──POST multipart──► CDP Uploader ──► Quarantine S3
                                  │
                          Virus scan (SQS)
                                  │
                    ┌─────────────┴─────────────┐
                 Infected                      Clean
                    │                            │
              hasError=true              Move to dest S3
                    │                  fileStatus='complete'
                    └──────── redirect to /file-upload/upload-status
```

### Upload flow

**Step 1 — Select details** (`GET/POST /file-upload/add`)

The user selects a material type (Steel, Wood, Aluminium, Fibre, Glass, Paper, Plastic) and a year of accreditation. Both fields are validated server-side. On success they are saved to the Yar session under `FILE_UPLOAD_SESSION_KEY` and the user is redirected to the upload form.

**Step 2 — Initialise upload session with CDP uploader** (`GET /file-upload/upload`)

Before rendering the file input page, the server calls `initUpload()` ([src/server/common/helpers/upload/init-upload.js](src/server/common/helpers/upload/init-upload.js)), which POSTs to the CDP uploader's `/initiate` endpoint with:

| Field         | Value                                    |
| ------------- | ---------------------------------------- |
| `redirect`    | `{appBaseUrl}/file-upload/upload-status` |
| `s3Bucket`    | `FILE_UPLOAD_S3_BUCKET`                  |
| `s3Path`      | `file-uploads/{material}/{year}`         |
| `maxFileSize` | 100 MB                                   |
| `mimeTypes`   | PDF, Word (.doc/.docx), JPEG, PNG        |

The CDP uploader responds with `uploadId`, `uploadUrl` (the form action URL), and `statusUrl`. The `uploadId` and `statusUrl` are saved to the session. The `uploadUrl` is passed to the Nunjucks template as the form `action`.

**Step 3 — Browser posts file directly to CDP uploader**

The upload form submits a `multipart/form-data` POST directly to the CDP uploader's `uploadUrl` — the frontend server is not involved in receiving the file bytes. The CDP uploader:

1. Stores the file in a quarantine S3 bucket.
2. Publishes a message to an SQS queue to trigger a virus scan.
3. Redirects the browser to the `redirect` URL (`/file-upload/upload-status`) once the file is received.

> The Content Security Policy is updated to allow `form-action` to the CDP uploader origin ([src/server/common/helpers/content-security-policy.js](src/server/common/helpers/content-security-policy.js)).

**Step 4 — Poll for scan result** (`GET /file-upload/upload-status`)

A Hapi pre-handler ([src/server/common/helpers/upload/provide-upload-status.js](src/server/common/helpers/upload/provide-upload-status.js)) fetches the upload status from the `statusUrl` stored in session before the route handler runs. The response shape from the CDP uploader is:

```json
{
  "uploadStatus": "ready" | "pending" | "initiated",
  "form": {
    "file": {
      "fileStatus": "complete" | "pending" | "rejected",
      "hasError": false,
      "fileId": "...",
      "filename": "report.pdf",
      "contentType": "application/pdf",
      "s3Key": "file-uploads/Steel/2025/...",
      "s3Bucket": "epr-register-enrol-file-uploads"
    }
  }
}
```

- If `uploadStatus` is not `"ready"`, the status page is rendered with a `<meta http-equiv="refresh" content="2">` tag so the browser polls automatically every 2 seconds.
- If `uploadStatus` is `"ready"` and `fileInput.hasError` is `true` (virus detected), an error flash is set and the user is redirected back to the upload form.
- If `uploadStatus` is `"ready"` and `fileInput.fileStatus` is not `"complete"` or `"rejected"` (unexpected state), an error flash is set and the user is redirected back to the upload form.
- If `uploadStatus` is `"ready"` and `fileInput.fileStatus` is `"complete"`, the file metadata is saved to the backend API.

**Step 5 — Save file record to backend API**

The controller POSTs to the backend at `POST /api/v1/file-uploads` with:

```json
{
  "OrganisationId": "<user id from auth>",
  "Material": "Steel",
  "YearOfAccreditation": 2025,
  "FileId": "<cdp upload id>",
  "Filename": "report.pdf",
  "ContentType": "application/pdf",
  "S3Key": "file-uploads/Steel/2025/report.pdf",
  "ScanStatus": "Clean"
}
```

The `ScanStatus` is derived from `fileInput.fileStatus` (`complete` → `"Clean"`, `rejected` → `"Infected"`). The session is cleared and the user is redirected to `/file-upload` (the file list).

### Download flow

**`GET /file-upload/{fileUploadId}/download`**

1. The backend API is queried for the file record by `fileUploadId`.
2. If `scanStatus` is not `"Clean"`, a `422 Unprocessable Entity` is returned — infected or pending files cannot be downloaded.
3. The S3 URL is constructed from config: `{FILE_UPLOAD_S3_ENDPOINT}/{FILE_UPLOAD_S3_BUCKET}/{file.s3Key}`.
4. The server fetches the file from S3 and **streams** the response body directly to the client using `Readable.fromWeb(s3Response.body)` — no buffering in Node.js heap.
5. `Content-Type` and `Content-Disposition: attachment` headers are set, triggering a browser file download. The filename is RFC 5987 encoded to support non-ASCII characters.

### Key source files

| File                                                                                                                             | Purpose                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [src/server/file-upload/index.js](src/server/file-upload/index.js)                                                               | Hapi plugin — registers all 14 routes with `requireOperator` auth |
| [src/server/file-upload/controllers/details-controller.js](src/server/file-upload/controllers/details-controller.js)             | Material and year selection (GET + POST)                          |
| [src/server/file-upload/controllers/upload-controller.js](src/server/file-upload/controllers/upload-controller.js)               | Calls CDP uploader `/initiate`, renders upload form               |
| [src/server/file-upload/controllers/upload-status-controller.js](src/server/file-upload/controllers/upload-status-controller.js) | Polls scan status, saves clean file to backend API                |
| [src/server/file-upload/controllers/list-controller.js](src/server/file-upload/controllers/list-controller.js)                   | Lists all files uploaded by the user's organisation               |
| [src/server/file-upload/controllers/file-controller.js](src/server/file-upload/controllers/file-controller.js)                   | Individual file detail view                                       |
| [src/server/file-upload/controllers/download-controller.js](src/server/file-upload/controllers/download-controller.js)           | Streams file from S3 to browser                                   |
| [src/server/common/helpers/upload/init-upload.js](src/server/common/helpers/upload/init-upload.js)                               | POSTs to CDP uploader `/initiate`                                 |
| [src/server/common/helpers/upload/provide-upload-status.js](src/server/common/helpers/upload/provide-upload-status.js)           | Hapi pre-handler — fetches scan status before handler runs        |
| [src/server/file-upload/helpers/file-upload-api-service.js](src/server/file-upload/helpers/file-upload-api-service.js)           | Typed client for the backend file upload API                      |
| [src/server/file-upload/constants.js](src/server/file-upload/constants.js)                                                       | Material list, year options, session key                          |

### Environment variables

| Variable                  | Default                           | Description                                             |
| ------------------------- | --------------------------------- | ------------------------------------------------------- |
| `FILE_UPLOAD_S3_BUCKET`   | `epr-register-enrol-file-uploads` | S3 bucket where clean files are stored                  |
| `FILE_UPLOAD_S3_ENDPOINT` | `http://localhost:4566`           | S3 endpoint URL (LocalStack locally, AWS in production) |

### Running locally

The Docker Compose setup (see [Docker Compose](#docker-compose)) starts LocalStack for S3/SQS and provides the required infrastructure. The CDP uploader must also be running.

For a complete local stack:

```bash
# In the cdp-uploader directory
npm run dev   # starts CDP uploader on :7337

# In this directory
docker compose up -d   # starts LocalStack, Redis, MongoDB
npm run dev            # starts the frontend on :3000
```

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.

_Re-triggering CI to check for run-to-run flakiness in the E2E journey suite (RA-293 investigation)._
