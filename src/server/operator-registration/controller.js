import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorRegistrationController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-registration/index', {
      pageTitle: t('pages.operatorRegistration.title'),
      heading: t('pages.operatorRegistration.heading')
    })
  }
}
