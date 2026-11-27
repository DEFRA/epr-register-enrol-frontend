import { APPROVED_STATUS } from '../../common/constants/applicationStatuses.js'
import { isLiveApplication } from '../../common/helpers/accreditationSelection.js'

// Drafts the operator hasn't submitted yet.
const UNSUBMITTED_STATUSES = new Set(['Saved', 'Started'])

// A suspended (or, for now, cancelled) accreditation keeps its Approved
// application, so it stays live and its year is never offered again.
const liveApplicationsFor = (applications, year) =>
  applications.filter(
    (application) => application.year === year && isLiveApplication(application)
  )

// Only a registration that has held an accreditation can re-apply: the apply
// page seeds the new application from the latest one granted.
const wasGrantedBefore = (applications, year) =>
  applications.some(
    (application) =>
      application.year < year &&
      application.applicationStatus === APPROVED_STATUS
  )

// Whether the year can be offered and, if so, whether its application is
// already started.
function offerFor(applications, year) {
  if (!wasGrantedBefore(applications, year)) {
    return null
  }
  const live = liveApplicationsFor(applications, year)
  if (live.length === 0) {
    return { year, continues: false }
  }
  return live.every((application) =>
    UNSUBMITTED_STATUSES.has(application.applicationStatus)
  )
    ? { year, continues: true }
    : null
}

/**
 * RA-765: the one accreditation year the operator may apply for, if any: this
 * year unless it has a submitted application, otherwise next year unless that
 * has one, either way only once an earlier year was granted. A year whose
 * application is started but not yet submitted is still offered, so the
 * operator can continue it. Offered all year round, as there is no
 * reapplication window.
 *
 * @param {object[]} registrationApplications - every year's application for
 *   one registration and material
 * @param {number} thisYear
 * @returns {{ year: number, continues: boolean }|null}
 */
export function offeredApplicationYear(registrationApplications, thisYear) {
  for (const year of [thisYear, thisYear + 1]) {
    const offer = offerFor(registrationApplications, year)
    if (offer) {
      return offer
    }
  }
  return null
}
