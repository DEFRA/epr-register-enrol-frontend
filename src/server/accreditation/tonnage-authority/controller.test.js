import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { apiClient } from '../../common/api-client.js'
import { buildHeading, buildAuthoriserRows } from './controller.js'

const APPLICATION_ID = 'app-auth-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    isExporter: false,
    prns: {
      plannedTonnageBand: 'UpTo1000',
      authorisers: [],
      sectionStatus: 'InProgress'
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildHeading', () => {
  // Material and site are shown once, in the persistent application-header,
  // so this heading is just the translated prefix.
  test('uses the standard prefix for a reprocessor', () => {
    expect(buildHeading(false, t)).toBe('headingPrefix')
  })

  test('uses the exporter-specific prefix when isExporter is true', () => {
    expect(buildHeading(true, t)).toBe('headingPrefixExporter')
  })
})

describe('#buildAuthoriserRows', () => {
  test('returns empty array when authorisers is null', () => {
    expect(buildAuthoriserRows(null)).toEqual([])
  })

  test('returns empty array when authorisers is empty', () => {
    expect(buildAuthoriserRows([])).toEqual([])
  })

  test('maps authorisers to rows with checked=true', () => {
    const rows = buildAuthoriserRows([
      { fullName: 'Jane Smith', email: 'jane@example.com' }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].fullName).toBe('Jane Smith')
    expect(rows[0].email).toBe('jane@example.com')
    expect(rows[0].checked).toBe(true)
  })

  test('maps multiple authorisers with sequential indices', () => {
    const rows = buildAuthoriserRows([
      { fullName: 'Alice', email: 'alice@example.com' },
      { fullName: 'Bob', email: 'bob@example.com' }
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].index).toBe(0)
    expect(rows[1].index).toBe(1)
  })

  // RA-290 AC01: existing (seeded) authorisers default opted-in, and per
  // clarification newly added authorisers (flagged by AC03) do too.
  test('defaults both existing and newly-added authorisers to checked=true', () => {
    const rows = buildAuthoriserRows([
      { fullName: 'Alice', email: 'alice@example.com' },
      {
        fullName: 'Bob',
        email: 'bob@example.com',
        addedForAuthorityToIssue: true
      }
    ])
    expect(rows.every((r) => r.checked === true)).toBe(true)
  })
})

