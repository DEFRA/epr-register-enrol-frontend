import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const OrganisationsViewModel = [
  {
    name: 'GLASSROOM EXPORT UK LTD',
    id: '07620513 ',
    foo: 'fooey'
  },
  {
    name: 'METAL RECYCLING LIMITED',
    id: '03323288 ',
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
