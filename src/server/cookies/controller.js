import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const cookiesController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    const pageTitle = t('pages.cookies.title')
    const heading = t('pages.cookies.heading')

    return h.view('cookies/index', {
      pageTitle,
      heading,
      breadcrumbs: [
        {
          text: t('navigation.home'),
          href: currentLocale === 'cy' ? '/cy' : '/'
        },
        {
          text: heading
        }
      ]
    })
  }
}
