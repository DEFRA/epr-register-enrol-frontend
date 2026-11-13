import { apiClient } from '../api-client.js'

// RA-492: client for the backend's accreditation-changes API (see the
// backend's AccreditationChanges endpoints). apiClient throws on a non-OK
// response with error.status set; callers decide what each status means.

const base = (organisationId, applicationId) =>
  `/api/v1/accreditation-changes/${encodeURIComponent(organisationId)}/${encodeURIComponent(applicationId)}`

const current = (organisationId, applicationId) =>
  `${base(organisationId, applicationId)}/requests/current`

/**
 * RA-697: one change within a request. A site entry on a request's `sites`
 * carries these alongside its RA-492 fields; a tonnage band upgrade request
 * has no sites and one `tonnageBandUpgrade` item, which adds `requestedBand`.
 *
 * @typedef {object} ChangeRequestItem
 * @property {string} itemId
 * @property {string} changeType - one of CHANGE_TYPES
 * @property {string} status - InProgress, Submitted, Queried, Updated,
 *   DulyMade, Approved, Rejected or Withdrawn
 * @property {string|null} validFrom
 * @property {string|null} withdrawnAt
 */

export const accreditationChangesService = {
  /**
   * The accreditation's sites (none for a reprocessor), its draft
   * (`activeRequest`), every request newest first (`requests`, each with
   * `sites` items and a nullable `tonnageBandUpgrade`), and `pendingOrsIds`.
   * A site's `pendingRequestId` and `pendingRequestStatus` come from a request
   * with an active item for it; the status is that request's lifecycle
   * status (InProgress or Submitted).
   */
  getView(organisationId, applicationId) {
    return apiClient.get(base(organisationId, applicationId))
  },

  /**
   * RA-697: a registration-only operator's view, in the same shape with a
   * null applicationId and accreditationReference: the registration's
   * registered ORSs (none for a reprocessor) and its registration-only
   * requests for the current year. Read only.
   */
  getRegistrationView(organisationId, registrationId, materialType) {
    return apiClient.get(
      `/api/v1/accreditation-changes/${encodeURIComponent(organisationId)}/registrations/${encodeURIComponent(registrationId)}/${encodeURIComponent(materialType)}`
    )
  },

  addSite(organisationId, applicationId, siteId) {
    return apiClient.post(`${current(organisationId, applicationId)}/sites`, {
      siteId
    })
  },

  removeSite(organisationId, applicationId, siteId) {
    return apiClient.delete(
      `${current(organisationId, applicationId)}/sites/${siteId}`
    )
  },

  patchSite(organisationId, applicationId, siteId, body) {
    return apiClient.patch(
      `${current(organisationId, applicationId)}/sites/${siteId}`,
      body
    )
  },

  besEvidenceInitiateUrl(organisationId, applicationId) {
    return `${current(organisationId, applicationId)}/bes-evidence/initiate`
  },

  addBesEvidenceFile(organisationId, applicationId, siteId, body) {
    return apiClient.post(
      `${current(organisationId, applicationId)}/sites/${siteId}/bes-evidence/files`,
      body
    )
  },

  deleteBesEvidenceFile(organisationId, applicationId, siteId, fileId) {
    return apiClient.delete(
      `${current(organisationId, applicationId)}/sites/${siteId}/bes-evidence/files/${encodeURIComponent(fileId)}`
    )
  },

  // RA-739: the backend waits up to 15s for Case Management, so this must
  // wait longer or the backend sees a cancelled request instead of a timeout.
  submit(organisationId, applicationId, body) {
    return apiClient.post(
      `${current(organisationId, applicationId)}/submit`,
      body,
      { timeout: 20000 }
    )
  }
}

/**
 * The `errors` map of a 400/422 ValidationProblem. apiClient keeps the
 * response body as text, so it is parsed here; anything unreadable gives an
 * empty map.
 */
export function validationErrors(err) {
  const body = err.response
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body
    return parsed?.errors && typeof parsed.errors === 'object'
      ? parsed.errors
      : {}
  } catch {
    return {}
  }
}
