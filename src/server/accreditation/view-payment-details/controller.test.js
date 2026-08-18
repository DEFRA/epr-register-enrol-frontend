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

    test('renders the regulator-tailored payment reference, not the accreditation reference', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="bank-payment-reference"')
      expect(result).toContain('PR/PK/REP/test-operator-id')
      expect(result).not.toContain('APP2027ER5000390GL')
    })

    test('renders England bank details by default (no derivable postcode)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="bank-sort-code"')
      expect(result).toContain('60-70-80')
      expect(result).toContain('data-testid="bank-account-number"')
      expect(result).toContain('10014411')
      expect(result).toContain('data-testid="bank-account-name"')
      expect(result).toContain('EA RECEIPTS')
      expect(result).toContain('data-testid="bank-company-name"')
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

      // 2 sites x £328 = £656
      expect(result).toContain('£656.00 for 2 Overseas Sites')
      // total = £546 (tonnage) + £656 (overseas sites) = £1,202
      expect(result).toContain('£1,202.00')
    })

    test('counts only selected !== false sites when calculating the ORS fee', async () => {
      // 3 sites total; 1 deselected → only 2 should count toward the fee
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: { plannedTonnageBand: 'UpTo500' },
          overseasSites: {
            sites: [
              { siteId: 1, selected: true },
              { siteId: 2, selected: true },
              { siteId: 3, selected: false }
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      // 2 selected sites x £328 = £656; total = £546 + £656 = £1,202
      expect(result).toContain('£656.00 for 2 Overseas Sites')
      expect(result).toContain('£1,202.00')
      expect(result).not.toContain('3 Overseas Sites')
    })

    test('omits the ORS fee line entirely when all overseas sites are deselected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: { plannedTonnageBand: 'UpTo500' },
          overseasSites: {
            sites: [
              { siteId: 1, selected: false },
              { siteId: 2, selected: false }
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('Overseas Sites')
      // total is tonnage-only
      expect(result).toContain('£546.00')
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
        ['UpTo5000', '£2,184.00'],
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
          glassRecyclingProcess: ['glass_re_melt']
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
          glassRecyclingProcess: ['glass_other']
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

    test('falls back to plain Glass when glassRecyclingProcess is an empty array', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ materialType: 'Glass', glassRecyclingProcess: [] })
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
          glassRecyclingProcess: ['glass_re_melt']
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

    describe('nation-specific bank details', () => {
      const cases = [
        {
          nation: 'Scotland',
          siteAddress: {
            line1: '1 High St',
            town: 'Edinburgh',
            postcode: 'EH1 1AA'
          },
          expectPresent: {
            'bank-sort-code': '83 – 34 – 00',
            'bank-account-number': '00137187',
            'bank-account-name': 'Scottish Environment Protection Agency',
            'bank-name':
              'Royal Bank of Scotland, 30 Nicholson Street, Edinburgh, EH8 9DL'
          },
          expectAbsentTestIds: ['bank-company-name', 'bank-company-address']
        },
        {
          nation: 'Wales',
          siteAddress: {
            line1: '1 Bay Rd',
            town: 'Cardiff',
            postcode: 'CF10 1AA'
          },
          expectPresent: {
            'bank-sort-code': '60-70-80',
            'bank-account-number': '10014438',
            'bank-company-name': 'Natural Resources Wales',
            'bank-name':
              'RBS, National Westminster bank plc, 2 ½ Devonshire Square, London, EC2M 4BA',
            'bank-company-address':
              'Income department, PO BOX 663, Cardiff, CF24 0TP'
          },
          expectAbsentTestIds: ['bank-account-name']
        },
        {
          nation: 'Northern Ireland',
          siteAddress: {
            line1: '1 High St',
            town: 'Belfast',
            postcode: 'BT1 1AA'
          },
          expectPresent: {
            'bank-sort-code': '95-01-21',
            'bank-account-number': '61253506',
            'bank-account-name': 'DAERA',
            'bank-name':
              'Danske bank, PO BOX 183 Donegall Square West, Belfast, BT1 6JS'
          },
          expectAbsentTestIds: ['bank-company-name', 'bank-company-address']
        },
        {
          nation: 'England (explicit postcode)',
          siteAddress: { line1: 'UNIT 5', town: 'Bolton', postcode: 'BL4 7AQ' },
          expectPresent: {
            'bank-sort-code': '60-70-80',
            'bank-account-number': '10014411',
            'bank-account-name': 'EA RECEIPTS',
            'bank-company-name': 'Environment Agency'
          },
          expectAbsentTestIds: ['bank-company-address']
        }
      ]

      test.each(cases)(
        'shows correct bank fields for $nation',
        async ({ siteAddress, expectPresent, expectAbsentTestIds }) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication({ siteAddress })
          )

          const { result } = await server.inject({
            method: 'GET',
            url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
            headers: operatorHeaders
          })

          for (const [testId, value] of Object.entries(expectPresent)) {
            expect(result).toContain(`data-testid="${testId}"`)
            expect(result).toContain(value)
          }
          for (const testId of expectAbsentTestIds) {
            expect(result).not.toContain(`data-testid="${testId}"`)
          }
        }
      )

      test.each([
        {
          nation: 'Scotland',
          companyRegisterAddressPostcode: 'KW2 7LZ',
          expectPresent: {
            'bank-sort-code': '83 – 34 – 00',
            'bank-account-number': '00137187',
            'bank-account-name': 'Scottish Environment Protection Agency'
          }
        },
        {
          nation: 'Wales',
          companyRegisterAddressPostcode: 'CF10 1AA',
          expectPresent: {
            'bank-sort-code': '60-70-80',
            'bank-account-number': '10014438',
            'bank-company-name': 'Natural Resources Wales'
          }
        },
        {
          nation: 'Northern Ireland',
          companyRegisterAddressPostcode: 'BT1 1AA',
          expectPresent: {
            'bank-sort-code': '95-01-21',
            'bank-account-number': '61253506',
            'bank-account-name': 'DAERA'
          }
        }
      ])(
        'exporter (no siteAddress) resolves $nation from companyRegisterAddressPostcode',
        async ({ companyRegisterAddressPostcode, expectPresent }) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication({
              siteAddress: null,
              companyRegisterAddressPostcode
            })
          )

          const { result } = await server.inject({
            method: 'GET',
            url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
            headers: operatorHeaders
          })

          for (const [testId, value] of Object.entries(expectPresent)) {
            expect(result).toContain(`data-testid="${testId}"`)
            expect(result).toContain(value)
          }
          expect(result).not.toContain(
            'Application submitted to the Environment Agency'
          )
        }
      )

      test('falls back to England when postcode is unrecognised', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            siteAddress: {
              line1: '1 Fake St',
              town: 'Nowhere',
              postcode: 'ZZ99 9ZZ'
            }
          })
        )

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).toContain('EA RECEIPTS')
        expect(result).toContain('10014411')
      })

      test('application.nation takes precedence over postcode derivation', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            nation: 'Scotland',
            siteAddress: {
              line1: 'UNIT 5',
              town: 'Bolton',
              postcode: 'BL4 7AQ'
            }
          })
        )

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).toContain('Scottish Environment Protection Agency')
        expect(result).not.toContain('data-testid="bank-company-name"')
      })

      test('banner and overseas-payments text use the resolved regulator name per nation', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            siteAddress: {
              line1: '1 Bay Rd',
              town: 'Cardiff',
              postcode: 'CF10 1AA'
            }
          })
        )

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).toContain('data-testid="banner-heading"')
        expect(result).toContain('Natural Resources Wales')
        expect(result).not.toContain(
          'Application submitted to the Environment Agency'
        )
      })
    })

    describe('regulator payment reference (RA-426)', () => {
      test.each([
        ['England', false, 'PR/PK/REP/test-operator-id'],
        ['England', true, 'PR/PK/EXP/test-operator-id'],
        ['NorthernIreland', false, 'NI/PR/REEX/test-operator-id'],
        ['NorthernIreland', true, 'NI/PR/REEX/test-operator-id'],
        ['Wales', false, 'PREX/test-operator-id'],
        ['Wales', true, 'PREX/test-operator-id'],
        ['Scotland', false, 'E800 81581/test-operator-id'],
        ['Scotland', true, 'E800 81581/test-operator-id']
      ])(
        'renders %s reference for nation %s isExporter %s',
        async (nation, isExporter, expectedReference) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication({ nation, isExporter })
          )

          const { result } = await server.inject({
            method: 'GET',
            url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
            headers: operatorHeaders
          })

          expect(result).toContain('data-testid="bank-payment-reference"')
          expect(result).toContain(expectedReference)
        }
      )
    })

    describe('tailored regulator contact block (RA-426)', () => {
      const ALL_REGULATOR_EMAILS = [
        'packagingnotifications@environment-agency.gov.uk',
        'repandexp@daera-ni.gov.uk',
        'packaging@naturalresourceswales.gov.uk',
        'producer.responsibility@sepa.org.uk'
      ]

      test.each([
        [
          'England',
          'Environment Agency',
          'packagingnotifications@environment-agency.gov.uk'
        ],
        [
          'NorthernIreland',
          'Northern Ireland Environment Agency',
          'repandexp@daera-ni.gov.uk'
        ],
        [
          'Wales',
          'Natural Resources Wales',
          'packaging@naturalresourceswales.gov.uk'
        ],
        [
          'Scotland',
          'Scottish Environment Protection Agency',
          'producer.responsibility@sepa.org.uk'
        ]
      ])(
        'shows only the %s regulator contact details, not the other three',
        async (nation, expectedName, expectedEmail) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication({ nation })
          )

          const { result } = await server.inject({
            method: 'GET',
            url: `/accreditation/view-payment-details/${APPLICATION_ID}`,
            headers: operatorHeaders
          })

          expect(result).toContain('data-testid="contact-regulator-heading"')
          expect(result).toContain('Contact your regulator')
          expect(result).toContain(expectedName)
          expect(result).toContain(expectedEmail)

          const otherEmails = ALL_REGULATOR_EMAILS.filter(
            (email) => email !== expectedEmail
          )
          for (const email of otherEmails) {
            expect(result).not.toContain(email)
          }
        }
      )
    })
  })
})
