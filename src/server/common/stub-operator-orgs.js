/**
 * Single source of truth for the stub operator's organisations.
 *
 * Each entry pairs a ReEx (URL) organisation id with the linked Defra
 * organisation id ReEx reports for it, plus a display name. Everything the stub
 * needs to authorise the operator is derived from this one array, so there is
 * no separate map to keep in sync:
 *   - STUB_DEFRA_LINKS — the /defra-link response used when the real backend is
 *     unreachable (src/server/common/persistentStubApiClient.js)
 *   - STUB_OPERATOR_RELATIONSHIPS — the operator's Defra ID relationships
 *     (src/server/auth/stub/controller.js)
 * The operator page (src/server/operator/index.njk) links to these orgs; a
 * drift-guard test asserts every org id it links to appears here.
 *
 * Numeric orgs link to themselves (ReEx id == Defra id); the ObjectId-shaped
 * test org links to a distinct UUID, mirroring the real ReEx-vs-Defra id split.
 */
// defraOrgId is a Defra ID organisation id — a string (a UUID in production).
// The numeric-looking ids below are kept readable for the pure-stub orgs; the
// ObjectId-shaped org uses a real-shaped UUID to exercise the ReEx-id != Defra-id
// case. Both are strings, matching the backend's string contract.
export const STUB_OPERATOR_ORGS = [
  { reExOrgId: '50001', defraOrgId: '50001', name: 'NEWDEV RECYCLING LIMITED' },
  { reExOrgId: '50002', defraOrgId: '50002', name: 'Beta Recycling Co' },
  { reExOrgId: '50003', defraOrgId: '50003', name: 'Delta Green Ltd' },
  { reExOrgId: '50004', defraOrgId: '50004', name: 'Stub Org 50004' },
  { reExOrgId: '50005', defraOrgId: '50005', name: 'Stub Org 50005' },
  { reExOrgId: '50006', defraOrgId: '50006', name: 'Stub Org 50006' },
  { reExOrgId: '50007', defraOrgId: '50007', name: 'Stub Org 50007' },
  {
    reExOrgId: '6a2fcd74e16883c137d01188',
    defraOrgId: '67b9e8fc-2235-431a-a7b9-80663c81b6ff',
    name: 'Bednar - Frami Limited xTklApuT'
  }
]

// ReEx org id -> linked Defra org id.
export const STUB_DEFRA_LINKS = Object.fromEntries(
  STUB_OPERATOR_ORGS.map((org) => [org.reExOrgId, org.defraOrgId])
)

// Defra ID relationship strings: `relationshipId:organisationId:organisationName`.
export const STUB_OPERATOR_RELATIONSHIPS = STUB_OPERATOR_ORGS.map(
  (org) => `stub-rel-${org.defraOrgId}:${org.defraOrgId}:${org.name}`
)

// The relationship the stub operator is currently acting under (the first org).
export const STUB_OPERATOR_CURRENT_RELATIONSHIP_ID = `stub-rel-${STUB_OPERATOR_ORGS[0].defraOrgId}`
