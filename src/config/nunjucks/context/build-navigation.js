export function buildNavigation(request) {
  return [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    },
    {
      text: 'File Upload',
      href: '/file-upload',
      current: request?.path?.startsWith('/file-upload') ?? false
    }
  ]
}
