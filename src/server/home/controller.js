/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const homeController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    const pageTitle = t('pages.home.title')
    const heading = t('pages.home.heading')

    return h.view('home/index', {
      pageTitle,
      heading
    })
  }
}
