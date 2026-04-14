import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorRegistrationRenewalController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-registration-renewal/index', {
      pageTitle: t('pages.operatorRegistrationRenewal.title'),
      heading: t('pages.operatorRegistrationRenewal.heading')
    })
  }
}
