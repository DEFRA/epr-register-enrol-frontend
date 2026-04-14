import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorRegistrationBankDetailsController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('operator-registration-bank-details/index', {
      pageTitle: t('pages.operatorRegistrationBankDetails.title'),
      heading: t('pages.operatorRegistrationBankDetails.heading')
    })
  }
}
