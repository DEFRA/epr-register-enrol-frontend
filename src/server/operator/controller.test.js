import { vi } from 'vitest'

import { config } from '../../config/config.js'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { currentYear, yearSuffix } from '../common/helpers/currentYear.js'

const YY = yearSuffix(currentYear())

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
    const DELTA_GREEN_MANAGE = 'href="/manage/50003/'
    const REPROCESSOR_MANAGE = `href="/manage/50018/R${YY}ER0500180002GR/Glass"`
    const EXPORTER_MANAGE = `href="/manage/50018/R${YY}EX0500180001PL/Plastic"`

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
            `href="/manage/50019/R${YY}EX0500190001PL/Plastic"`,
            'manage-in-year-change-link'
          )
        )
        expect(result).toMatch(
          linkWithTestId(
            `href="/manage/50020/R${YY}EX0500200001PL/Plastic"`,
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
            `href="/manage/50021/R${YY}EX0500210001PL/Plastic"`,
            'manage-registration-only-link'
          )
        )
        expect(result).toContain(
          'Exporter manage registration for Registration Only Exports Ltd, Plastic (registration only)'
        )
      }
    )

    // RA-697: org 50022, registered with no accreditation and no ORSs.
    test.each([true, false])(
      'lists the no-overseas-sites exporter manage page when the flag is on (stub API %s)',
      async (stubEnabled) => {
        setConfig({ inYearChangesEnabled: true, stubEnabled })

        const result = await getOperatorPage()

        expect(result).toMatch(
          linkWithTestId(
            `href="/manage/50022/R${YY}EX0500220001PL/Plastic"`,
            'manage-no-overseas-sites-link'
          )
        )
        expect(result).toContain(
          'Exporter manage registration for No Overseas Sites Exports Ltd, Plastic (no accredited or registered sites)'
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
