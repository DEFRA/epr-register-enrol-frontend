/**
 * operator dashboard controller.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator/index', {
      pageTitle: t('pages.operator.title'),
      heading: t('pages.operator.heading')
    })
  }
}
