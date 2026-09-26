import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'

/**
 * RA-603: the wizard entry points that sit between the overseas-sites page and
 * the add-interim-site wizard.
 *
 * These were reachable only through the page before, so they were covered
 * incidentally rather than deliberately - and the "add another interim site"
 * entry point, which RA-603 introduced, had no coverage at all. Each of these
 * routes resets and seeds wizard session state before redirecting, so getting
 * one wrong sends the operator into the wizard pointed at the wrong overseas
 * site, or at none.
 */

const APPLICATION_ID = 'app-wizard-entry-001'
const ORS_SITE_ID = 900010
const INTERIM_SITE_ID = 900011

const operatorHeaders = { 'x-test-user-type': 'operator' }

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    applicationStatus: 'Started',
    overseasSites: {
      sectionStatus: 'InProgress',
      sites: [
        {
          siteId: ORS_SITE_ID,
          orsId: '001',
          siteName: 'Wizard Entry GmbH',
          country: 'Germany',
          selected: true,
          operationCodes: ['R3'],
          interimSites: [
            {
              siteId: INTERIM_SITE_ID,
              siteNumber: '001',
              siteName: 'Wizard Entry Interim',
              country: 'France',
              operationCodes: ['R12']
            }
          ]
        }
      ]
    },
    ...overrides
  }
}

describe('select-overseas-sites wizard entry points', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET .../interim-site/add/{siteId}', () => {
    // AC01: the route behind "Add another interim site". It exists so the wizard
    // starts clean and linked to the right overseas site.
    test('redirects into the wizard at the country step', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/add/${ORS_SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain('/add-interim-site')
      expect(headers.location).toContain('/country')
    })

    // A site id that is not on the application cannot be linked to, so the
    // operator goes back to the page rather than into a wizard with no parent.
    test('redirects back to the page for an unknown overseas site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/add/424242`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(headers.location).not.toContain('/add-interim-site')
    })

    // AC12's boundary, from the other side. A queried application is editable
    // only in the section the regulator actually queried, so starting a write
    // journey here - and starting the wizard IS the first step of a write - goes
    // back to the task list. Overseas sites being Completed rather than Queried
    // is what makes this the blocked case.
    test('redirects to the task list when the section cannot be written', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            ...makeApplication().overseasSites,
            sectionStatus: 'Completed'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/add/${ORS_SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      // The QUERY task list specifically: a queried application has its own one.
      expect(headers.location).toContain('/accreditation/query-task-list/')
    })
  })

  describe('GET .../interim-site/edit/{interimSiteId}', () => {
    // Keyed on the interim site's own id, which is what lets an ORS hold several
    // and still have each one editable on its own.
    test('redirects into the wizard for an interim site that exists', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/${INTERIM_SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain('/add-interim-site')
    })

    test('redirects back to the page for an unknown interim site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/424242`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })
  })
})
