import { apiClient } from '../api-client.js'

/**
 * RA-425: the backend's view of a registration, from the domain model's
 * current registration version. Keyed by the ReEx registration id the
 * frontend's URLs carry. Rejects with the API client's error, whose `status`
 * is 404 when the registration has no record.
 *
 * @returns {Promise<{ registrationId: string, registrationNumber: string | null, status: 'Created' | 'Approved' | 'Rejected' | 'Cancelled' }>}
 */
export function getRegistrationStatus(registrationId) {
  return apiClient.get(
    `/api/v1/registrations/${encodeURIComponent(registrationId)}/status`
  )
}
