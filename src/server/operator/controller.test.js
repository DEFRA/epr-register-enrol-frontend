import { vi } from 'vitest'

import { config } from '../../config/config.js'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#operatorController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response in English', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/en/operator'
    })

    expect(result).toEqual(
      expect.stringContaining('Operator Testing Flows Landing Page')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator'
    })

    expect(result).toEqual(
      expect.stringContaining('[Welsh] Operator Landing Page')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator'
    })

    expect(result).toEqual(expect.stringContaining('Operator'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('RA-425 material dashboard links', () => {
    const DELTA_GREEN_DASHBOARD =
      'href="/manage/50003/aaa000000000000000050003/Plastic"'
    const STUB_REPROCESSOR_DASHBOARD =
      'href="/manage/50018/bbb000000000000000050018/Glass"'
    const EXPORTER_DASHBOARD =
      'href="/manage/50018/aaa000000000000000050018/Plastic"'

    function setConfig({ inYearChangesEnabled, stubEnabled }) {
      const realGet = config.get.bind(config)
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'featureFlags.inYearChangesEnabled') {
          return inYearChangesEnabled
        }
        if (key === 'api.stubEnabled') {
          return stubEnabled
        }
        return realGet(key)
      })
    }

    async function getOperatorPage() {
      const { result } = await server.inject({
        method: 'GET',
        url: '/operator'
      })
      return result
    }

    const linkWithTestId = (href, testId) =>
      new RegExp(`${href}[^>]*data-testid="${testId}"`)

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('links to the Delta Green plastic reprocessor dashboard with the real backend', async () => {
      setConfig({ inYearChangesEnabled: true, stubEnabled: false })

      const result = await getOperatorPage()

      expect(result).toMatch(
        linkWithTestId(
          DELTA_GREEN_DASHBOARD,
          'manage-dashboard-reprocessor-link'
        )
      )
      expect(result).toContain(
        'Reprocessor material dashboard for Delta Green Ltd, Plastic'
      )
      expect(result).not.toContain(STUB_REPROCESSOR_DASHBOARD)
    })

    test('links to a reprocessor dashboard the stub API serves when the stub is on', async () => {
      setConfig({ inYearChangesEnabled: true, stubEnabled: true })

      const result = await getOperatorPage()

      expect(result).toMatch(
        linkWithTestId(
          STUB_REPROCESSOR_DASHBOARD,
          'manage-dashboard-reprocessor-link'
        )
      )
      expect(result).toContain(
        'Reprocessor material dashboard for Manage Accreditation Test Ltd, Glass'
      )
      expect(result).not.toContain(DELTA_GREEN_DASHBOARD)
    })

    test.each([true, false])(
      'lists the seeded exporter dashboard when the flag is on (stub API %s)',
      async (stubEnabled) => {
        setConfig({ inYearChangesEnabled: true, stubEnabled })

        const result = await getOperatorPage()

        expect(result).toMatch(
          linkWithTestId(EXPORTER_DASHBOARD, 'manage-dashboard-exporter-link')
        )
        expect(result).toContain(
          'Exporter material dashboard for Manage Accreditation Test Ltd, Plastic'
        )
      }
    )

    test('does not list any dashboard when the flag is off', async () => {
      setConfig({ inYearChangesEnabled: false, stubEnabled: true })

      const result = await getOperatorPage()

      expect(result).not.toContain('/manage/')
    })
  })
})
