import { APPROVED_STATUS } from '../../common/constants/applicationStatuses.js'
import { isLiveApplication } from '../../common/helpers/accreditationSelection.js'

// A suspended (or, for now, cancelled) accreditation keeps its Approved
// application, so it stays live and its year is never offered again.
const hasLiveApplication = (applications, year) =>
  applications.some(
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

/**
 * RA-765: the one accreditation year the operator may apply for, if any: this
 * year when it has no live application, otherwise next year when that has
 * none, either way only once an earlier year was granted. Offered all year
 * round, as there is no reapplication window.
 *
 * @param {object[]} registrationApplications - every year's application for
 *   one registration and material
 * @param {number} thisYear
 * @returns {number|null}
 */
export function offeredApplicationYear(registrationApplications, thisYear) {
  return (
    [thisYear, thisYear + 1].find(
      (year) =>
        !hasLiveApplication(registrationApplications, year) &&
        wasGrantedBefore(registrationApplications, year)
    ) ?? null
  )
}
