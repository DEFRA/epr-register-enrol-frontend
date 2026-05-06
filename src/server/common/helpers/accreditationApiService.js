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
  seedApplication(organisationId, body) {
    return call(() => apiClient.post(`${BASE}/${organisationId}/seed`, body))
  },

  listApplications(organisationId) {
    return call(() => apiClient.get(`${BASE}/${organisationId}`))
  },

  getApplication(organisationId, applicationId) {
    return call(() => apiClient.get(appBase(organisationId, applicationId)))
  },

  patchPrns(organisationId, applicationId, body) {
    return call(() =>
      apiClient.patch(`${appBase(organisationId, applicationId)}/prns`, body)
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
