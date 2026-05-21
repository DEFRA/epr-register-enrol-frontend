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
  test('builds heading with material and site', () => {
    const heading = buildHeading('Steel', 'Site A', false, t)
    expect(heading).toContain('Steel')
    expect(heading).toContain('Site A')
  })

  test('uses siteNotSet fallback when no site', () => {
    const heading = buildHeading('Steel', null, false, t)
    expect(heading).toContain('siteNotSet')
  })

  test('handles null materialType gracefully', () => {
    const heading = buildHeading(null, null, false, t)
    expect(heading).toBeDefined()
    expect(typeof heading).toBe('string')
  })

  test('uses exporter prefix when isExporter is true', () => {
    const heading = buildHeading('Plastic', 'Site B', true, t)
    expect(heading).toContain('headingPrefixExporter')
    expect(heading).toContain('Plastic')
  })
})

describe('#buildAuthoriserRows', () => {
  test('returns empty array when authorisers is null', () => {
    expect(buildAuthoriserRows(null, t)).toEqual([])
  })

  test('returns empty array when authorisers is empty', () => {
    expect(buildAuthoriserRows([], t)).toEqual([])
  })

  test('maps authorisers to rows with checked=true', () => {
    const rows = buildAuthoriserRows(
      [{ fullName: 'Jane Smith', email: 'jane@example.com' }],
      t
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].fullName).toBe('Jane Smith')
    expect(rows[0].email).toBe('jane@example.com')
    expect(rows[0].checked).toBe(true)
  })

  test('maps multiple authorisers with sequential indices', () => {
    const rows = buildAuthoriserRows(
      [
        { fullName: 'Alice', email: 'alice@example.com' },
        { fullName: 'Bob', email: 'bob@example.com' }
      ],
      t
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].index).toBe(0)
    expect(rows[1].index).toBe(1)
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
    test('returns 200 with page heading containing material and site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Steel')
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

    test('pre-checks saved authorisers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
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
      expect(result).toContain('issue PERNs on this system')
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
              email: 'jane@example.com'
            })
          ])
        })
      )
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
    test('returns 400 error when no checkboxes selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
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
})
