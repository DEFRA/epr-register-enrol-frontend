import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { localePrefix } from '../common/helpers/localePrefix.js'

export const cookiesController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    const pageTitle = t('pages.cookies.title')
    const heading = t('pages.cookies.heading')

    return h.view('cookies/index', {
      pageTitle,
      heading,
      // The page has its own form for this choice.
      hideCookieBanner: true,
      breadcrumbs: [
        {
          text: t('navigation.home'),
          href: localePrefix(currentLocale) || '/'
        },
        {
          text: heading
        }
      ]
    })
  }
}
