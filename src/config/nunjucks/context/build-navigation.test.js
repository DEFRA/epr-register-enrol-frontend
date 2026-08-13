import { buildNavigation } from './build-navigation.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../server/common/constants/accreditationSessionKeys.js'

function mockRequest({ path, session = {} } = {}) {
  return {
    path,
    yar: {
      get: (key) => session[key]
    }
  }
}

function mockSession({
  organisationId = '50003',
  registrationId = 'aaa000000000000000050003',
  materialType = 'Plastic',
  year = 2027
} = {}) {
  return {
    [ACCREDITATION_SESSION_KEYS.organisationId]: organisationId,
    [ACCREDITATION_SESSION_KEYS.registrationId]: registrationId,
    [ACCREDITATION_SESSION_KEYS.materialType]: materialType,
    [ACCREDITATION_SESSION_KEYS.year]: year
  }
}

describe('#buildNavigation', () => {
  test('Should point Home at the landing status page when the session has a full application context', () => {
    expect(
      buildNavigation(
        mockRequest({
          path: '/accreditation/task-list/app-1',
          session: mockSession()
        })
      )
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/50003/aaa000000000000000050003/Plastic/2027'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should highlight Home as current when already on the landing status page', () => {
    const href =
      '/operator-accreditation/50003/aaa000000000000000050003/Plastic/2027'
    expect(
      buildNavigation(mockRequest({ path: href, session: mockSession() }))
    ).toEqual([
      {
        current: true,
        text: 'Home',
        href
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should fall back to the bare operator-accreditation href when there is no session', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should fall back to the bare operator-accreditation href when the session is missing part of the context', () => {
    const session = mockSession()
    delete session[ACCREDITATION_SESSION_KEYS.year]
    expect(
      buildNavigation(
        mockRequest({ path: '/accreditation/task-list/app-1', session })
      )
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should not highlight Home on the pre-login marketing page', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should point Home at the bare operator-accreditation href on the stub login page, even with a session', () => {
    expect(
      buildNavigation(
        mockRequest({ path: '/auth/stub/login', session: mockSession() })
      )
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should point Home at the bare operator-accreditation href on the /operator testing page, even with a session', () => {
    expect(
      buildNavigation(
        mockRequest({ path: '/operator', session: mockSession() })
      )
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should point Home at the bare operator-accreditation href on the bare operator-accreditation page, even with a session', () => {
    expect(
      buildNavigation(
        mockRequest({
          path: '/operator-accreditation/',
          session: mockSession()
        })
      )
    ).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should provide expected navigation details when request has no yar (e.g. not yet wired up)', () => {
    expect(buildNavigation({ path: '/non-existent-path' })).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should fall back to the bare operator-accreditation href when yar is uninitialized (e.g. a 404 error page, where onPreAuth never ran)', () => {
    const uninitializedYar = {
      get: () => {
        throw new TypeError("Cannot read properties of null (reading 'foo')")
      }
    }
    expect(
      buildNavigation({ path: '/non-existent-path', yar: uninitializedYar })
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator-accreditation/'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })
})
