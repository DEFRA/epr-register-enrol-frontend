# ADR-0001: Concurrent sessions allowed, with a new-sign-in notification

**Date:** 2026-09-02
**Status:** Proposed
**Issue:** RA-462 — Concurrent logins allowed; logging in again doesn't invalidate the prior session

> Supersedes the earlier draft of this ADR, which proposed
> single-active-session-per-user enforcement. Product chose the
> allow-concurrent-with-notification option instead (2026-09-02); the file name
> is kept for link stability.

## Context

Both externally-facing Hapi apps (`epr-register-enrol-frontend` for operators +
regulators, `epr-register-enrol-management-fe` for caseworkers) authenticate via
OAuth2/OIDC and persist the authenticated user in an `@hapi/yar` session.

On a successful login the OAuth callback controllers — and the stub-login
controller used in dev/test — call `request.yar.reset()` before storing the
`user`. `reset()` only affects **the session bound to the current request**: it
drops that one server-side cache entry and mints a fresh session id (session
fixation defence, M3 in the 2026-08-08 pentest report). It does **nothing** to
any other session that already exists for the same identity — a cookie held by
another browser or device keeps its own id and its own cache entry and stays
valid.

There is currently no index from user identity to session, so:

- A user can hold any number of simultaneously valid sessions.
- A leaked/stolen session cookie keeps working in parallel with the legitimate
  user's own session.
- **The legitimate user gets no signal that a second login occurred** — this is
  the part RA-462 asks us to fix.

Severity Low / Priority Medium.

### Forces

- **Security** wants the user to _notice_ a sign-in they did not perform, so a
  credential compromise is caught by the human even though the service does not
  forcibly end the other session.
- **UX / product** explicitly want concurrent sessions to keep working — users
  legitimately move between browsers and devices — so a forced sign-out on the
  older session (the rejected single-active-session option) is not acceptable.
- **GDS**: any on-page messaging must be accessible and must degrade without
  JavaScript.
- **Operational**: detection must work with the session store as deployed —
  Redis (`@hapi/catbox-redis`) in every real environment, in-memory catbox
  locally — and add no new infrastructure. The per-request check must be a
  single fast cache read and must fail open (store unavailable ⇒ no false
  alarms, no lock-outs).

## Decision

**Allow concurrent sessions. When a new session is established for an identity,
surface a non-blocking notification to that identity's sessions.**

No session is invalidated. Both sides are told:

| Session                         | Notification                                                                                                                     | Trigger                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| The session(s) already active   | **Alert** — "A new sign-in to your account was detected at HH:MM on D Month. If this was not you, sign out and contact support." | On its next authenticated request after the new login. |
| The session that just logged in | **Info** — "You were already signed in on another browser or device."                                                            | Rendered from login until dismissed.                   |

Presentation: a **floating dismissible toast** (progressive enhancement). Without
JavaScript it renders as an in-flow GOV.UK notification banner with a "Hide"
link; with JavaScript it is lifted into a toast with `role="alert"` /
`aria-live`, a focusable close control, and Escape-to-dismiss. Dismissal is
recorded server-side (in the session) so it does not reappear until a
_still-newer_ sign-in occurs.

Rejected alternative — **single-active-session-per-user** (force-invalidate prior
sessions): product rejected the resulting sign-out of legitimate multi-device
users. The registry machinery below is a subset of what that option needed, so
it remains a low-cost path if the position changes.

### Mechanism (summary; full design in `docs/RA-462-concurrent-logins-design.md`)

1. **Session stamp.** At login, store `loginAt` (ms) on the yar session
   alongside `user`.
2. **Registry.** A dedicated catbox segment on the existing `session` cache,
   keyed by `userId`, holding `{ lastLoginAt, lastLoginSessionId }` (the most
   recent login for that identity). TTL = the absolute session TTL, so entries
   self-expire in step with sessions. Same Redis/memory engine as yar; no new
   infrastructure.
3. **On login**, in each callback + stub login, **before** overwriting the
   registry: read the existing entry. If one exists, is still within TTL, and
   its `lastLoginSessionId` differs — a prior session exists — stash a one-shot
   `concurrentLoginInfo` flag on the _new_ session (drives the Info toast).
   Then write `{ lastLoginAt: now, lastLoginSessionId: request.yar.id }`.
4. **On every authenticated request** (shared `yar-session` scheme), read the
   registry entry for `user.id`. If `lastLoginAt > session.loginAt` and
   `lastLoginSessionId !== request.yar.id`, and the user has not already
   dismissed the notice for this `lastLoginAt`, set a view-context flag that
   drives the Alert toast. **No `yar.reset()`, no `unauthenticated` — the
   session continues.**
5. **Dismissal.** A small `POST /auth/session-notice/dismiss` (auth + crumb)
   records `noticeDismissedFor = lastLoginAt` on the session (and clears
   `concurrentLoginInfo`). The no-JS "Hide" link posts the same.
6. **Fail open.** Any registry read/write error is logged and swallowed — no
   toast, session unaffected.

`epr-register-enrol-management-fe` needs the same registry and a per-request
hook; its `yar-session` scheme currently does no per-request revalidation at all
(the RA-461 idle-timeout check was never ported there), so the check lands in a
new shared scheme function or an `onPostAuth` extension.

## Consequences

### Positive

- The legitimate user sees an unmissable, accessible signal that a second
  sign-in happened — the RA-462 acceptance criterion, without changing session
  lifetimes.
- Multi-device / multi-browser use is completely unaffected.
- No new infrastructure; one shared code path per app so real-OAuth and stub
  logins cannot drift.
- The registry is a stepping stone to full single-active-session enforcement or
  a "sign out all other sessions" action later.

### Negative

- The service does **not** stop an attacker's parallel session — it relies on
  the human acting on the alert. This is the accepted trade-off of the chosen
  option and must be recorded as such with security.
- One extra cache GET per authenticated request (negligible; the request already
  touches the yar session).
- New client-side JS + SCSS for the toast, plus its accessibility burden. The
  no-JS banner fallback must be kept working.
- A toast that says "if this wasn't you, sign out" but cannot itself end the
  _other_ session may under-deliver on user expectation until a "sign out all
  sessions" action is added (noted as a follow-up).

### Neutral

- Registry entries self-expire with the session TTL.
- No change to token/refresh handling or federated logout.
- `x-test-user-*` bypass schemes (`NODE_ENV=test`) are unaffected — they never
  touch yar sessions, so no toast in `server.inject` unit tests unless a session
  is explicitly primed.
- Bilingual: both toast variants need en + cy copy in `translation.json`.
