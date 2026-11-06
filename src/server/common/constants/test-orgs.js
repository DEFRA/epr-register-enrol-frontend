// RA-425: organisations the test-only operator page links to, shared with the
// stub API that serves them locally.

// The frontend stub's Delta Green accreditation is glass; the backend's dev
// seeds (DevAccreditationHistorySeedService) approve it for plastic.
export const DELTA_GREEN_ORG_ID = 50003
export const DELTA_GREEN_REGISTRATION_ID = 'aaa000000000000000050003'

// The backend's DevExporterOrg (DevSeed/DevExporterOrg.cs) defines the same
// orgs, with the exporter registration and (RA-697) org 50018's reprocessor
// registration, and the fe-tests fixtures (test/fixtures/manage-exporter-org.js
// and in-year-change-org.js) use the same ids: keep all three in step. The
// other registrations are stub-only.
export const MANAGE_EXPORTER_ORG_ID = 50018
export const MANAGE_EXPORTER_ORG_NAME = 'Manage Accreditation Test Ltd'
export const MANAGE_EXPORTER_REGISTRATION_ID = 'aaa000000000000000050018'
export const MANAGE_EXPORTER_MATERIAL = 'plastic'
export const MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID =
  'bbb000000000000000050018'
export const MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL = 'glass'
// Error paths: Approved current-year accreditations whose registration is
// Created, or has no registration record at all.
export const MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID =
  'ccc000000000000000050018'
export const MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID =
  'ddd000000000000000050018'

// RA-492: the in-year "add a registered ORS" journey's own exporter, so
// RA-425's org above keeps its data. The backend's dev seed defines the same
// org and registration: keep the two in step.
export const IN_YEAR_CHANGE_ORG_ID = 50019
export const IN_YEAR_CHANGE_ORG_NAME = 'In-Year Change Exports Ltd'
export const IN_YEAR_CHANGE_REGISTRATION_ID = 'aaa000000000000000050019'
export const IN_YEAR_CHANGE_MATERIAL = 'plastic'

// RA-697: an Approved exporter with no in-year change requests, for the
// change request pages' empty states.
export const NO_CHANGE_REQUESTS_ORG_ID = 50020
export const NO_CHANGE_REQUESTS_ORG_NAME = 'No Change Requests Ltd'
export const NO_CHANGE_REQUESTS_REGISTRATION_ID = 'aaa000000000000000050020'
export const NO_CHANGE_REQUESTS_MATERIAL = 'plastic'

// The backend dev seed's accreditation application id for the year: "a" for
// an exporter or "b" for org 50018's reprocessor, the year, then the org id
// padded to 19 digits (DevExporterAccreditationSeedService.ApplicationIdFor).
const SEEDED_ORG_ID_DIGITS = 19

export function seededApplicationId(prefix, year, orgId) {
  return `${prefix}${year}${String(orgId).padStart(SEEDED_ORG_ID_DIGITS, '0')}`
}
