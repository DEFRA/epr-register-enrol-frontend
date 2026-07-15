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
    applicationStatus: 'Submitted',
    prns: { plannedTonnageBand: 'UpTo500' },
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

    test('renders the payment breakdown for tonnage only', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { plannedTonnageBand: 'UpTo500' } })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="amount-due"')
      expect(result).toContain('£546.00')
      expect(result).toContain('data-testid="description-heading"')
      expect(result).toContain('Up to 500 tonnes accreditation for Glass')
      expect(result).not.toContain('Overseas Sites')
    })

    test('includes the overseas sites fee line when overseas sites are present', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: { plannedTonnageBand: 'UpTo500' },
          overseasSites: {
            sites: [{ siteId: 1 }, { siteId: 2 }]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      // 2 sites x £346 = £692
      expect(result).toContain('£692.00 for 2 Overseas Sites')
      // total = £546 (tonnage) + £692 (overseas sites) = £1,238
      expect(result).toContain('£1,238.00')
    })

    test('omits the overseas sites fee line when there are no overseas sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { plannedTonnageBand: 'UpTo500' } })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('Overseas Sites')
    })

    test('calculates the correct fee for each tonnage band', async () => {
      const cases = [
        ['UpTo500', '£546.00'],
        ['UpTo1000', '£2,184.00'],
        ['UpTo10000', '£3,276.00'],
        ['Over10000', '£3,965.00']
      ]

      for (const [plannedTonnageBand, expectedAmount] of cases) {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({ prns: { plannedTonnageBand } })
        )

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).toContain(expectedAmount)
      }
    })

    test('returns 500 with error message when tonnage has not been set', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { plannedTonnageBand: null } })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="load-error"')
    })

    test('does not leak payment details between concurrent requests for different applications', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
        if (url.includes(APPLICATION_ID)) {
          return makeApplication({
            materialType: 'Glass',
            prns: { plannedTonnageBand: 'UpTo500' }
          })
        }
        return makeApplication({
          applicationId: 'app-inv-002',
          materialType: 'Steel',
          prns: { plannedTonnageBand: 'Over10000' }
        })
      })

      const [first, second] = await Promise.all([
        server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
          headers: operatorHeaders
        }),
        server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/app-inv-002`,
          headers: operatorHeaders
        })
      ])

      expect(first.result).toContain('£546.00')
      expect(first.result).toContain('Glass')
      expect(second.result).toContain('£3,965.00')
      expect(second.result).toContain('Steel')
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

    test('shows Glass - Remelt when glassRecyclingProcess is glass_re_melt', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          materialType: 'Glass',
          glassRecyclingProcess: 'glass_re_melt'
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Glass - Remelt')
      expect(result).not.toContain('Glass - Other')
    })

    test('shows Glass - Other when glassRecyclingProcess is glass_other', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          materialType: 'Glass',
          glassRecyclingProcess: 'glass_other'
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Glass - Other')
      expect(result).not.toContain('Glass - Remelt')
    })

    test('falls back to plain Glass when glassRecyclingProcess is not set', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ materialType: 'Glass', glassRecyclingProcess: null })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Glass')
      expect(result).not.toContain('Glass - Remelt')
      expect(result).not.toContain('Glass - Other')
    })

    test('does not apply the Remelt/Other distinction to non-Glass materials', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          materialType: 'Steel',
          glassRecyclingProcess: 'glass_re_melt'
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Steel')
      expect(result).not.toContain('Glass - Remelt')
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
