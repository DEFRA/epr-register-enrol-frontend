import { apiClient } from '../api-client.js'

/**
 * RA-425: the backend's view of a registration, from the domain model's
 * current registration version. Keyed by the ReEx registration id the
 * frontend's URLs carry. Rejects with the API client's error, whose `status`
 * is 404 when the registration has no record.
 *
 * RA-697: also the organisation name (from ReEx, by organisationId), material,
 * exporter flag and site address, from which a registration-only operator's
 * pages are built. 404 too when ReEx says the organisation doesn't hold the
 * registration; organisationName is null when ReEx can't be read.
 *
 * @returns {Promise<{ registrationId: string, registrationNumber: string | null, status: 'Created' | 'Approved' | 'Rejected' | 'Cancelled', organisationName: string | null, materialType: string, glassRecyclingProcess: string | null, isExporter: boolean, siteAddress: string | null }>}
 */
export function getRegistrationStatus(registrationId, organisationId) {
  const query = new URLSearchParams({ organisationId: String(organisationId) })
  return apiClient.get(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}/status?${query}`
  )
}
