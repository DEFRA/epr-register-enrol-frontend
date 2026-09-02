# RA-462 — Concurrent logins: implementation design

**Status:** Design only — enforcement NOT implemented pending product/security
sign-off on the policy (see `docs/adr/0001-single-active-session-per-user.md`).
**Branch:** `feature/RA-462-ConcurrentLogins`

This document is the implementation plan for the frontend app. The
`epr-register-enrol-management-fe` repo has its own copy with the caseworker-app
deltas. E2E coverage is specced in `epr-register-enrol-fe-tests` and
`epr-register-enrol-mgmt-tests`.

---

## 1. Problem recap

`src/server/auth/controller.js` — `operatorCallbackController` and
`regulatorCallbackController` — call `request.yar.reset()` before
`request.yar.set('user', ...)`. Same in `src/server/auth/stub/controller.js`
(`stubLoginPostController`).

`yar.reset()` (`node_modules/@hapi/yar/lib/index.js`):

```js
reset() {
  this._cache.drop(this.id);          // drops THIS session's cache entry
  this.id = this._generateSessionID(); // new id for THIS request
  this._store = {};
}
```

It is scoped to the current request's session. A session created earlier in a
different browser has a different cookie, a different `yar.id`, and a different
cache entry — none of which `reset()` can see. Result: N concurrent valid
sessions per identity, and re-login does not evict the others.

Session store as deployed: `@hapi/yar` with `maxCookieSize: 0`
(`src/server/common/helpers/session-cache/session-cache.js`) ⇒ **always**
server-side. Engine is `@hapi/catbox-redis` in every real environment,
`@hapi/catbox-memory` locally (`src/server/common/helpers/session-cache/cache-engine.js`).
Cache name `session`, TTL `session.cache.ttl` (default 4h). The server also
registers this cache by name in `src/server/server.js` (`cache: [{ name, engine }]`).

## 2. Policy

Single active session per user identity. New login ⇒ prior sessions for that
identity become invalid; their next request redirects to login. Rationale and
the rejected alternative are in the ADR.

## 3. Design

### 3.1 Active-session registry helper

New file: `src/server/common/helpers/auth/active-session-registry.js`

- Backed by `server.cache({ segment: 'active-sessions', expiresIn: session.cache.ttl })`
  — a distinct **segment** on the already-configured `session` cache. Reuses the
  Redis/memory engine; no new client, no new config.
- Obtain the policy once at plugin-registration time and stash it on
  `server.app.activeSessionRegistry` so the shared scheme function can reach it
  via `request.server.app.activeSessionRegistry`.
- API:

  | Function                              | Behaviour                                                                                                                                                                                                                                              |
  | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `register(cache)`                     | `cache.set(userId, { sessionId, loginAt }, ttl)`. Best-effort: caught + logged, never throws.                                                                                                                                                          |
  | `isCurrent(cache, userId, sessionId)` | `cache.get(userId)` → `true` if entry exists and `entry.sessionId === sessionId`. **Missing entry ⇒ `false` (fail-closed on absence).** Store error / not-ready ⇒ return a sentinel that the caller treats as "skip enforcement" (fail-open on error). |
  | `revoke(cache, userId)`               | `cache.drop(userId)`. Best-effort.                                                                                                                                                                                                                     |

  Keep the fail-open vs fail-closed split explicit and unit-tested: **absent
  entry** logs the user out (that is the whole point — a superseded session's
  entry has been overwritten, not deleted, so "absent" only happens on
  eviction/flush and erring toward re-login is acceptable); **store throw / not
  ready** must not.

### 3.2 Write on login

In all three login completion points, immediately after the existing
`request.yar.reset()` + `request.yar.set('user', user)`:

```js
await registerActiveSession(request, user.id) // wraps server.app... + logs on failure
```

Call sites:

- `src/server/auth/controller.js` → `regulatorCallbackController` (~line 218–224)
- `src/server/auth/controller.js` → `operatorCallbackController` (~line 325–330)
- `src/server/auth/stub/controller.js` → `stubLoginPostController` (~line 133–135)

`user.id` is `claims.oid ?? claims.sub` (regulator), `claims.sub` (operator),
`STUB_USERS[*].id` (stub) — all stable per identity.

### 3.3 Enforce on every authenticated request

`src/server/common/helpers/auth/session-idle-timeout.js` →
`yarSessionAuthenticate(request, h)`. This function is the `authenticate` for the
`yar-session` scheme in **both** `auth-plugin.js` (real OAuth) and
`stub-auth-plugin.js` (dev branch), so one change covers both paths. The
`test-bypass` scheme (`NODE_ENV=test`) does not call it and is unaffected.

Add, after the `user` lookup and before / alongside the existing idle check:

