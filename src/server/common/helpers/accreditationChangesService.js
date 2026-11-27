import { apiClient } from '../api-client.js'

// RA-492: client for the backend's accreditation-changes API (see the
// backend's AccreditationChanges endpoints). apiClient throws on a non-OK
// response with error.status set; callers decide what each status means.

const base = (organisationId, applicationId) =>
  `/api/v1/accreditation-changes/${encodeURIComponent(organisationId)}/${encodeURIComponent(applicationId)}`

const current = (organisationId, applicationId) =>
  `${base(organisationId, applicationId)}/requests/current`

// RA-698: a queried item sits in a submitted request, so its routes are keyed
// by the item, not by the draft.
const item = (organisationId, applicationId, itemId) =>
  `${base(organisationId, applicationId)}/items/${encodeURIComponent(itemId)}`

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

  /**
   * RA-492: adds a registered ORS to the draft. RA-682: with
   * `CHANGE_TYPES.updateOverseasSite`, starts a change to an accredited ORS's
   * details instead. Starting one already in the draft returns the draft.
   */
  addSite(organisationId, applicationId, siteId, changeType) {
    return apiClient.post(`${current(organisationId, applicationId)}/sites`, {
      siteId,
      ...(changeType ? { changeType } : {})
    })
  },

  // RA-682 AC04: an ORS update's interim site changes.
  addInterimSite(organisationId, applicationId, siteId, body) {
    return apiClient.post(
      `${current(organisationId, applicationId)}/sites/${siteId}/interim-sites`,
      body
    )
  },

  changeInterimSite(
    organisationId,
    applicationId,
    siteId,
    interimSiteId,
    body
  ) {
    return apiClient.patch(
      `${current(organisationId, applicationId)}/sites/${siteId}/interim-sites/${interimSiteId}`,
      body
    )
  },

  removeInterimSite(organisationId, applicationId, siteId, interimSiteId) {
    return apiClient.delete(
      `${current(organisationId, applicationId)}/sites/${siteId}/interim-sites/${interimSiteId}`
    )
  },

  changeInterimSiteAddition(
    organisationId,
    applicationId,
    siteId,
    changeId,
    body
  ) {
    return apiClient.patch(
      `${current(organisationId, applicationId)}/sites/${siteId}/interim-site-changes/${encodeURIComponent(changeId)}`,
      body
    )
  },

  undoInterimSiteChange(organisationId, applicationId, siteId, changeId) {
    return apiClient.delete(
      `${current(organisationId, applicationId)}/sites/${siteId}/interim-site-changes/${encodeURIComponent(changeId)}`
    )
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

  /**
   * RA-698: changes the editable fields of a Queried item's ORS. A partial
   * body: a field left out stays as it is. 400 for a blank required field or
   * a bad email, 422 for a locked field, 409 when the item is not Queried.
   */
  patchItem(organisationId, applicationId, itemId, body) {
    return apiClient.patch(
      `${item(organisationId, applicationId, itemId)}/answers`,
      body
    )
  },

  /** RA-698: as patchItem, for one interim site of the queried ORS. */
  patchItemInterimSite(
    organisationId,
    applicationId,
    itemId,
    interimSiteId,
    body
  ) {
    return apiClient.patch(
      `${item(organisationId, applicationId, itemId)}/interim-sites/${encodeURIComponent(interimSiteId)}/answers`,
      body
    )
  },

  itemBesEvidenceInitiateUrl(organisationId, applicationId, itemId) {
    return `${item(organisationId, applicationId, itemId)}/bes-evidence/initiate`
  },

  addItemBesFile(organisationId, applicationId, itemId, body) {
    return apiClient.post(
      `${item(organisationId, applicationId, itemId)}/bes-evidence/files`,
      body
    )
  },

  /** RA-698: 422 for a file that existed before the query. */
  deleteItemBesFile(organisationId, applicationId, itemId, fileId) {
    return apiClient.delete(
      `${item(organisationId, applicationId, itemId)}/bes-evidence/files/${encodeURIComponent(fileId)}`
    )
  },

  /**
   * RA-698: answers the query. Tells the regulator, then moves the item to
   * Updated; 422 when nothing has changed. As for submit, the backend waits
   * for the regulator's side, so this waits longer than it.
   */
  resubmitItem(organisationId, applicationId, itemId, body) {
    return apiClient.post(
      `${item(organisationId, applicationId, itemId)}/resubmit`,
      body,
      { timeout: 20000 }
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

/**
 * The message of a 409: Results.Conflict(string) sends it as a JSON string,
 * a ProblemDetails as its detail. Null when the body is neither.
 */
export function conflictMessage(err) {
  try {
    const body =
      typeof err.response === 'string' ? JSON.parse(err.response) : null
    return typeof body === 'string' ? body : (body?.detail ?? null)
  } catch {
    return null
  }
}
