import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { localePrefix } from '../common/helpers/localePrefix.js'

export const contactController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    const pageTitle = t('pages.contact.title')
    const heading = t('pages.contact.heading')

    return h.view('contact/index', {
      pageTitle,
      heading,
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
