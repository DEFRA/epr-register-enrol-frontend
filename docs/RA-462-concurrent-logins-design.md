# RA-462 — Concurrent logins: implementation design

**Status:** Implemented on `feature/RA-462-ConcurrentLogins` (2026-09-04).
Policy chosen by product on 2026-09-02: **allow concurrent sessions, notify the
user** (see `docs/adr/0001-single-active-session-per-user.md`). The ADR stays
**Proposed** pending security's acknowledgement of the "no forced sign-out"
trade-off; the code is behind the `SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED`
flag (default on).
**Branch:** `feature/RA-462-ConcurrentLogins`

Implementation delta from the plan below: the registry helper and the
`onPostAuth` extension live together in one module
(`src/server/common/helpers/auth/concurrent-login.js`, registered as the
`concurrentLoginPlugin` in `server.js`) rather than three separate files; the
component is plain notification-banner markup (not the govuk macro); everything
else matches.

This is the plan for the frontend app. `epr-register-enrol-management-fe` has its
own copy with caseworker-app deltas. E2E coverage is specced in
`epr-register-enrol-fe-tests` and `epr-register-enrol-mgmt-tests`.

---

## 1. Problem recap

`src/server/auth/controller.js` — `operatorCallbackController` and
`regulatorCallbackController` — call `request.yar.reset()` before
`request.yar.set('user', ...)`. Same in `src/server/auth/stub/controller.js`
(`stubLoginPostController`). `yar.reset()` is scoped to the current request's
session: a session created earlier in another browser has its own cookie,
`yar.id` and cache entry, none of which `reset()` touches. Concurrent sessions
per identity are therefore possible and **the user is never told** a second
sign-in happened.

Session store as deployed: `@hapi/yar` with `maxCookieSize: 0`
(`src/server/common/helpers/session-cache/session-cache.js`) ⇒ always
server-side. Engine `@hapi/catbox-redis` in every real environment,
`@hapi/catbox-memory` locally
(`src/server/common/helpers/session-cache/cache-engine.js`). Cache name
`session`, TTL `session.cache.ttl` (default 4h); the server registers it by name
in `src/server/server.js`.

## 2. Policy

Concurrent sessions stay valid. A new login for an identity raises a
**non-blocking notification** on that identity's sessions:

| Recipient                                      | Variant   | Copy (en)                                                                                                            | Lifetime                                                                     |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Session(s) already active before the new login | **alert** | "A new sign-in to your account was detected at HH:MM on D Month. If this was not you, sign out and contact support." | From its next request until dismissed, or until a newer sign-in replaces it. |
| The session that just logged in                | **info**  | "You were already signed in on another browser or device."                                                           | From login until dismissed.                                                  |

No `yar.reset()`, no `unauthenticated`. Rationale + rejected alternative
(single-active-session) in the ADR.

## 3. Design

### 3.1 Session stamp

At each login completion, in addition to `request.yar.set('user', user)`:

```js
request.yar.set('loginAt', Date.now())
```

Call sites: `regulatorCallbackController`, `operatorCallbackController`
(`src/server/auth/controller.js`), `stubLoginPostController`
(`src/server/auth/stub/controller.js`).

### 3.2 Active-session registry helper

New: `src/server/common/helpers/auth/active-session-registry.js` (+ `.test.js`)

- Cache handle: `server.cache({ segment: 'active-sessions', expiresIn: config.get('session.cache.ttl') })`
  — a distinct **segment** on the already-configured `session` cache. Reuses the
  Redis/memory engine; no new client, no new config. Exposed on
  `server.app.activeSessionRegistry` by a ~10-line plugin registered right after
  `sessionCache` in `src/server/server.js`.
- Entry shape, keyed by `userId`: `{ lastLoginAt: number, lastLoginSessionId: string }`.
- API (all best-effort — catch, log, never throw; a throw ⇒ caller behaves as if
  there were no entry, i.e. no toast):

  | Function                                | Behaviour                                                                                                                                                                                                   |
  | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `recordLogin(cache, userId, sessionId)` | Returns the **previous** entry (or `null`), then `cache.set(userId, { lastLoginAt: Date.now(), lastLoginSessionId: sessionId }, ttl)`. The return value is what the callback uses to decide the Info toast. |
  | `getLatest(cache, userId)`              | `cache.get(userId)` → entry or `null`.                                                                                                                                                                      |
  | `clear(cache, userId)`                  | `cache.drop(userId)`. Called on logout.                                                                                                                                                                     |

### 3.3 On login — set the Info flag, update the registry

In each callback + stub login, immediately after `request.yar.reset()` +
`request.yar.set('user', user)` + `request.yar.set('loginAt', ...)`:

