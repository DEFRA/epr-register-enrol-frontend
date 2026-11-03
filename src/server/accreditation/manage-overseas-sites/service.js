import { apiClient } from '../../common/api-client.js'

// RA-492: client for the backend's accreditation-changes API (see the
// backend's AccreditationChanges endpoints). apiClient throws on a non-OK
// response with error.status set; callers decide what each status means.

const base = (organisationId, applicationId) =>
  `/api/v1/accreditation-changes/${encodeURIComponent(organisationId)}/${encodeURIComponent(applicationId)}`

const current = (organisationId, applicationId) =>
  `${base(organisationId, applicationId)}/requests/current`

export const accreditationChangesService = {
  getView(organisationId, applicationId) {
    return apiClient.get(base(organisationId, applicationId))
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

  submit(organisationId, applicationId, body) {
    return apiClient.post(
      `${current(organisationId, applicationId)}/submit`,
      body
    )
  }
}
