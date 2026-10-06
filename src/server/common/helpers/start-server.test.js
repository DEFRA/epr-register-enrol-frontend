import { vi } from 'vitest'

import hapi from '@hapi/hapi'
import { statusCodes } from '../constants/status-codes.js'
import { config } from '../../../config/config.js'

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let startServerImport
  let createServerImport

  beforeAll(async () => {
    vi.stubEnv('PORT', '3097')

    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'port') {
        return 3097
      }
      return originalGet(key)
    })

    createServerImport = await import('../../server.js')
    startServerImport = await import('./start-server.js')

    createServerSpy = vi.spyOn(createServerImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should start up server as expected', async () => {
      server = await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('When analytics is switched on without a measurement id', () => {
    let server
    let original

    beforeAll(() => {
      original = {
        isEnabled: config.get('analytics.isEnabled'),
        measurementId: config.get('analytics.measurementId')
      }
      config.set('analytics.isEnabled', true)
      config.set('analytics.measurementId', '')
    })

    afterAll(async () => {
      config.set('analytics.isEnabled', original.isEnabled)
      config.set('analytics.measurementId', original.measurementId)
      await server?.stop({ timeout: 0 })
    })

    test('logs the misconfiguration and still starts', async () => {
      const enabledImport = await import('../analytics/enabled.js')
      const logSpy = vi.spyOn(enabledImport, 'logAnalyticsMisconfiguration')

      server = await startServerImport.startServer()

      expect(logSpy).toHaveBeenCalledWith(server.logger)
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )
    })
  })
})
