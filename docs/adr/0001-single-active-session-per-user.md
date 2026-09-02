# ADR-0001: Single active session per user identity

**Date:** 2026-09-02
**Status:** Proposed
**Issue:** RA-462 — Concurrent logins allowed; logging in again doesn't invalidate the prior session

## Context

Both externally-facing Hapi apps (`epr-register-enrol-frontend` for operators +
regulators, `epr-register-enrol-management-fe` for caseworkers) authenticate via
OAuth2/OIDC and persist the authenticated user in an `@hapi/yar` session.

On a successful login the OAuth callback controllers — and the stub-login
controller used in dev/test — call `request.yar.reset()` before storing the
`user`. `reset()` only affects **the session bound to the current request**: it
drops that one server-side cache entry and mints a fresh session id (this was
added as session-fixation defence, M3 in the 2026-08-08 pentest report). It does
**nothing** to any other session that already exists for the same identity — a
cookie held by another browser or device keeps its own id and its own cache
entry and stays valid.

There is currently no index from user identity to active session, so:

- A user can hold an unbounded number of simultaneously valid sessions.
- A leaked/stolen session cookie keeps working in parallel with the legitimate
  user's own session, and re-authenticating (the natural user response to
  "something looks wrong") does not shut the attacker out.
- The legitimate user gets no signal that a second login occurred.

Severity Low / Priority Medium, but it undermines credential-compromise
recovery, which is the reason to address it.

### Forces

- **Security** wants a fresh login to be a clean slate — one identity, one live
  session, old sessions dead.
- **UX**: some users legitimately work across two browsers/devices. A
  single-active-session policy will sign them out of the first when they log in
  on the second. This is the accepted GOV.UK pattern for services handling
  regulated data, but it is a behaviour change and must be a conscious product
  decision.
- **Operational**: enforcement must work with the session store as deployed —
  Redis (`@hapi/catbox-redis`) in every real environment, in-memory catbox
  locally. It must not add a hard dependency on anything new.
- **Blast radius**: the check runs on every authenticated request, so it must be
  a single fast cache read and must fail safe (store unavailable ⇒ do not lock
  everyone out).

## Decision

Adopt **single-active-session-per-user**: establishing a new authenticated
session for an identity invalidates every previously-issued session for that
same identity. The superseded session's next request is treated as
unauthenticated and redirected to login.

Rejected alternative — **allow concurrent sessions with a "new login detected"
notification**: weaker security outcome (the old session, possibly the
attacker's, stays live), and needs a user-facing notification surface and a
delivery channel this service does not have. Revisit only if product rejects the
sign-out behaviour.

### Mechanism (summary; full design in `docs/RA-462-concurrent-logins-design.md`)

1. A server-side **active-session registry**: a dedicated catbox segment on the
   existing session cache mapping `userId → { sessionId, loginAt }`. Same
   Redis/memory engine as yar; no new infrastructure.
2. On every successful login (real OAuth callbacks + stub login), **after**
   `request.yar.reset()` and `request.yar.set('user', ...)`, write
   `registry[user.id] = { sessionId: request.yar.id, loginAt: Date.now() }`.
   This overwrites the previous entry, so the earlier session's id stops being
   the registered one.
3. In the shared `yar-session` authentication scheme
   (`yarSessionAuthenticate`), after loading `user`, read the registry entry for
   `user.id`. If it is missing or its `sessionId !== request.yar.id`, the
   session has been superseded: `request.yar.reset()` and return
   `h.unauthenticated(...)`. The existing `redirectToLogin` `onPreResponse`
   extension already turns that into a redirect to the correct login page.
4. Logout drops `registry[user.id]`.
5. **Fail-open on store errors**: if the registry read throws or the cache is not
   ready, log and allow the request (falls back to today's behaviour) rather
   than signing out every user. The registry write on login is best-effort for
   the same reason.

`epr-register-enrol-management-fe` needs the same registry plus a per-request
revalidation step added to its `yar-session` scheme, which today does no session
revalidation at all (the RA-461 idle-timeout check was never ported there).

## Consequences

### Positive

- A fresh login for an identity reliably kills all prior sessions for that
  identity, including ones on other devices — the RA-462 acceptance criterion.
- Credential-compromise recovery works: the user re-authenticating evicts the
  attacker's session.
- Enforcement lives in one shared scheme function per app, so the real-OAuth and
  stub paths cannot drift.
- No new infrastructure — reuses the deployed session cache.

### Negative

- Users working in two browsers/devices as the same identity are signed out of
  the older one on each new login. Product/security must accept this.
- One extra cache round-trip per authenticated request (single key GET;
  negligible against Redis, and the request already reads/writes the yar
  session).
- A registry entry lost (Redis eviction/flush) logs the user out early on their
  next request even though their session is otherwise valid — acceptable
  (fail-closed on _missing_ entry) but worth watching in the first environments.

### Neutral

- The registry entry's TTL is set to the absolute session TTL
  (`session.cache.ttl`), so entries self-expire in step with sessions.
- No change to token/refresh handling or to the federated-logout flow beyond the
  one registry `drop` on logout.
- `x-test-user-*` bypass schemes (`NODE_ENV=test`) are unaffected — they never
  touch yar sessions.
