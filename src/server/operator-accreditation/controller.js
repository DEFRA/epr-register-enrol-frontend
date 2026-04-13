import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorAccreditationController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      heading: t('pages.operatorAccreditation.heading')
    })
  }
}
