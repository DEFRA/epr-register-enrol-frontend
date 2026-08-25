import { vi } from 'vitest'
import { config } from '../../config.js'
import { buildNavigation } from './build-navigation.js'

const realConfigGet = config.get.bind(config)

function mockRequest(userType) {
  return {
    auth: userType ? { credentials: { userType } } : undefined
  }
}

function mockTranslator() {
  const strings = {
    'navigation.home': 'Home',
    'navigation.manageAccount': 'Manage account',
    'navigation.signOut': 'Sign out'
  }
  return (key) => strings[key]
}

describe('#buildNavigation', () => {
  let t

  beforeEach(() => {
    t = mockTranslator()
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'reex.frontendBaseUrl') {
        return 'https://reex.example.test'
      }
      if (key === 'auth.defraId.manageAccountUrl') {
        return 'https://manage-account.example.test'
      }
      return realConfigGet(key)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('operator sees Home (Re-Ex), Manage account (Defra ID) and Sign out', () => {
    expect(buildNavigation(mockRequest('operator'), t)).toEqual([
      {
        text: 'Home',
        href: 'https://reex.example.test',
        attributes: { 'data-testid': 'nav-home-link' }
      },
      {
        text: 'Manage account',
        href: 'https://manage-account.example.test',
        attributes: { 'data-testid': 'nav-manage-account-link' }
      },
      {
        text: 'Sign out',
        href: '/auth/logout',
        attributes: { 'data-testid': 'nav-sign-out-link' }
      }
    ])
  })

  test('regulator sees Home (regulator landing page) and Sign out, no Manage account', () => {
    expect(buildNavigation(mockRequest('regulator'), t)).toEqual([
      {
        text: 'Home',
        href: '/regulator',
        attributes: { 'data-testid': 'nav-home-link' }
      },
      {
        text: 'Sign out',
        href: '/auth/logout',
        attributes: { 'data-testid': 'nav-sign-out-link' }
      }
    ])
  })

  test('no session (pre-login pages, 404s, etc.) shows no navigation', () => {
    expect(buildNavigation(mockRequest(undefined), t)).toEqual([])
    expect(buildNavigation(undefined, t)).toEqual([])
    expect(buildNavigation({}, t)).toEqual([])
  })

  test('an unrecognised userType shows no navigation rather than throwing', () => {
    expect(buildNavigation(mockRequest('something-else'), t)).toEqual([])
  })
})
