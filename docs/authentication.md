# Authentication

## Overview

The app supports two OAuth2 identity providers:

| Provider | Users | Login path |
|---|---|---|
| **Azure Entra ID** | Regulators | `/auth/regulator/login` |
| **Defra ID** | Operators | `/auth/operator/login` |

Route protection is enforced by Hapi's built-in `server.auth.strategy` / `server.auth.default` mechanism using `@hapi/cookie` as the session scheme. After a successful OAuth exchange the user profile is stored in the server-side yar session and the cookie strategy validates it on every subsequent request.

A **stub auth** mode is available for local development and automated tests:
- **Local/dev** (`AUTH_STUB_ENABLED=true`): a login chooser page at `/auth/stub/login` lets you select a fake user without hitting any real OAuth provider.
- **Tests** (`NODE_ENV=test`): a bypass scheme auto-authenticates all requests with a default test user — no cookies, no sessions needed.

All application routes are protected by default. The health check and static file routes are explicitly public.

---

## How authentication works

### Route protection

`server.auth.default('session')` in the auth plugin makes every route require a valid session cookie. The `session` strategy is backed by `@hapi/cookie`:

```
request arrives
  → cookie strategy reads the `auth` cookie
    → validate() checks request.yar.get('user')
      → valid: passes credentials to request.auth.credentials
      → invalid: Hapi returns 401 (unauthenticated)
```

No external plugins or middleware are involved in enforcement — this is Hapi's native `server.auth.strategy` mechanism.

### OAuth flow (real providers)

```
GET /auth/regulator/login
  → generate state, store in yar
  → redirect to Azure Entra ID authorize endpoint

GET /auth/regulator/callback?code=...&state=...
  → verify state matches yar-stored value (CSRF protection)
  → POST code to Azure token endpoint → access token
  → GET /v1.0/me with access token → user profile
  → request.yar.set('user', profile)
  → request.cookieAuth.set(profile)  ← sets the auth cookie
  → redirect to /
```

The operator flow is identical, using Defra ID endpoints instead.

---

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `ENVIRONMENT` | Deployment environment (`local`, `dev`, `test`, `perf-test`, `ext-test`, `infra-dev`, `management`, `prod`) | `local` |
| `AUTH_STUB_ENABLED` | Enable stub auth. Defaults `true` when `ENVIRONMENT != prod` | `true` |
| `AUTH_CALLBACK_BASE_URL` | Base URL used to construct OAuth callback redirect URIs | `http://localhost:3000` |
| `AZURE_CLIENT_ID` | Azure Entra ID client ID | _(empty)_ |
| `AZURE_CLIENT_SECRET` | Azure Entra ID client secret | _(empty)_ |
| `AZURE_TENANT_ID` | Azure Entra ID tenant ID | _(empty)_ |
| `DEFRA_ID_CLIENT_ID` | Defra ID client ID | _(empty)_ |
| `DEFRA_ID_CLIENT_SECRET` | Defra ID client secret | _(empty)_ |
| `DEFRA_ID_DISCOVERY_URL` | Defra ID OIDC base URL (authorize/token/userinfo paths appended) | _(empty)_ |

---

## Local development

Start the app normally (`npm run dev`). With `ENVIRONMENT=local` (the default), stub auth is automatically enabled.

1. Visit any protected route (e.g. `/`) — redirected to `/auth/regulator/login`.
2. That redirects to `/auth/stub/login?type=regulator`.
3. Select a user and click **Log in**.
4. Authenticated and redirected to `/`.

To test as an operator: visit `/auth/operator/login` or use the "Switch to operator login" link.

To log out: visit `/auth/logout`.

---

## Protecting a route

All routes are protected by default via `server.auth.default('session')`. No extra configuration needed.

To make a route **public**, set `options: { auth: false }`:

```javascript
server.route({
  method: 'GET',
  path: '/my-public-route',
  options: { auth: false },
  handler(request, h) {
    return h.view('my-view')
  }
})
```

### Restricting a route to a specific user type

