import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { apiClient } from '../common/api-client.js'

export const organisationListController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    try {
      const organisations = await apiClient.get('/organisation')

      return h.view('organisation-list/index', {
        pageTitle: t('pages.organisationList.title'),
        heading: t('pages.organisationList.heading'),
        organisationsViewModel: organisations
      })
    } catch (error) {
      request.server.logger.error(
        `Error fetching organisations from API: ${error.message}`
      )

      // Return empty list on error to gracefully handle API failures
      return h.view('organisation-list/index', {
        pageTitle: t('pages.organisationList.title'),
        heading: t('pages.organisationList.heading'),
        organisationsViewModel: [],
        error:
          t('pages.organisationList.error') || 'Failed to load organisations'
      })
    }
  }
}
