import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const notification = request.yar.flash('notification')[0] ?? null
    return h.view('operator/index', {
      pageTitle: t('pages.operator.title'),
      heading: t('pages.operator.heading'),
      notification
    })
  }
}
