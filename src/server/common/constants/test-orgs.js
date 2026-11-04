// RA-425: organisations the test-only operator page links to, shared with the
// stub API that serves them locally.

// The backend's dev seeds create Delta Green too. Its
// DevAccreditationHistorySeedService approves it for plastic; the frontend
// stub's Delta Green accreditation is glass.
export const DELTA_GREEN_ORG_ID = 50003
export const DELTA_GREEN_REGISTRATION_ID = 'aaa000000000000000050003'
export const DELTA_GREEN_SEEDED_MATERIAL = 'plastic'

// The backend's DevExporterAccreditationSeedService defines the same org and
// exporter registration: keep the two in step. The other registrations are
// stub-only.
export const MANAGE_TEST_ORG_ID = 50018
export const MANAGE_TEST_ORG_NAME = 'Manage Accreditation Test Ltd'
export const MANAGE_TEST_EXPORTER_REGISTRATION_ID = 'aaa000000000000000050018'
export const MANAGE_TEST_EXPORTER_MATERIAL = 'plastic'
export const MANAGE_TEST_REPROCESSOR_REGISTRATION_ID =
  'bbb000000000000000050018'
export const MANAGE_TEST_REPROCESSOR_MATERIAL = 'glass'
// Error paths: Approved current-year accreditations whose registration is
// Created, or has no registration record at all.
export const MANAGE_TEST_CREATED_REGISTRATION_ID = 'ccc000000000000000050018'
export const MANAGE_TEST_MISSING_REGISTRATION_ID = 'ddd000000000000000050018'
