import { accreditationApiService } from './accreditationApiService.js'

export const WITHDRAWN_STATUS = 'Withdrawn'

// An application can only be withdrawn before a final regulator decision —
// shared with accreditation/withdraw-application so the withdraw route and the
// landing page can never disagree about which statuses are withdrawable.
export const NON_WITHDRAWABLE_STATUSES = new Set([
  // Not submitted, so can't be withdrawn
  'Saved',
  'Started',
  'NotStarted',
  // Final decisions made can't be withdrawn
  'Approved',
  'Refused',
  'Cancelled',
  'Rejected',
  // Withdrawn is a final state, so can't be withdrawn again
  WITHDRAWN_STATUS
])

// The backend gives no ordering guarantee on
// GET /api/v1/accreditation-applications/{organisationId} — the Mongo find is
// unsorted — so array order must never decide which record wins. Sort
// explicitly on createdAt, newest first, with applicationId as a stable
// secondary tiebreak.
//
// This deliberately mirrors AccreditationApplicationEndpoints.cs in
// epr-register-enrol-backend, whose seed endpoint picks the live application
// with OrderByDescending(CreatedAt).ThenByDescending(Id). The two orderings
// agree because applicationId is the ObjectId as fixed-length lowercase hex, so
// plain string comparison matches the driver's byte-wise ObjectId comparison —
// do not switch to localeCompare, whose collation would silently disagree on
// exactly the edge case this tiebreak exists for.
//
// Duplicating the rule is temporary: epr-eo2n tracks dropping this comparator
// once the backend sorts that list endpoint server-side.
function createdAtTime(application) {
  const parsed = Date.parse(application.createdAt)
  return Number.isNaN(parsed) ? -Infinity : parsed
}

function latest(applications) {
  return applications.reduce((best, application) => {
    if (best === null) return application
    const difference = createdAtTime(application) - createdAtTime(best)
    if (difference > 0) return application
    if (difference < 0) return best
    return String(application.applicationId) > String(best.applicationId)
      ? application
      : best
  }, null)
}

// RA-357: a single accreditation year can hold both a withdrawn record and its
// live replacement, so pick the newest live application and only fall back to a
// withdrawn one when that is genuinely all there is for the year.
export function selectApplicationForYear(
  applications,
  { registrationId, materialType, year }
) {
  const matching = applications.filter(
    (app) =>
      app.registrationId === registrationId &&
      app.materialType === materialType &&
      app.year === year
  )
  const live = matching.filter(
    (app) => app.applicationStatus !== WITHDRAWN_STATUS
  )

  return {
    application: latest(live) ?? latest(matching),
    hasLive: live.length > 0,
    hasMatch: matching.length > 0
  }
}

// Shared by the reprocessor and exporter landing routes, and by the start-new
// POST, so they can never disagree about which application represents a year or
// when a new one is seeded. Returns { application: null, failed: true } when the
// caller should render the seed-error view.
export async function resolveLandingApplication({
  organisationId,
  registrationId,
  materialType,
  yearInt,
  startNewRequested,
  logger,
  kind = ''
}) {
  let applications
  try {
    applications =
      await accreditationApiService.listApplications(organisationId)
  } catch (error) {
    logger.error(`Error fetching accreditation applications: ${error.message}`)
    return { application: null, failed: true }
  }

  const { application, hasLive, hasMatch } = selectApplicationForYear(
    applications,
    { registrationId, materialType, year: yearInt }
  )

  // Seed when the year is empty, or when the operator explicitly asked to start
  // again and every record for the year is withdrawn. Simply viewing a
  // withdrawn application must leave it exactly as it is.
  if (hasMatch && (hasLive || !startNewRequested)) {
    return { application, failed: false }
  }

  const descriptor = kind ? `${kind} ` : ''
  try {
    return {
      application: await accreditationApiService.seedApplication(
        organisationId,
        registrationId,
        materialType,
        yearInt
      ),
      failed: false
    }
  } catch (error) {
    logger.error(
      `Error seeding ${descriptor}accreditation application for org=${organisationId} registration=${registrationId} material=${materialType} year=${yearInt}: ${error.message} status=${error.status} response=${error.response}`
    )
    return { application: null, failed: true }
  }
}
