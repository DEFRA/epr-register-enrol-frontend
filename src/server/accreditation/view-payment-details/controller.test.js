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

const APPLICATION_ID = 'app-inv-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Glass',
    siteAddress: 'North Road, Siteville, SI1 1AA',
    accreditationReference: 'APP2027ER5000390GL',
    applicationStatus: 'Sent',
    submittedBy: {
      name: 'Rosina Campbell',
      email: 'rosina@gws.com',
      jobTitle: 'Director'
    },
    ...overrides
  }
}

describe('#viewPaymentDetailsController', () => {
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

  describe('GET /accreditation/view-payment-details/{applicationId}', () => {
    test('returns 200 and renders page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders site name as first segment of siteAddress', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="site-name"')
      expect(result).toContain('North Road')
      expect(result).not.toContain('Siteville')
    })

    test('renders submitter email and name in success banner', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="success-banner"')
      expect(result).toContain('rosina@gws.com')
      expect(result).toContain('Rosina Campbell')
    })

    test('renders the payment reference', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="bank-payment-reference"')
      expect(result).toContain('APP2027ER5000390GL')
    })

    test('renders static bank details', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="bank-sort-code"')
      expect(result).toContain('30 94 30')
      expect(result).toContain('data-testid="bank-account-number"')
      expect(result).toContain('00733445')
      expect(result).toContain('data-testid="bank-account-name"')
      expect(result).toContain('Environment Agency')
      expect(result).toContain('data-testid="bank-amount"')
      expect(result).toContain('£546')
    })

    test('renders translated material in heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Glass')
    })

    test('renders glass recycling process suffix when set', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ glassRecyclingProcess: 'glass_re_melt' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Glass - Remelt')
    })

    test('handles missing submittedBy gracefully — no crash', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ submittedBy: null })
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('handles null siteAddress gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ siteAddress: null })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="site-name"')
    })

    test('returns 500 with error message when API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="load-error"')
    })

    test('back link points to submit-confirmation', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/submit-confirmation/${APPLICATION_ID}"`
      )
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] View payment details')
    })
  })
})