```js
const previous = await recordLogin(registry, user.id, request.yar.id)
if (previous && previous.lastLoginSessionId !== request.yar.id) {
  request.yar.set('concurrentLoginInfo', { otherLoginAt: previous.lastLoginAt })
}
```

`user.id`: `claims.oid ?? claims.sub` (regulator), `claims.sub` (operator),
`STUB_USERS[*].id` (stub).

### 3.4 On every authenticated request — compute the notice

New `onPostAuth` server extension, registered by the auth plugins
(`auth-plugin.js` real-OAuth + `stub-auth-plugin.js` dev branch — the
`test-bypass` scheme is intentionally excluded). Keeps
`yarSessionAuthenticate` focused on auth; mirrors how `applicationHeader` is
attached to `request.app` elsewhere.

```js
// onPostAuth
if (!request.auth.isAuthenticated) return h.continue
const user = request.auth.credentials
const sessionLoginAt = request.yar.get('loginAt') ?? 0
const dismissedFor = request.yar.get('noticeDismissedFor') ?? 0

// Info toast (this session logged in while another already existed)
const info = request.yar.get('concurrentLoginInfo')
if (info && info.otherLoginAt > dismissedFor) {
  request.app.concurrentLoginNotice = {
    variant: 'info',
    otherLoginAt: info.otherLoginAt
  }
  return h.continue
}

// Alert toast (a newer login for this identity exists elsewhere)
const latest = await getLatest(registry, user.id) // best-effort; null on error
if (
  latest &&
  latest.lastLoginSessionId !== request.yar.id &&
  latest.lastLoginAt > sessionLoginAt &&
  latest.lastLoginAt > dismissedFor
) {
  request.app.concurrentLoginNotice = {
    variant: 'alert',
    otherLoginAt: latest.lastLoginAt
  }
}
return h.continue
```

### 3.5 Render the toast

- `src/config/nunjucks/context/context.js` — add
  `concurrentLoginNotice: request.app?.concurrentLoginNotice ?? null` (sits next
  to the existing `applicationHeader: request.app?.applicationHeader ?? null`).
- New component `src/server/common/components/session-notice/` — `template.njk`
  - `_session-notice.scss`, included near the top of the content block in
    `src/server/common/templates/layouts/page.njk` when `concurrentLoginNotice`.
- **Server-side markup is a GOV.UK notification banner** (`govuk-notification-banner`,
  `--success` styling not used; default "Important" for `alert`, a plain banner
  for `info`) containing the copy, a formatted local time, a link to
  `/auth/logout` for the `alert` variant, and a "Hide" control that is a
  `<form method="post" action="/auth/session-notice/dismiss">` button (crumb
  field included) — works with no JavaScript.
- **Progressive enhancement** `src/client/javascripts/session-notice.js` (import
  from `application.js`): on load, if the banner is present, move it into a
  fixed-position toast container, set `role="alert"` (alert) / `role="status"`
  (info) + `aria-live`, focus the toast, wire the close button to `preventDefault`
  - `fetch('/auth/session-notice/dismiss', { method: 'POST', headers: { 'x-csrf-token': crumb } })`
    then remove the node, and bind Escape. If `fetch` fails, fall back to a normal
    form submit.
- Styles in `src/client/stylesheets/components/` (add to `_index.scss`). Respect
  `prefers-reduced-motion`; ensure contrast; toast must not trap focus or
  obscure the skip link.
- Copy: `src/locales/{en,cy}/translation.json` under
  `components.sessionNotice.{alert,info,hide,signOut}`.

### 3.6 Dismissal route

New route module `src/server/auth/session-notice/` (`index.js` + `controller.js`):

- `POST /auth/session-notice/dismiss`, auth required, crumb enforced (default).
- Handler: `request.yar.set('noticeDismissedFor', <the otherLoginAt currently in
request.app.concurrentLoginNotice, recomputed>)`, `request.yar.clear('concurrentLoginInfo')`,
  then `h.redirect(back)` for the no-JS form post / `h.response().code(204)` for
  the fetch. Determine JS vs no-JS by `Accept` header or an explicit `?js=1`.
- Recompute the dismiss target server-side (read the registry again) rather than
  trusting a value posted by the client.

### 3.7 Config

Add `SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED` (Boolean, default `true`) —
env-switchable kill-switch, mirroring `REGULATOR_ACCESS_DISABLED`. When `false`:
the `onPostAuth` extension returns immediately and `recordLogin` still runs (so
turning it back on works without a gap).

## 4. Files to change

