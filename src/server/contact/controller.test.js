import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#contactController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/contact'
    })

    expect(result).toEqual(expect.stringContaining('Contact |'))
    expect(result).toContain('packaging@environment-agency.gov.uk')
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh locale', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/contact'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  // RA-487: exercises the real translation files end-to-end (unlike
  // build-navigation.test.js's hand-rolled translator mock), so a typo in a
  // navigation.* key would show up here as a literal untranslated key string
  // in the rendered nav rather than passing silently.
  test('Should render the real translated top nav for an authenticated operator', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/contact',
      headers: { 'x-test-user-type': 'operator' }
    })

    expect(result).toContain('data-testid="nav-home-link"')
    expect(result).toContain('data-testid="nav-manage-account-link"')
    expect(result).toContain('data-testid="nav-sign-out-link"')
    expect(result).toMatch(/nav-home-link"[^>]*>\s*Home\s*</)
    expect(result).toMatch(
      /nav-manage-account-link"[^>]*>\s*Manage account\s*</
    )
    expect(result).toMatch(/nav-sign-out-link"[^>]*>\s*Sign out\s*</)
  })

  test('Should render the real translated top nav in Welsh for an authenticated operator', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/cy/contact',
      headers: { 'x-test-user-type': 'operator' }
    })

    expect(result).toMatch(/nav-manage-account-link"[^>]*>\s*Rheoli cyfrif\s*</)
    expect(result).toMatch(/nav-sign-out-link"[^>]*>\s*Allgofnodi\s*</)
  })
})