Use the `requireRegulator` or `requireOperator` helpers from `auth-scopes.js`. These use Hapi's built-in scope checking, so a user authenticated with the wrong provider receives a **403 before the controller runs** — no controller-level type checks needed.

```javascript
import { requireRegulator, requireOperator } from '../common/helpers/auth/auth-scopes.js'

// Only regulator users can reach this route — operators get 403
server.route({
  method: 'GET',
  path: '/regulator/dashboard',
  options: requireRegulator,
  handler: dashboardController
})

// Only operator users can reach this route — regulators get 403
server.route({
  method: 'GET',
  path: '/operator/enrol',
  options: requireOperator,
  handler: enrolController
})
```

The helpers can be spread alongside other options:

```javascript
options: { ...requireRegulator, cache: { expiresIn: 5000 } }
```

How it works: every authenticated session carries a `scope` array derived from `userType` (e.g. `['regulator']`). Hapi compares this against the route's required scope before dispatching to the handler — this is the framework's native `server.auth.strategy` scope mechanism, not middleware.

---

## Accessing the authenticated user in a controller

```javascript
import { getUser, isRegulator, isOperator } from '../common/helpers/auth/get-user.js'

export const myController = {
  handler(request, h) {
    const user = getUser(request)
    // user: { id, email, name, userType, roles }

    if (isRegulator(request)) {
      // regulator-specific logic
    }

    if (isOperator(request)) {
      // operator-specific logic
    }

    return h.view('my-view', { user })
  }
}
```

---

## Nunjucks templates

`user` and `userType` are automatically available in all templates:

```njk
{% if user %}
  <p>Hello, {{ user.name }}</p>
  {% if userType == 'regulator' %}
    <p>You are a regulator.</p>
  {% endif %}
{% endif %}
```

---

## Writing tests

### Regular controller tests

The test-bypass scheme (active when `NODE_ENV=test`) auto-authenticates every request as `TEST_REGULATOR` by default. No special setup needed:

```javascript
test('renders the page', async () => {
  const { statusCode } = await server.inject({
    method: 'GET',
    url: '/my-regulator-route'
  })
  expect(statusCode).toBe(200)
})
```

To test an **operator** route, pass the `x-test-user-type` header:

```javascript
import { TEST_OPERATOR } from '../common/helpers/auth/stub-auth-plugin.js'

test('renders operator page', async () => {
  const { statusCode } = await server.inject({
    method: 'GET',
    url: '/my-operator-route',
    headers: { 'x-test-user-type': 'operator' }
  })
  expect(statusCode).toBe(200)
})
```

To assert that a route correctly **rejects** the wrong user type:

```javascript
test('operator cannot access regulator route', async () => {
  const { statusCode } = await server.inject({
    method: 'GET',
    url: '/regulator/dashboard',
    headers: { 'x-test-user-type': 'operator' }
  })
  expect(statusCode).toBe(403)
})
```

### Auth-specific tests

To test the stub login flow directly:

```javascript
test('POST /auth/stub/login sets session and redirects', async () => {
  const { statusCode, headers } = await server.inject({
    method: 'POST',
    url: '/auth/stub/login',
    payload: { userId: 'stub-reg-1', type: 'regulator' }
  })
  expect(statusCode).toBe(302)
  expect(headers.location).toBe('/')
})
```

---

## Adding new stub users

Stub users are defined in `src/server/auth/stub/controller.js`:

```javascript
export const STUB_USERS = {
  regulator: [
    {
      id: 'stub-reg-1',
      name: 'Stub Regulator',
      email: 'regulator@stub.example',
      userType: 'regulator',
      roles: ['admin']
    }
    // Add more regulator users here
  ],
  operator: [
    {
      id: 'stub-op-1',
      name: 'Stub Operator',
      email: 'operator@stub.example',
      userType: 'operator',
      roles: ['user']
    }
    // Add more operator users here
  ]
}
```

Each user must have a unique `id` within its type group.

---

## Session shape

After successful authentication (real or stub), `request.auth.credentials` contains:

```javascript
{
  id: string,
  email: string,
  name: string,
  userType: 'regulator' | 'operator',
  roles: string[]
}
```