| File                                                                                 | Change                                                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/server/common/helpers/auth/active-session-registry.js` (+ `.test.js`)           | **New.** Registry helper (§3.2).                                                                                              |
| `src/server/common/helpers/auth/concurrent-login-notice.js` (+ `.test.js`)           | **New.** The `onPostAuth` handler (§3.4), unit-tested in isolation.                                                           |
| `src/server/auth/controller.js`                                                      | `loginAt` stamp + `recordLogin` + Info flag in both callbacks (§3.1, §3.3); `clear(registry, user.id)` in `logoutController`. |
| `src/server/auth/stub/controller.js`                                                 | Same stamp + `recordLogin` + Info flag in `stubLoginPostController`.                                                          |
| `src/server/auth/controller.test.js` / `controller.unit.test.js`                     | Assert stamp + registry write after `yar.reset`; Info flag set only when a prior entry exists; registry cleared on logout.    |
| `src/server/auth/session-notice/index.js` + `controller.js` (+ `controller.test.js`) | **New.** Dismissal route (§3.6).                                                                                              |
| `src/server/common/helpers/auth/auth-plugin.js` / `stub-auth-plugin.js`              | Register the `onPostAuth` extension (dev + real branches only).                                                               |
| `src/server/server.js` / small plugin                                                | `server.cache({ segment: 'active-sessions', ... })` → `server.app.activeSessionRegistry`.                                     |
| `src/config/nunjucks/context/context.js` (+ `context.test.js`)                       | Surface `concurrentLoginNotice`.                                                                                              |
| `src/server/common/components/session-notice/template.njk` + `.scss`                 | **New.** Banner markup.                                                                                                       |
| `src/server/common/templates/layouts/page.njk`                                       | Include the component when `concurrentLoginNotice`.                                                                           |
| `src/client/javascripts/session-notice.js` (+ `.test.js`)                            | **New.** Toast progressive enhancement; imported by `application.js`.                                                         |
| `src/client/stylesheets/components/_session-notice.scss` + `_index.scss`             | **New** styles.                                                                                                               |
| `src/locales/en/translation.json`, `src/locales/cy/translation.json`                 | Toast copy (both variants, Hide, Sign out).                                                                                   |
| `src/config/config.js`                                                               | `SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED`.                                                                                    |
| `docs/authentication.md`                                                             | New "Concurrent-login notification" section.                                                                                  |
| `docs/adr/0001-single-active-session-per-user.md`                                    | Flip **Status** to Accepted on sign-off.                                                                                      |

## 5. Test plan (unit / integration — this repo)

1. **Alert on the older session.** `server.inject` login as user A → cookie C1.
   Login again as A → cookie C2. Request a protected page with C1 → 200 **and**
   the response body contains the notification banner with the alert copy. With
   C2 → 200, no alert banner.
2. **Info on the newer session.** With C2 (from step 1) the first render shows
   the info banner; C1's first login (no prior entry) never showed one.
3. **Dismissal sticks.** `POST /auth/session-notice/dismiss` with C1 → 302/204;
   subsequent C1 requests show no banner — until a _third_ login (C3) bumps
   `lastLoginAt` past `noticeDismissedFor`, which re-shows the alert.
4. **No forced logout.** After step 1, C1 can still POST/GET protected actions —
   only the banner is added, status is never 302-to-login.
5. **Fail open.** Stub the registry `get` to throw → protected request with C1
   still 200 and **no** banner.
6. **Kill switch.** `SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED=false` → no banner
   even with C1/C2 as in step 1; `recordLogin` still writes.
7. **Context unit test.** `context()` surfaces `request.app.concurrentLoginNotice`.
8. **Client unit test.** `session-notice.js` lifts a present banner into a toast,
   sets the right role, POSTs on close, falls back to form submit on `fetch`
   rejection, dismisses on Escape.
9. `NODE_ENV=test` bypass path unaffected — existing suite stays green.

## 6. Manual verification (EXT-TEST)

1. Log in as the same operator in Browser A, then Browser B.
2. Browser B shows the info toast on its first page; dismiss it, reload → gone.
3. In Browser A, load any page → alert toast with Browser B's sign-in time and a
   "sign out" link. Both sessions remain usable.
4. Dismiss in Browser A; navigate → gone. Log in a third time (Browser C) → the
   alert re-appears in A and B.
5. With JavaScript disabled: the banner renders in-flow and the "Hide" link
   dismisses it via a full-page POST.
6. Repeat for a regulator identity via Entra ID.
7. Screen-reader pass on both variants (NVDA + VoiceOver): the toast is
   announced once, the close control is reachable, focus is not trapped.

## 7. Out of scope (candidate follow-ups)

- A real "sign out all other sessions" action (needs a per-user
  `sessionsValidFrom` revocation stamp checked in `yarSessionAuthenticate` —
  this is the single-active-session machinery, kept in reserve).
- Showing a device/location list.
- Email/notify-channel alerting on new sign-in.
- `epr-register-enrol-backend` — stateless, token-checked, no session.
