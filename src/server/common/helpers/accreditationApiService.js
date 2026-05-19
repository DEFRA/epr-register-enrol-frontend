import { apiClient } from '../api-client.js'

const BASE = '/api/v1/accreditation-applications'

function appBase(organisationId, applicationId) {
  return `${BASE}/${organisationId}/${applicationId}`
}

function normaliseError(err) {
  const status = err.status ?? 500
  const message = err.message ?? 'Unknown error'
  const normalised = new Error(message)
  normalised.status = status
  normalised.isApiError = true
  return normalised
}

async function call(fn) {
  try {
    return await fn()
  } catch (err) {
    throw normaliseError(err)
  }
}

export const accreditationApiService = {
  seedApplication(organisationId, siteId, materialType, year) {
    return call(() =>
      apiClient.post(
        `${BASE}/${organisationId}/${siteId}/${materialType}/seed`,
        { year }
      )
    )
  },

  seedExporterApplication(organisationId, materialType, year) {
    return call(() =>
      apiClient.post(`${BASE}/${organisationId}/${materialType}/seed`, { year })
    )
  },

  listApplications(organisationId) {
    return call(() => apiClient.get(`${BASE}/${organisationId}`))
  },

  getApplication(organisationId, applicationId) {
    return call(() => apiClient.get(appBase(organisationId, applicationId)))
  },

  patchTonnage(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(`${appBase(organisationId, applicationId)}/tonnage`, body)
    )
  },

  patchBusinessPlan(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/business-plan`,
        body
      )
    )
  },

  patchSamplingPlan(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/sampling-plan`,
        body
      )
    )
  },

  patchOverseasSites(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/overseas-sites`,
        body
      )
    )
  },

  addBesEvidenceFile(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence/files`,
        body
      )
    )
  },

  patchBesEvidence(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence`,
        body
      )
    )
  },

  deleteBesEvidenceFile(organisationId, applicationId, siteId, fileId) {
    return call(() =>
      apiClient.delete(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence/files/${fileId}`
      )
    )
  },

  patchBesEvidenceSection(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/bes-evidence`,
        body
      )
    )
  },

  submitApplication(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(`${appBase(organisationId, applicationId)}/submit`, body)
    )
  },

  addFile(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(`${appBase(organisationId, applicationId)}/files`, body)
    )
  },

  deleteFile(organisationId, applicationId, fileId) {
    return call(() =>
      apiClient.delete(
        `${appBase(organisationId, applicationId)}/files/${fileId}`
      )
    )
  }
}
