import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../server.js'

const APPLICATION_ID = 'app-cya-return-001'
const BASE = `/accreditation/add-overseas-site/${APPLICATION_ID}`
const CYA_URL = `${BASE}/check-your-answers`
const headers = { 'x-test-user-type': 'operator' }

const STEPS = [
  'site-name',
  'site-location',
  'site-contact-details',
  'recycling-operation-details',
  'basel-convention-and-oecd-code',
  'repatriated-loads',
  'conditions-of-export'
]

function backHref(html) {
  return /data-testid="back-link"/.test(html)
    ? /<a href="([^"]+)"[^>]*data-testid="back-link"/.exec(html)?.[1]
    : undefined
}

describe('RA-573 return to check-your-answers', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each(STEPS)(
    '%s back link returns to check-your-answers when reached via Change',
    async (step) => {
      const { result } = await server.inject({
        method: 'GET',
        url: `${BASE}/${step}?from=check-your-answers`,
        headers
      })
      expect(backHref(result)).toBe(CYA_URL)
    }
  )

  test('back link is unchanged without the tag', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `${BASE}/site-location`,
      headers
    })
    expect(backHref(result)).toBe(`${BASE}/site-name`)
  })
})
