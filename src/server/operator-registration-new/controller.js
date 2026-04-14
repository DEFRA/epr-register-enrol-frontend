import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorRegistrationNewController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-registration-new/index', {
      pageTitle: t('pages.operatorRegistrationNew.title'),
      heading: t('pages.operatorRegistrationNew.heading')
    })
  }
}
