import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'
import { config } from '../config/config.js'

const originalConfigGet = config.get.bind(config)

function mockConfig(overrides) {
  vi.spyOn(config, 'get').mockImplementation((key) =>
    key in overrides ? overrides[key] : originalConfigGet(key)
  )
}

describe('#test pages (RA-459) — TEST_PAGES_DISABLED=true', () => {
  let server

  beforeAll(async () => {
    mockConfig({ 'testPages.disabled': true })

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  test('GET / 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /{language} 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /operator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/operator'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /{language}/operator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('other single-segment paths are unaffected (still 400 via the language param guard)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/not-a-real-language'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#test pages (RA-459) — TEST_PAGES_DISABLED=false (default)', () => {
  let server

  beforeAll(async () => {
    mockConfig({ 'testPages.disabled': false })

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  test('GET / works', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-test-user-type': 'operator' }
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('GET /operator works', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/operator'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })
})
