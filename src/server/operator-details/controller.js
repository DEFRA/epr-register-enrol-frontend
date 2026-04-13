import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorDetailsController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-details/index', {
      pageTitle: t('pages.operatorDetails.title'),
      heading: t('pages.operatorDetails.heading')
    })
  }
}
