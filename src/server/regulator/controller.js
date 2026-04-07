/**
 * Regulator dashboard controller.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const regulatorController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('regulator/index', {
      pageTitle: t('pages.regulator.title'),
      heading: t('pages.regulator.heading')
    })
  }
}
