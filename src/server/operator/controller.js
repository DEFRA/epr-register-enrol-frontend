import { apiClient } from '../common/api-client.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const operatorController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    const organisations = await apiClient.get('/organisation')
    const orgsWithApplications = await Promise.all(
      organisations.map(async (org) => {
        const applications = await apiClient.get(
          `/api/v1/accreditation-applications/${org.orgId ?? org.id}`
        )
        return { org, applications }
      })
    )

    return h.view('operator/index', {
      pageTitle: t('pages.operator.title'),
      heading: t('pages.operator.heading'),
      orgsWithApplications
    })
  }
}
