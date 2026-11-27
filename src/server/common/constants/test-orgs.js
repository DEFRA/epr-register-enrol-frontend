import { yearSuffix } from '../helpers/currentYear.js'

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
export const MANAGE_EXPORTER_ORG = {
  orgId: 50018,
  orgName: 'Manage Accreditation Test Ltd',
  registrationId: 'aaa000000000000000050018',
  material: 'plastic'
}
// The same org's reprocessor registration.
export const MANAGE_EXPORTER_ORG_REPROCESSOR = {
  ...MANAGE_EXPORTER_ORG,
  registrationId: 'bbb000000000000000050018',
  material: 'glass'
}
// Error paths: Approved current-year accreditations whose registration is
// Created, or has no registration record at all.
export const MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID =
  'ccc000000000000000050018'
export const MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID =
  'ddd000000000000000050018'

// RA-492: the in-year "add a registered ORS" journey's own exporter, so
// RA-425's org above keeps its data. The backend's dev seed defines the same
// org and registration: keep the two in step.
export const IN_YEAR_CHANGE_ORG = {
  orgId: 50019,
  orgName: 'In-Year Change Exports Ltd',
  registrationId: 'aaa000000000000000050019',
  material: 'plastic'
}

// RA-697: an Approved exporter with no in-year change requests, for the
// change request pages' empty states.
export const NO_CHANGE_REQUESTS_ORG = {
  orgId: 50020,
  orgName: 'No Change Requests Ltd',
  registrationId: 'aaa000000000000000050020',
  material: 'plastic'
}

// RA-697: an Approved exporter registration with no accreditation in any year,
// for the registration-only manage pages. Same material as org 50020.
export const REGISTRATION_ONLY_ORG = {
  orgId: 50021,
  orgName: 'Registration Only Exports Ltd',
  registrationId: 'aaa000000000000000050021',
  material: 'plastic'
}

// RA-697: registered with no accreditation and no registered ORSs, for the
// overseas-sites page's empty Accredited and Registered tabs.
export const NO_OVERSEAS_SITES_ORG = {
  orgId: 50022,
  orgName: 'No Overseas Sites Exports Ltd',
  registrationId: 'aaa000000000000000050022',
  material: 'plastic'
}

// RA-682: the in-year ORS update journey's exporter. The backend's
// DevExporterOrg.InYearUpdate and the fe-tests fixture define the same org.
export const IN_YEAR_UPDATE_ORG = {
  orgId: 50025,
  orgName: 'In-Year Update Exports Ltd',
  registrationId: 'aaa000000000000000050025',
  material: 'plastic'
}

// RA-765: one exporter for each case of the manage page's apply banner. Each
// application's year is an offset from the clock's (Y), as the backend's
// DevExporterOrg.Applications are. The fe-tests fixture
// test/fixtures/reapply-orgs.js uses the same orgs: keep all three in step.
const reapplyOrg = (orgId, orgName, postcode, applications) => ({
  orgId,
  orgName,
  registrationId: `aaa${String(orgId).padStart(21, '0')}`,
  material: 'plastic',
  postcode,
  applications
})

// Approved Y-1: the banner offers Y.
export const REAPPLY_CURRENT_YEAR_ORG = reapplyOrg(
  50026,
  'Reapply Current Year Ltd',
  'IP3 0AA',
  [{ yearOffset: -1, status: 'Approved' }]
)

// Approved Y, Submitted Y+1: no banner.
export const APPLIED_NEXT_YEAR_ORG = reapplyOrg(
  50027,
  'Applied Next Year Ltd',
  'IP3 0AB',
  [
    { yearOffset: 0, status: 'Approved' },
    { yearOffset: 1, status: 'Submitted' }
  ]
)

// Approved Y, Rejected Y+1: the banner offers Y+1, whose apply page shows the
// refused application with "start new".
export const REFUSED_NEXT_YEAR_ORG = reapplyOrg(
  50028,
  'Refused Next Year Ltd',
  'IP3 0AD',
  [
    { yearOffset: 0, status: 'Approved' },
    { yearOffset: 1, status: 'Rejected' }
  ]
)

// Approved Y-2 (lapsed): the banner offers Y.
export const LAPSED_ACCREDITATION_ORG = reapplyOrg(
  50029,
  'Lapsed Accreditation Ltd',
  'IP3 0AE',
  [{ yearOffset: -2, status: 'Approved' }]
)

export const REAPPLY_ORGS = [
  REAPPLY_CURRENT_YEAR_ORG,
  APPLIED_NEXT_YEAR_ORG,
  REFUSED_NEXT_YEAR_ORG,
  LAPSED_ACCREDITATION_ORG
]

// The backend dev seed's accreditation application id for the year: "a" for
// an exporter or "b" for org 50018's reprocessor, the year, then the org id
// padded to 19 digits (DevExporterAccreditationSeedService.ApplicationIdFor).
const SEEDED_ORG_ID_DIGITS = 19

export function seededApplicationId(prefix, year, orgId) {
  return `${prefix}${year}${String(orgId).padStart(SEEDED_ORG_ID_DIGITS, '0')}`
}

// RA-739: the registration numbers in these orgs' /manage URLs. They follow
// the clock, as the backend's dev seed numbers (DevExporterOrg's
// RegistrationNumberFor) and the fe-tests fixtures do: keep the three in step.
export function exporterRegistrationNumber(
  year,
  orgId = MANAGE_EXPORTER_ORG.orgId
) {
  return `R${yearSuffix(year)}EX0${orgId}0001PL`
}

export function reprocessorRegistrationNumber(year) {
  return `R${yearSuffix(year)}ER0500180002GR`
}

export function createdRegistrationNumber(year) {
  return `R${yearSuffix(year)}ER0500180003WO`
}

export function missingRegistrationNumber(year) {
  return `R${yearSuffix(year)}ER0500180004WO`
}
