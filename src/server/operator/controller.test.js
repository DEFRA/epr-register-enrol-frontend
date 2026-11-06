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

  describe('RA-425 manage page links', () => {
    const DELTA_GREEN_MANAGE =
      'href="/manage/50003/aaa000000000000000050003/Plastic"'
    const REPROCESSOR_MANAGE =
      'href="/manage/50018/bbb000000000000000050018/Glass"'
    const EXPORTER_MANAGE =
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

    // RA-697: the backend's dev seed now has the manage test org's reprocessor too.
    test.each([true, false])(
      "links to the manage test org's glass reprocessor (stub API %s)",
      async (stubEnabled) => {
        setConfig({ inYearChangesEnabled: true, stubEnabled })

        const result = await getOperatorPage()

        expect(result).toMatch(
          linkWithTestId(REPROCESSOR_MANAGE, 'manage-reprocessor-link')
        )
        expect(result).toContain(
          'Reprocessor manage registration and accreditation for Manage Accreditation Test Ltd, Glass'
        )
        expect(result).not.toContain(DELTA_GREEN_MANAGE)
      }
    )

    test.each([true, false])(
      'lists the seeded exporter manage page when the flag is on (stub API %s)',
      async (stubEnabled) => {
        setConfig({ inYearChangesEnabled: true, stubEnabled })

        const result = await getOperatorPage()

        expect(result).toMatch(
          linkWithTestId(EXPORTER_MANAGE, 'manage-exporter-link')
        )
        expect(result).toContain(
          'Exporter manage registration and accreditation for Manage Accreditation Test Ltd, Plastic'
        )
        // RA-492: the in-year add-ORS journey's own exporter.
        expect(result).toMatch(
          linkWithTestId(
            'href="/manage/50019/aaa000000000000000050019/Plastic"',
            'manage-in-year-change-link'
          )
        )
        expect(result).toMatch(
          linkWithTestId(
            'href="/manage/50020/aaa000000000000000050020/Plastic"',
            'manage-no-change-requests-link'
          )
        )
        expect(result).toContain(
          'Exporter manage registration and accreditation for No Change Requests Ltd, Plastic'
        )
      }
    )

    // RA-697: org 50021, registered and never accredited.
    test.each([true, false])(
      'lists the registration-only exporter manage page when the flag is on (stub API %s)',
      async (stubEnabled) => {
        setConfig({ inYearChangesEnabled: true, stubEnabled })

        const result = await getOperatorPage()

        expect(result).toMatch(
          linkWithTestId(
            'href="/manage/50021/aaa000000000000000050021/Plastic"',
            'manage-registration-only-link'
          )
        )
        expect(result).toContain(
          'Exporter manage registration for Registration Only Exports Ltd, Plastic (RA-697 registration only)'
        )
      }
    )

    test('does not list any manage page when the flag is off', async () => {
      setConfig({ inYearChangesEnabled: false, stubEnabled: true })

      const result = await getOperatorPage()

      expect(result).not.toContain('/manage/')
      expect(result).not.toContain('manage-registration-only-link')
    })
  })
})
