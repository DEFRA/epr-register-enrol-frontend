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
    ApplicationId: APPLICATION_ID,
    OrganisationId: 'test-operator-id',
    MaterialType: 'Steel',
    Year: 2025,
    SiteId: 'site-001',
    Tonnage: {
      PlannedTonnageBand: 'UpTo1000',
      Authorisers: [],
      SectionStatus: 'InProgress'
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildHeading', () => {
  test('builds heading with material and site', () => {
    const heading = buildHeading('Steel', 'Site A', t)
    expect(heading).toContain('Steel')
    expect(heading).toContain('Site A')
  })

  test('uses siteNotSet fallback when no site', () => {
    const heading = buildHeading('Steel', null, t)
    expect(heading).toContain('siteNotSet')
  })

  test('handles null materialType gracefully', () => {
    const heading = buildHeading(null, null, t)
    expect(heading).toBeDefined()
    expect(typeof heading).toBe('string')
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
      [{ FullName: 'Jane Smith', Email: 'jane@example.com' }],
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
        { FullName: 'Alice', Email: 'alice@example.com' },
        { FullName: 'Bob', Email: 'bob@example.com' }
      ],
      t
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].index).toBe(0)
    expect(rows[1].index).toBe(1)
  })
})

describe('#prnsAuthorityController', () => {
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

  describe('GET /accreditation/prns-authority/{applicationId}', () => {
    test('returns 200 with page heading containing material and site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-authorisers-message"')
    })

    test('renders authoriser table when authorisers exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          Tonnage: {
            PlannedTonnageBand: 'UpTo1000',
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="authorisers-table"')
      expect(result).toContain('Jane Smith')
      expect(result).toContain('jane@example.com')
    })

    test('pre-checks saved authorisers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          Tonnage: {
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="jane@example\.com"[\s\S]*?checked/)
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('renders add authoriser details element', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-authoriser-details"')
      expect(result).toContain('data-testid="add-authoriser-button"')
    })
  })

  describe('POST /accreditation/prns-authority/{applicationId} - addAuthoriser', () => {
    test('adds authoriser and redirects to same page on valid input', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Jane Smith',
          newEmail: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/prns-authority/${APPLICATION_ID}`
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/tonnage'),
        expect.objectContaining({
          Authorisers: expect.arrayContaining([
            expect.objectContaining({
              FullName: 'Jane Smith',
              Email: 'jane@example.com'
            })
          ])
        })
      )
    })

    test('returns 400 with error when full name is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
          Tonnage: {
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
          Tonnage: {
            Authorisers: [{ FullName: 'Alice', Email: 'alice@example.com' }],
            SectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'addAuthoriser',
          newFullName: 'Bob',
          newEmail: 'bob@example.com'
        }
      })

      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.Authorisers).toHaveLength(2)
    })
  })

  describe('POST /accreditation/prns-authority/{applicationId} - saveAndContinue', () => {
    test('returns 400 error when no checkboxes selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          Tonnage: {
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="field-error"')
    })

    test('patches with selected authorisers and redirects to prns-cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          Tonnage: {
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' },
              { FullName: 'Bob', Email: 'bob@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/prns-cya/${APPLICATION_ID}`
      )
      const patchBody = patchSpy.mock.calls[0][1]
      expect(patchBody.Authorisers).toHaveLength(1)
      expect(patchBody.Authorisers[0].Email).toBe('jane@example.com')
    })
  })

  describe('POST /accreditation/prns-authority/{applicationId} - saveAndComeLater', () => {
    test('patches and redirects to task list without requiring selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
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
          Tonnage: {
            Authorisers: [
              { FullName: 'Jane Smith', Email: 'jane@example.com' }
            ],
            SectionStatus: 'InProgress'
          }
        })
      )
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-authority/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'saveAndContinue',
          selectedEmails: 'jane@example.com'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
