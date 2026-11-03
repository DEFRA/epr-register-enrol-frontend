import { vi } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { setFeatureFlag } from '../common/test-helpers/feature-flags.js'

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
    const EXPORTER_DASHBOARD =
      'href="/manage/50018/aaa000000000000000050018/Plastic"'

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('lists the Delta Green reprocessor dashboard when the flag is on', async () => {
      setFeatureFlag('inYearChangesEnabled', true)

      const { result } = await server.inject({
        method: 'GET',
        url: '/operator'
      })

      expect(result).toMatch(
        new RegExp(
          `${DELTA_GREEN_DASHBOARD}[^>]*data-testid="manage-dashboard-delta-green-link"`
        )
      )
    })

    test('lists the seeded exporter dashboard when the flag is on', async () => {
      setFeatureFlag('inYearChangesEnabled', true)

      const { result } = await server.inject({
        method: 'GET',
        url: '/operator'
      })

      expect(result).toMatch(
        new RegExp(
          `${EXPORTER_DASHBOARD}[^>]*data-testid="manage-dashboard-exporter-link"`
        )
      )
    })

    test('does not list either dashboard when the flag is off', async () => {
      setFeatureFlag('inYearChangesEnabled', false)

      const { result } = await server.inject({
        method: 'GET',
        url: '/operator'
      })

      expect(result).not.toContain(DELTA_GREEN_DASHBOARD)
      expect(result).not.toContain(EXPORTER_DASHBOARD)
    })
  })
})
