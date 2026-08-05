import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/operator'
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
        href: '/operator'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(buildNavigation(mockRequest({ path: '/operator' }))).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/operator'
      },
      {
        current: false,
        text: 'About',
        href: '/about'
      }
    ])
  })
})
