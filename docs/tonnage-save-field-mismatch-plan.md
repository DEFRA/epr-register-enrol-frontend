# Tonnage save silently no-ops — field-name mismatch

## Symptom

Reported: tonnage band selection doesn't save in the CDP `test`
environment.

URL: `https://epr-register-enrol-frontend.test.cdp-int.defra.cloud/accreditation/tonnage/6a4e51efef6003408c9c2e38`

No error is shown — the form submits, redirects normally to
`tonnage-authority`, but the previously-selected tonnage band is gone
next time the page (or the CYA page) is loaded.

## Root cause

`accreditationApiService.patchTonnage()` is a thin passthrough
([`accreditationApiService.js:175-183`](../src/server/common/helpers/accreditationApiService.js#L175-L183))
— whatever body the caller builds is sent verbatim as the PATCH body.
Both callers build the wrong body shape:

**[`tonnage/controller.js:134-140`](../src/server/accreditation/tonnage/controller.js#L134-L140)**

```js
await accreditationApiService.patchTonnage(organisationId, applicationId, {
  plannedIssuance: plannedTonnageBand // wrong key
})
```

**[`tonnage-cya/controller.js:129-137`](../src/server/accreditation/tonnage-cya/controller.js#L129-L137)**

```js
await accreditationApiService.patchTonnage(organisationId, applicationId, {
  plannedIssuance: tonnageBand, // wrong key
  signatories: authorisers, // wrong key
  sectionStatus: 'Completed' // correct
})
```

Both the real backend and the local JS stub agree on the expected key
names — and neither one is `plannedIssuance`/`signatories`:

- Real backend: `PatchTonnageRequest` has properties
  `PlannedTonnageBand` and `Authorisers`
  ([`Requests.cs:14-18`](file:///C:/git/Defra/epr-register-enrol-backend/EprRegisterEnrolBackend/AccreditationApplication/Models/Requests.cs#L14-L18)),
  serialised camelCase → JSON keys `plannedTonnageBand` and
  `authorisers`. The endpoint only assigns when the property is
  present/non-null
  ([`AccreditationApplicationEndpoints.cs:253-257`](file:///C:/git/Defra/epr-register-enrol-backend/EprRegisterEnrolBackend/AccreditationApplication/Endpoints/AccreditationApplicationEndpoints.cs#L253-L257)),
  so an unrecognised key is silently ignored — the request validates,
  returns `200 Ok` with the (unchanged) application, and nothing is
  persisted.

- Local stub: `stub-api-client.js` checks
  `body.plannedTonnageBand` and `body.authorisers` explicitly
  ([`stub-api-client.js:786-796`](../src/server/common/stub-api-client.js#L786-L796)).
  Same silent no-op for an unrecognised key.

So this isn't CDP-specific or a proxy/infra issue (unlike
[docs/cdp-proxy-upload-redirect-plan.md](cdp-proxy-upload-redirect-plan.md),
a previous CDP-only bug) — it reproduces against both the local stub
and the real backend, in any environment. `plannedIssuance` is only a
valid field name on the _read_ side, where
`accreditationApiService.js:125` maps the backend's
`prnIssuance.plannedIssuance` down to the frontend's flat
`prns.plannedTonnageBand`. It looks like that read-mapping name got
copy-pasted into the write path by mistake.

## Why tests didn't catch it

Both controllers' unit tests spy on `apiClient.patch` and assert it
was called with the (buggy) body that the code actually sends —
[`tonnage/controller.test.js:306-309`](../src/server/accreditation/tonnage/controller.test.js#L306-L309)
and
[`tonnage-cya/controller.test.js:261-269`](../src/server/accreditation/tonnage-cya/controller.test.js#L261-L269).
The mock never round-trips through the real stub logic that checks
key names, so the tests encode the bug as expected behaviour instead
of catching it.

## Impact

- `tonnage/controller.js`: planned tonnage band never saves from the
  main tonnage page.
- `tonnage-cya/controller.js`: on "confirm", neither the tonnage band
  nor the authorisers list are persisted — only `sectionStatus:
'Completed'` goes through, since that's the one key that happens to
  match. The section can get marked Completed with stale/empty
  tonnage data underneath it.
- `tonnage-authority/controller.js` is **not** affected — it already
  sends the correct `{ authorisers: [...] }` shape
  ([`tonnage-authority/controller.js:227-231`](../src/server/accreditation/tonnage-authority/controller.js#L227-L231),
  [`:290-296`](../src/server/accreditation/tonnage-authority/controller.js#L290-L296)).

## Plan

1. **Fix `tonnage/controller.js`.**
   Change the PATCH body key from `plannedIssuance` to
   `plannedTonnageBand`.

2. **Fix `tonnage-cya/controller.js`.**
   Change `plannedIssuance` → `plannedTonnageBand` and `signatories`
   → `authorisers` in the confirm PATCH body.

3. **Update the unit tests that encode the bug.**
   - `tonnage/controller.test.js:306-309` — assert
     `{ plannedTonnageBand: 'UpTo1000' }`.
   - `tonnage-cya/controller.test.js:261-269` — assert
     `{ plannedTonnageBand: 'UpTo1000', authorisers: [...] }`.
     Search both files for any other assertions using the old key names
     (e.g. a rejected-save test that also checks the PATCH body).

4. **Add a round-trip regression test.**
   Add at least one test per controller that exercises the real
   `stubApiClient`/`persistentStubApiClient` (not a `vi.spyOn` mock on
   `apiClient.patch`) — POST the form, then GET the application again
   and assert `prns.plannedTonnageBand` reflects the saved value. This
   is the class of test that would have caught the original bug,
   since it fails only when key names actually agree end-to-end.

5. **Grep for the same mistake elsewhere.**
   `plannedIssuance` and `signatories` are legitimate names on the
   _read_/normalisation side
   (`accreditationApiService.js:122-128`) — confirm no other PATCH
   caller in the codebase (business-plan, sampling-plan,
   overseas-sites, bes-evidence) has copied a read-side field name
   into a write-side payload the same way.

6. **Verify against the real backend.**
   With `API_STUB_ENABLED=false` and the backend running locally
   (`C:\git\Defra\epr-register-enrol-backend`), submit the tonnage
   page, reload, and confirm the band persists. Then verify in the
   CDP `test` environment using the reported URL/application.

## Non-goals

This plan does not touch the CDP proxy/undici dispatcher issue
described in
[docs/cdp-proxy-upload-redirect-plan.md](cdp-proxy-upload-redirect-plan.md)
— that's a separate, infra-level bug affecting file uploads only. It
also doesn't change `patchTonnage`'s pass-through design; the fix is
entirely in what body each caller constructs.
