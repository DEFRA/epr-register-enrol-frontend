import { vi } from 'vitest'

import { Cluster, Redis } from 'ioredis'

import { config } from '../../../config/config.js'
import { buildRedisClient } from './redis-client.js'
import { createLogger } from './logging/logger.js'

const mockLogger = { info: vi.fn(), error: vi.fn() }
vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn()
}))

const redisEventHandlers = {}
vi.mock('ioredis', () => ({
  ...vi.importActual('ioredis'),
  Cluster: vi.fn(function () {
    return {
      on: (event, handler) => {
        redisEventHandlers[event] = handler
      }
    }
  }),
  Redis: vi.fn(function () {
    return {
      on: (event, handler) => {
        redisEventHandlers[event] = handler
      }
    }
  })
}))

describe('#buildRedisClient', () => {
  beforeEach(() => {
    mockLogger.info.mockClear()
    mockLogger.error.mockClear()
    createLogger.mockReturnValue(mockLogger)
    delete redisEventHandlers.connect
    delete redisEventHandlers.error
  })

  describe('When Redis Single InstanceCache is requested', () => {
    beforeEach(() => {
      buildRedisClient(config.get('redis'))
    })

    test('Should instantiate a single Redis client', () => {
      expect(Redis).toHaveBeenCalledWith({
        db: 0,
        host: '127.0.0.1',
        keyPrefix: 'epr-register-enrol-frontend:',
        port: 6379
      })
    })
  })

  describe('When a Redis Cluster is requested', () => {
    beforeEach(() => {
      buildRedisClient({
        ...config.get('redis'),
        useSingleInstanceCache: false,
        useTLS: true,
        username: 'user',
        password: 'pass'
      })
    })

    test('Should instantiate a Redis Cluster client', () => {
      expect(Cluster).toHaveBeenCalledWith(
        [{ host: '127.0.0.1', port: 6379 }],
        {
          dnsLookup: expect.any(Function),
          keyPrefix: 'epr-register-enrol-frontend:',
          redisOptions: { db: 0, password: 'pass', tls: {}, username: 'user' },
          slotsRefreshTimeout: 10000
        }
      )
    })
  })

  describe('When the Redis client emits an error event', () => {
    test('Should log it via the shared structured error helper', () => {
      buildRedisClient(config.get('redis'))
      const error = new Error('connection refused')

      redisEventHandlers.error(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: error },
        'Redis connection error'
      )
    })
  })
})
