import { vi } from 'vitest'

import { apiClient } from '../api-client.js'

/**
 * RA-425: stubs the API calls behind the /manage pages. listApplications,
 * getApplication and getRegistrationStatus all go through apiClient.get, so
 * route by URL shape: the registration-status URL gets `registration` (thrown
 * when it is an Error), a last path segment matching an application id is the
 * single-application fetch, anything else is the list.
 *
 * @param {object[]} apps - raw applications, each with an `id`
 * @param {object|Error} registration - the registration-status response
 */
export function mockManageGets(apps, registration) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/registrations/')) {
      if (registration instanceof Error) {
        throw registration
      }
      return registration
    }
    const lastSegment = url.split('/').pop()
    return apps.find((app) => app.id === lastSegment) ?? apps
  })
}

/** An API client error carrying an HTTP status, as apiClient throws. */
export const apiError = (status) =>
  Object.assign(new Error(`API request failed: ${status}`), { status })