```js
const registry = request.server.app.activeSessionRegistry
const status = await isCurrentSession(registry, user.id, request.yar.id)
if (status === SUPERSEDED) {
  request.yar.reset()
  return h.unauthenticated(Boom.unauthorized(null, 'session'))
}
// status === OK or status === SKIP (store error) → fall through
```

`redirectToLogin` (`onPreResponse`, registered by both auth plugins) already
converts the `Boom.unauthorized(null, 'session')` into a 302 to the right login
page and stashes the post-login redirect (RA-403). No change needed there.

Ordering note: keep this check next to the idle-timeout check. Both end in the
same `request.yar.reset()` + `h.unauthenticated` shape; factor the shared tail
if it reads cleanly.

### 3.4 Revoke on logout

`src/server/auth/controller.js` → `logoutController`. Before the first
`request.yar.reset()` (need `user.id` while it is still readable):

```js
const user = request.yar.get('user')
if (user?.id) await revokeActiveSession(request, user.id)
```

Covers both the `!idToken` local-logout branch and the federated-logout branch
(the second, post-IdP pass has no `user` and is a no-op).

### 3.5 Config

No new env vars required for v1. Optionally add a kill-switch
`SESSION_SINGLE_ACTIVE_ENABLED` (default `true`) so the enforcement can be
disabled in an environment without a redeploy of code if it misbehaves — mirrors
the `REGULATOR_ACCESS_DISABLED` pattern. Decide at implementation time; the ADR
does not mandate it.

## 4. Files to change

| File                                                                    | Change                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/common/helpers/auth/active-session-registry.js`             | **New.** Registry helper (§3.1).                                                                                                                                                                       |
| `src/server/common/helpers/auth/active-session-registry.test.js`        | **New.** Unit tests for register/isCurrent/revoke incl. fail-open vs fail-closed.                                                                                                                      |
| `src/server/common/helpers/auth/session-idle-timeout.js`                | Add supersede check to `yarSessionAuthenticate` (§3.3).                                                                                                                                                |
| `src/server/common/helpers/auth/session-idle-timeout.test.js`           | New cases: current session passes; superseded session → unauthenticated + `yar.reset`; store error → passes.                                                                                           |
| `src/server/auth/controller.js`                                         | Registry write in both callbacks (§3.2); registry revoke in `logoutController` (§3.4).                                                                                                                 |
| `src/server/auth/controller.test.js` / `controller.unit.test.js`        | Assert registry write happens after `yar.reset` on login; revoke on logout.                                                                                                                            |
| `src/server/auth/stub/controller.js`                                    | Registry write in `stubLoginPostController` (§3.2).                                                                                                                                                    |
| `src/server/auth/stub/controller.test.js` (or equivalent)               | Assert registry write on stub login.                                                                                                                                                                   |
| `src/server/server.js` **or** a tiny plugin                             | Create `server.cache({ segment: 'active-sessions', ... })` and expose it on `server.app.activeSessionRegistry`. Prefer a 10-line plugin registered right after `sessionCache` so ordering is explicit. |
| `src/server/common/helpers/auth/auth-plugin.js` / `stub-auth-plugin.js` | No change if the registry is on `server.app`; the scheme reads it via `request.server.app`.                                                                                                            |
| `docs/authentication.md`                                                | Add a "Single active session" subsection.                                                                                                                                                              |
| `docs/adr/0001-single-active-session-per-user.md`                       | Flip **Status** to Accepted once signed off.                                                                                                                                                           |

## 5. Test plan (unit / integration — this repo)

1. **New login supersedes prior session (integration).** `server.inject` login
   as user A → capture cookie C1. Login again as user A → capture cookie C2.
   Request a protected route with C1 → 302 to login. With C2 → 200.
2. **Idle + supersede independence.** Superseded check fires even when the
   session is not idle; idle check still fires when the session _is_ current.
3. **Fail-open on store error.** Stub the registry `get` to throw → protected
   request with a valid current session still returns 200 (logged, not locked
   out).
4. **Logout revokes.** Login → logout → registry entry for that `user.id` is
   gone.
5. **Stub login writes registry** with `sessionId === new yar.id` (post-reset).
6. **Registry write is post-reset.** Assert order so the stored id is the fresh
   one, not the pre-login id.
7. `NODE_ENV=test` bypass path unaffected — existing suite stays green.

## 6. Manual verification (EXT-TEST)

Per the issue AC:

1. Log in as the same operator in Browser A and Browser B.
2. Confirm Browser B is authenticated.
3. In Browser A, navigate to any protected page → redirected to operator login
   (Browser A's session is dead).
4. Repeat for a regulator identity via Entra ID.
5. Confirm normal single-browser login/logout is unchanged and that an idle
   session still times out at 20 min.

## 7. Out of scope

- Showing the user a list of / actively terminating their other devices.
- Any "notify on new login" channel.
- Back-end (`epr-register-enrol-backend`) — stateless, token-checked, no session.