describe('#tonnageAuthorityController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  describe('GET /accreditation/tonnage-authority/{applicationId}', () => {
    test('returns 200 with the "Authority to issue PRNs" heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Authority to issue PRNs')
    })

    test('shows no-authorisers message when authorisers list is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-authorisers-message"')
    })

    test('renders authoriser table when authorisers exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="authorisers-table"')
      expect(result).toContain('Jane Smith')
      expect(result).toContain('jane@example.com')
    })

    test('pre-checks a newly-added authoriser as well as existing ones', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' },
              {
                fullName: 'Bob',
                email: 'bob@example.com',
                addedForAuthorityToIssue: true
              }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="jane@example\.com"[\s\S]*?checked/)
      expect(result).toMatch(/value="bob@example\.com"[\s\S]*?checked/)
    })

    test('pre-checks saved authorisers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="jane@example\.com"[\s\S]*?checked/)
    })

    test('redirects to tonnage page when tonnage has not been completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: undefined,
            authorisers: [],
            sectionStatus: 'NotStarted'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/accreditation/tonnage/${APPLICATION_ID}`)
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('renders add authoriser details element', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-authoriser-details"')
      expect(result).toContain('data-testid="add-authoriser-button"')
    })

    test('exporter GET shows PERN-specific intro and subheading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('authority to issue PERNs')
      expect(result).toContain(
        'You can choose who will have authority to issue PERNs.'
      )
      expect(result).toContain(
        'Select those who you want to have authority to issue PERNs.'
      )
    })

    test('redirects to query-task-list when application is Queried and PRNs section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [],
            sectionStatus: 'NotStarted'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test('renders the page read-only when application is Queried and PRNs section is Completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [{ fullName: 'Jane Doe', email: 'jane@example.com' }],
            sectionStatus: 'Completed'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="read-only-notice"')
      expect(result).not.toContain('data-testid="continue-button"')
      expect(result).not.toContain('data-testid="add-authoriser-details"')
      expect(result).toContain(
        `href="/accreditation/query-task-list/${APPLICATION_ID}"`
      )
    })

    test('renders the form and query note when PRNs section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [],
            sectionStatus: 'Queried'
          },
          query: { queryNote: 'Please confirm the authorised issuers.' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="query-note"')
      expect(result).toContain('Please confirm the authorised issuers.')
      expect(result).toContain('data-testid="regulator-query-banner"')
      expect(result).toContain(
        'The regulator has identified an issue with your tonnage and authority to issue PRNs.'
      )
    })

    test('does not render the "Update the application" change-link section', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [],
            sectionStatus: 'Queried'
          },
          query: { queryNote: 'Please confirm the authorised issuers.' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'data-testid="regulator-query-update-heading"'
      )
      expect(result).not.toContain('href="#authorisers-fieldset"')
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - addAuthoriser', () => {
    test('adds authoriser and redirects to same page on valid input', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/tonnage-authority/${APPLICATION_ID}`
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/tonnage'),
        expect.objectContaining({
          authorisers: expect.arrayContaining([
            expect.objectContaining({
              fullName: 'Jane Smith',
              email: 'jane@example.com',
              addedForAuthorityToIssue: true
            })
          ])
        })
      )
    })

    test('does not flag existing authorisers as newly added', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [{ fullName: 'Alice', email: 'alice@example.com' }],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Bob',
          newEmail: 'bob@example.com'
        }
      })

      const patchBody = patchSpy.mock.calls[0][1]
      const existing = patchBody.authorisers.find(
        (a) => a.email === 'alice@example.com'
      )
      const added = patchBody.authorisers.find(
        (a) => a.email === 'bob@example.com'
      )
      expect(existing.addedForAuthorityToIssue).toBeUndefined()
      expect(added.addedForAuthorityToIssue).toBe(true)
    })

    test('returns 400 with error when full name is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: '',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-full-name-error"')
    })

    test('returns 400 with error when email is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: ''
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 400 with error when email format is invalid', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'not-an-email'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 400 with error when email is a duplicate', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Again',
          newEmail: 'JANE@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-email-error"')
    })

    test('returns 500 when PATCH fails during addAuthoriser', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('appends new authoriser to existing list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [{ fullName: 'Alice', email: 'alice@example.com' }],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Bob',
          newEmail: 'bob@example.com'
        }
      })

      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.authorisers).toHaveLength(2)
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - saveAndContinue', () => {
    test('redirects to tonnage page without patching when tonnage has not been completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: undefined,
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'NotStarted'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/accreditation/tonnage/${APPLICATION_ID}`)
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 400 error when no checkboxes selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="field-error"')
    })

    test('patches with selected authorisers and redirects to prns-cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' },
              { fullName: 'Bob', email: 'bob@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/tonnage-cya/${APPLICATION_ID}`
      )
      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.authorisers).toHaveLength(1)
      expect(patchBody.authorisers[0].email).toBe('jane@example.com')
    })

    test('redirects to query-task-list when application is Queried and PRNs section is not, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          prns: {
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'Completed'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /accreditation/tonnage-authority/{applicationId} - saveAndComeLater', () => {
    test('patches and redirects to task list without requiring selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalled()
    })

    test('returns 500 when PATCH fails during saveAndContinue', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            authorisers: [
              { fullName: 'Jane Smith', email: 'jane@example.com' }
            ],
            sectionStatus: 'InProgress'
          }
        })
      )
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 500 when GET fetch fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('exporter addAuthoriser validation error shows 400', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: '',
          newEmail: ''
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="new-full-name-error"')
    })
  })

  // RA-292 AC03: the regulator's case-management view flags newly-added
  // authority-to-issue contacts. `isNew` is derived server-side and is
  // authoritative there; the operator journey must round-trip it untouched and
  // must never surface it to the operator.
  describe('RA-292 authoriser isNew round-trip', () => {
    function patchedAuthorisers(patchSpy) {
      return patchSpy.mock.calls.at(-1)[1].authorisers
    }

    function appWithAuthorisers(authorisers) {
      return makeApplication({
        prns: {
          plannedTonnageBand: 'UpTo1000',
          authorisers,
          sectionStatus: 'InProgress'
        }
      })
    }

    test('preserves isNew true and false through the selection step', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: ['jane@example.com', 'bob@example.com']
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(patchedAuthorisers(patchSpy)).toEqual([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
        { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
      ])
    })

    test('keeps isNew on surviving authorisers when one is unticked', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true },
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)).toEqual([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
      ])
    })

    test('does not fabricate isNew when the field is absent', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com' }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0]).not.toHaveProperty('isNew')
    })

    test('passes isNew through unchanged when it is null', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: null }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0].isNew).toBeNull()
    })

    test('saveAndComeLater also preserves isNew', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndComeLater',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(patchedAuthorisers(patchSpy)[0].isNew).toBe(true)
    })

    // Newness is derived server-side by merging on email. The operator side
    // must not guess it, so a freshly added authoriser is sent without the key.
    test('adding an authoriser keeps existing isNew and sets none on the new one', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Bob Jones', email: 'bob@example.com', isNew: false }
        ])
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      const sent = patchedAuthorisers(patchSpy)
      expect(sent[0]).toEqual({
        fullName: 'Bob Jones',
        email: 'bob@example.com',
        isNew: false
      })
      expect(sent[1]).not.toHaveProperty('isNew')
    })

    test('does not expose isNew to the operator on the rendered page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        appWithAuthorisers([
          { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
        ])
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Jane Smith')
      expect(result).not.toContain('isNew')
    })

    test('buildAuthoriserRows drops isNew from the view model', () => {
      const rows = buildAuthoriserRows([
        { fullName: 'Jane Smith', email: 'jane@example.com', isNew: true }
      ])
      expect(rows[0]).not.toHaveProperty('isNew')
    })
  })
})
