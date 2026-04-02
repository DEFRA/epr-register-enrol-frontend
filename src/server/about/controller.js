/**
 * A GDS styled example about page controller.
 * Provided as an example, remove or modify as required.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const aboutController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    const pageTitle = t('pages.about.title')
    const heading = t('pages.about.heading')

    return h.view('about/index', {
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
