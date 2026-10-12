// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startTagManager } from './analytics.js'

const GTM_SRC = 'https://www.googletagmanager.com/gtm.js?id=GTM-TEST'

const tagManagerScripts = () =>
  document.querySelectorAll('script[src^="https://www.googletagmanager.com/"]')

function publishContainerId(id) {
  document.head.innerHTML = `<meta name="analytics-gtm-container-id" content="${id}">`
}

describe('startTagManager', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    delete window.dataLayer
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T09:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads nothing when the page carries no container id', () => {
    startTagManager()

    expect(tagManagerScripts()).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
  })

  it('loads the named container asynchronously', () => {
    publishContainerId('GTM-TEST')

    startTagManager()

    const [tag] = tagManagerScripts()
    expect(tag.src).toBe(GTM_SRC)
    expect(tag.async).toBe(true)
  })

  it('starts the data layer the way the GTM snippet does', () => {
    publishContainerId('GTM-TEST')

    startTagManager()

    expect(window.dataLayer).toEqual([
      { 'gtm.start': Date.parse('2026-10-12T09:00:00.000Z'), event: 'gtm.js' }
    ])
  })

  it('keeps anything already queued on the data layer', () => {
    publishContainerId('GTM-TEST')
    window.dataLayer = [{ event: 'earlier' }]

    startTagManager()

    expect(window.dataLayer[0]).toEqual({ event: 'earlier' })
    expect(window.dataLayer).toHaveLength(2)
  })

  it('loads the container only once', () => {
    publishContainerId('GTM-TEST')

    startTagManager()
    startTagManager()

    expect(tagManagerScripts()).toHaveLength(1)
    expect(window.dataLayer).toHaveLength(1)
  })

  it('keeps the id to the query string', () => {
    publishContainerId('GTM-TEST&l=other')

    startTagManager()

    expect(tagManagerScripts()[0].src).toBe(
      'https://www.googletagmanager.com/gtm.js?id=GTM-TEST%26l%3Dother'
    )
  })
})
