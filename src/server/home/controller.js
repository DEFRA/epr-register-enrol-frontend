/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { isRegulator } from '../common/helpers/auth/get-user.js'

export const homeController = {
  handler(request, h) {
    const { currentLocale, t } = getLocaleAndTranslator(request)

    if (isRegulator(request)) {
      const isLanguagePrefixed = request.path.startsWith(`/${currentLocale}`)
      return h.redirect(
        isLanguagePrefixed ? `/${currentLocale}/regulator` : '/regulator'
      )
    }

    const pageTitle = t('pages.home.title')
    const heading = t('pages.home.heading')

    return h.view('home/index', {
      pageTitle,
      heading
    })
  }
}
