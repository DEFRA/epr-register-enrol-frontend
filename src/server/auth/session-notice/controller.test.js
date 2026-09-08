import { describe, test, expect, vi, beforeEach } from 'vitest'

const dismissNotice = vi.fn()
vi.mock('../../common/helpers/auth/concurrent-login.js', () => ({
  dismissNotice: (...args) => dismissNotice(...args)
}))

const { dismissSessionNoticeController } = await import('./controller.js')

function makeH() {
  const response = { code: vi.fn().mockReturnThis() }
  return {
    response: vi.fn(() => response),
    redirect: vi.fn((to) => ({ redirectedTo: to })),
    _response: response
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dismissSessionNoticeController', () => {
  test('always records the dismissal', async () => {
    const request = {
      headers: {},
      info: { referrer: 'https://app.example/task-list', host: 'app.example' }
    }
    await dismissSessionNoticeController(request, makeH())
    expect(dismissNotice).toHaveBeenCalledWith(request)
  })

  test('returns 204 for a fetch (Accept: application/json)', async () => {
    const h = makeH()
    const request = {
      headers: { accept: 'application/json' },
      info: { referrer: '/x' }
    }
    await dismissSessionNoticeController(request, h)
    expect(h.response).toHaveBeenCalled()
    expect(h._response.code).toHaveBeenCalledWith(204)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('redirects back to the same-host referrer path for a no-JS form post', async () => {
    const h = makeH()
    const request = {
      headers: {},
      info: {
        referrer: 'https://app.example/accreditation/task-list?foo=1',
        host: 'app.example'
      }
    }
    await dismissSessionNoticeController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/accreditation/task-list?foo=1')
  })

  test('ignores a cross-host referrer (no open redirect) and falls back to /', async () => {
    const h = makeH()
    const request = {
      headers: {},
      info: { referrer: 'https://evil.example/phish', host: 'app.example' }
    }
    await dismissSessionNoticeController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  test('ignores a non-URL referrer and falls back to /', async () => {
    const h = makeH()
    const request = {
      headers: {},
      info: { referrer: 'not a url', host: 'app.example' }
    }
    await dismissSessionNoticeController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  test('redirects to / when there is no referrer', async () => {
    const h = makeH()
    await dismissSessionNoticeController(
      { headers: {}, info: { host: 'app.example' } },
      h
    )
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})
