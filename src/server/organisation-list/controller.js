/**
 * Organisation List controller.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const organisationListController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('organisation-list/index', {
      pageTitle: t('pages.organisationList.title'),
      heading: t('pages.organisationList.heading')
    })
  }
}
