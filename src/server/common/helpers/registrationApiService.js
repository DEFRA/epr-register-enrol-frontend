import { apiClient } from '../api-client.js'
import { hasValue } from './hasValue.js'

/**
 * RA-425: the backend's view of a registration, from the domain model's
 * current registration version. RA-739: found by the registration number the
 * /manage URLs carry; registrationId in the response is the ReEx registration
 * id. Rejects with the API client's error, whose `status` is 404 when no
 * current registration has the number.
 *
 * RA-697: also the organisation name (from ReEx, by organisationId), material,
 * exporter flag and site address, from which a registration-only operator's
 * pages are built. 404 too when ReEx says the organisation doesn't hold the
 * registration; organisationName is null when ReEx can't be read.
 *
 * organisationId is the organisation's number (as in the /manage URL), never
 * ReEx's id for it: the backend answers 404 for anything else, and for a
 * number that isn't the holder's. reExOrganisationId is then ReEx's id for
 * the holder, for the organisation-keyed calls that follow.
 *
 * @returns {Promise<{ registrationId: string, registrationNumber: string | null, status: 'Created' | 'Approved' | 'Rejected' | 'Cancelled', organisationName: string | null, materialType: string, glassRecyclingProcess: string | null, isExporter: boolean, siteAddress: string | null, reExOrganisationId: string }>}
 */
export async function getRegistrationStatusByNumber(
  registrationNumber,
  organisationId
) {
  // Without it the query would carry the string "undefined" to the backend.
  if (!hasValue(organisationId)) {
    throw new Error('organisationId is required to fetch a registration')
  }
  const query = new URLSearchParams({ organisationId: String(organisationId) })
  return apiClient.get(
    `/api/v1/registrations/by-number/${encodeURIComponent(registrationNumber)}/status?${query}`
  )
}
