// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { initSessionNotice } from './session-notice.js'

function renderNotice(variant = 'alert') {
  document.body.innerHTML = `
    <div id="content">
      <div data-module="app-session-notice"
           data-testid="session-notice"
           data-variant="${variant}"
           data-dismiss-url="/auth/session-notice/dismiss">
        <div class="govuk-notification-banner"></div>
        <form class="app-session-notice__dismiss" method="post"
              action="/auth/session-notice/dismiss">
          <input type="hidden" name="crumb" value="crumb-123">
          <button type="submit" data-testid="session-notice-dismiss">Hide</button>
        </form>
      </div>
    </div>
  `
  return document.querySelector('[data-module="app-session-notice"]')
}

beforeEach(() => {
  document.body.innerHTML = ''
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initSessionNotice', () => {
  it('is a no-op when there is no notice on the page', () => {
    document.body.innerHTML = '<div id="content"></div>'
    expect(() => initSessionNotice(document)).not.toThrow()
  })

  it('lifts the banner into a toast on <body> with an alert role', () => {
    renderNotice('alert')
    initSessionNotice(document)

    const toast = document.body.querySelector(
      '[data-module="app-session-notice"]'
    )
    expect(toast.parentElement).toBe(document.body)
    expect(toast.classList.contains('app-session-notice--toast')).toBe(true)
    expect(toast.getAttribute('role')).toBe('alert')
    expect(toast.getAttribute('aria-live')).toBe('assertive')
  })

  it('uses role=status / polite for the info variant', () => {
    renderNotice('info')
    initSessionNotice(document)
    const toast = document.querySelector('[data-module="app-session-notice"]')
    expect(toast.getAttribute('role')).toBe('status')
    expect(toast.getAttribute('aria-live')).toBe('polite')
  })

  it('POSTs the dismissal and removes the toast when Hide is clicked', async () => {
    renderNotice('alert')
    initSessionNotice(document)

    document
      .querySelector('.app-session-notice__dismiss')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-module="app-session-notice"]')
      ).toBeNull()
    )

    expect(global.fetch).toHaveBeenCalledWith(
      '/auth/session-notice/dismiss',
      expect.objectContaining({ method: 'POST' })
    )
    const body = global.fetch.mock.calls[0][1].body
    expect(body.get('crumb')).toBe('crumb-123')
  })

  it('falls back to a full form submit if the fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    const submitSpy = vi
      .spyOn(window.HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {})

    renderNotice('alert')
    initSessionNotice(document)

    document
      .querySelector('.app-session-notice__dismiss')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))

    await vi.waitFor(() => expect(submitSpy).toHaveBeenCalled())
  })

  it('dismisses on the Escape key', async () => {
    renderNotice('alert')
    initSessionNotice(document)

    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape' })
    )
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-module="app-session-notice"]')
      ).toBeNull()
    )
  })
})
