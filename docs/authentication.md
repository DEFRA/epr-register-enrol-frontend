# Authentication

## Overview

The app signs in operators through one OAuth2 / OIDC identity provider:

| Provider     | Users     | Login path             |
| ------------ | --------- | ---------------------- |
| **Defra ID** | Operators | `/auth/operator/login` |

Regulators do not sign in to this service: regulator casework lives in the
Case Management service (`epr-register-enrol-management-fe`). The regulator
landing page, the Azure Entra ID regulator login and the `regulator` user scope
were removed in RA-537.

Route protection is enforced by Hapi's built-in `server.auth.strategy` /
`server.auth.default` mechanism, using a custom `yar-session` scheme
(`src/server/common/helpers/auth/auth-plugin.js`). After a successful OAuth
exchange the user profile is stored in the server-side yar session, and the
scheme reads it back on every subsequent request.

A **stub auth** mode is available for local development and automated tests:

- **Local/dev** (`AUTH_STUB_ENABLED=true`): a login chooser page at `/auth/stub/login` lets you select a fake operator without hitting Defra ID.
- **Tests** (`NODE_ENV=test`): a bypass scheme auto-authenticates every request as `TEST_OPERATOR`. No cookies or sessions are needed.

All application routes are protected by default. The health check and static file routes are explicitly public.

---

## How authentication works

### Route protection

`server.auth.default('session')` in the auth plugin makes every route require a valid session. The `session` strategy is backed by the `yar-session` scheme:

```
request arrives
  → yar-session scheme reads request.yar.get('user')
    → present and not idle: credentials = { ...user, scope: [user.userType] }
    → missing or idle: 401 → redirectToLogin sends a GET to /auth/operator/login
```

No external plugins or middleware are involved in enforcement — this is Hapi's native `server.auth.strategy` mechanism.

### OAuth flow (Defra ID)

```
GET /auth/operator/login
  → generate state, nonce and PKCE verifier, store in yar
  → redirect to the Defra ID authorize endpoint (discovered from DEFRA_ID_DISCOVERY_URL)

GET /auth/operator/callback?code=...&state=...
  → verify state matches the yar-stored value (CSRF protection)
  → POST code to the Defra ID token endpoint → id_token
  → verify the id_token (signature, issuer, audience, nonce)
  → request.yar.reset(), then request.yar.set('user', profile)
  → redirect to the stashed post-login target, or /
```

---

## Environment variables

| Variable                 | Description                                                                                                                                                                                                                                                           | Default                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `ENVIRONMENT`            | Deployment environment (`local`, `dev`, `test`, `perf-test`, `ext-test`, `infra-dev`, `management`, `prod`)                                                                                                                                                           | `local`                 |
| `AUTH_STUB_ENABLED`      | Enable stub auth. Defaults `true` when `ENVIRONMENT != prod`                                                                                                                                                                                                          | `true`                  |
| `AUTH_CALLBACK_BASE_URL` | Base URL used to construct OAuth callback redirect URIs                                                                                                                                                                                                               | `http://localhost:3000` |
| `DEFRA_ID_CLIENT_ID`     | Defra ID application (client) ID                                                                                                                                                                                                                                      | _(empty)_               |
| `DEFRA_ID_CLIENT_SECRET` | Defra ID client secret                                                                                                                                                                                                                                                | _(empty)_               |
| `DEFRA_ID_SERVICE_ID`    | Defra ID service ID provided during onboarding                                                                                                                                                                                                                        | _(empty)_               |
| `DEFRA_ID_DISCOVERY_URL` | Full OIDC metadata URL for Defra ID. The app fetches this on first use to discover `authorization_endpoint` and `token_endpoint`. e.g. CPDEV: `https://your-account.cpdev.cui.defra.gov.uk/idphub/b2c/b2c_1a_cui_cpdev_signupsignin/.well-known/openid-configuration` | _(empty)_               |

---

## Local development

Copy `.env.example` to `.env` and run `npm run dev`. With `ENVIRONMENT=local` (the default), stub auth is automatically enabled. The dev server loads `.env` automatically via `--env-file-if-exists`.

1. Visit any protected route (e.g. `/`) — redirected to `/auth/operator/login`.
2. That redirects to `/auth/stub/login?type=operator`.
3. Select a user and click **Log in**.
4. Authenticated and redirected to `/`.

To log out: visit `/auth/logout`.

### Using Defra ID in dev

When `AUTH_STUB_ENABLED=true`, you can optionally authenticate against the real Defra ID alongside the stub chooser by setting `DEFRA_ID_CLIENT_ID`, `DEFRA_ID_CLIENT_SECRET`, `DEFRA_ID_DISCOVERY_URL` and `DEFRA_ID_SERVICE_ID` in `.env`. A **Sign in with Defra ID** button then appears on the stub chooser and starts the real OAuth flow. Stub users are still available if you don't set the credentials.

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

### Restricting a route to operators

Use the `requireOperator` helper from `auth-scopes.js`. It uses Hapi's built-in scope checking, so a session without the `operator` scope receives a **403 before the controller runs** — no controller-level type checks needed.

```javascript
import { requireOperator } from '../common/helpers/auth/auth-scopes.js'

server.route({
  method: 'GET',
  path: '/operator/enrol',
  options: requireOperator,
  handler: enrolController
})
```

The helper can be spread alongside other options:

```javascript
options: { ...requireOperator, cache: { expiresIn: 5000 } }
```

How it works: every authenticated session carries a `scope` array derived from `userType` (`['operator']`). Hapi compares this against the route's required scope before dispatching to the handler — this is the framework's native `server.auth.strategy` scope mechanism, not middleware.

---

## Accessing the authenticated user in a controller

```javascript
import { getUser, isOperator } from '../common/helpers/auth/get-user.js'

export const myController = {
  handler(request, h) {
    const user = getUser(request)
    // user: { id, email, name, userType, roles, ... }

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
{% endif %}
```

---

## Writing tests

### Regular controller tests

The test-bypass scheme (active when `NODE_ENV=test`) auto-authenticates every request as `TEST_OPERATOR`. No special setup needed:

```javascript
test('renders the page', async () => {
  const { statusCode } = await server.inject({
    method: 'GET',
    url: '/my-operator-route'
  })
  expect(statusCode).toBe(200)
})
```

### Auth-specific tests

To test the stub login flow directly:

```javascript
test('POST /auth/stub/login sets session and redirects', async () => {
  const { statusCode, headers } = await server.inject({
    method: 'POST',
    url: '/auth/stub/login',
    payload: { userId: 'stub-op-1', type: 'operator' }
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
  operator: [
    {
      id: 'stub-op-1',
      name: 'Stub Operator',
      email: 'test@defra.gov.uk',
      userType: 'operator',
      roles: ['user'],
      currentRelationshipId: STUB_OPERATOR_CURRENT_RELATIONSHIP_ID,
      relationships: STUB_OPERATOR_RELATIONSHIPS
    }
    // Add more operator users here
  ]
}
```

Each user must have a unique `id`.

---

## Session shape

After successful authentication (Defra ID or stub), `request.auth.credentials` contains:

```javascript
{
  id: string,
  email: string,
  name: string,
  userType: 'operator',
  roles: string[],
  currentRelationshipId: string,
  relationships: string[],
  scope: ['operator']
}
```
