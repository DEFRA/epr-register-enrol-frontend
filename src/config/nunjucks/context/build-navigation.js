export function buildNavigation(request) {
  return [
    {
      text: 'Home',
      href: '/operator',
      current: request?.path === '/operator'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]
}
