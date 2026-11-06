import { vi } from 'vitest'

import { apiClient } from '../api-client.js'

export const MANAGE_ORG_ID = 'org-123'
export const MANAGE_REGISTRATION_ID = 'REG001'
export const MANAGE_MATERIAL = 'Plastic'
export const MANAGE_CURRENT_YEAR = 2027
export const MANAGE_URL = `/manage/${MANAGE_ORG_ID}/${MANAGE_REGISTRATION_ID}/${MANAGE_MATERIAL}`
// The Re/Ex material page, from REEX_FRONTEND_BASE_URL in vitest.config.js.
export const MANAGE_REEX_URL = `https://reex.example.test/organisations/${MANAGE_ORG_ID}/registrations/${MANAGE_REGISTRATION_ID}`

export const approvedRegistration = {
  registrationId: MANAGE_REGISTRATION_ID,
  registrationNumber: 'R27EX0500180001PL',
  status: 'Approved'
}

/**
 * A raw application that the /manage pages accept as the current
 * accreditation for MANAGE_REGISTRATION_ID and MANAGE_MATERIAL.
 *
 * @param {object} [overrides]
 */
export const makeManageApp = (overrides = {}) => ({
  id: 'app-current',
  applicationStatus: 'Approved',
  material: 'plastic',
  wasteProcessingType: 'exporter',
  registrationId: MANAGE_REGISTRATION_ID,
  year: MANAGE_CURRENT_YEAR,
  createdAt: '2026-10-01T09:00:00Z',
  companyName: 'Acme Recycling Ltd',
  applicationReference: 'AP27EA0500183ABPL',
  accreditationReference: 'A27EX0500180001PL',
  siteAddress: { line1: 'Unit 5', town: 'Bolton', postcode: 'BL4 7AQ' },
  ...overrides
})

// RA-492: the accreditation-changes view when the operator has made no
// in-year change requests.
export const noChangeRequests = {
  sites: [],
  activeRequest: null,
  requests: [],
  pendingOrsIds: []
}

const responseOrThrow = (response) => {
  if (response instanceof Error) {
    throw response
  }
  return response
}

/**
 * listApplications, getApplication, getRegistrationStatus and the RA-492
 * accreditation-changes view all go through apiClient.get, so route by URL
 * shape: the registration-status URL gets `registration` and the
 * accreditation-changes URL gets `changes` (each thrown when it is an Error),
 * a last path segment matching an application id is the single-application
 * fetch, anything else is the list.
 *
 * @param {object[]} apps - raw applications, each with an `id`
 * @param {object|Error} [registration] - the registration-status response
 * @param {object|Error} [changes] - the accreditation-changes view
 */
export function mockManageGets(
  apps,
  registration = approvedRegistration,
  changes = noChangeRequests
) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/registrations/')) {
      return responseOrThrow(registration)
    }
    if (url.startsWith('/api/v1/accreditation-changes/')) {
      return responseOrThrow(changes)
    }
    const lastSegment = url.split('/').pop()
    return apps.find((app) => app.id === lastSegment) ?? apps
  })
}

export const apiError = (status) =>
  Object.assign(new Error(`API request failed: ${status}`), { status })
