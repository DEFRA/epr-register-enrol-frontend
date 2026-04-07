import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const OrganisationsViewModel = [
  {
    name: 'Glass Recycling Export Import Company',
    id: 'GB806735831',
    foo: 'fooey'
  },
  {
    name: 'Metal and Metal (UK) Ltd',
    id: 'GB26734548',
    foo: 'ipsum'
  }
]

/**
 * Organisation List controller.
 */

export const organisationListController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('organisation-list/index', {
      pageTitle: t('pages.organisationList.title'),
      heading: t('pages.organisationList.heading'),
      organisationsViewModel: OrganisationsViewModel
    })
  }
}
