import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { apiClient } from '../../common/api-client.js'

const TONNAGE_LABEL_KEYS = {
  UpTo500: 'pages.prnsTonnage.options.UpTo500',
  UpTo1000: 'pages.prnsTonnage.options.UpTo1000',
  UpTo10000: 'pages.prnsTonnage.options.UpTo10000',
  Over10000: 'pages.prnsTonnage.options.Over10000'
}

export function buildTonnageLabel(tonnageBand, t) {
  const key = TONNAGE_LABEL_KEYS[tonnageBand]
  return key ? t(key) : t('pages.prnsCya.notSelected')
}

export function buildAuthorisersSummary(authorisers, t) {
  if (!authorisers || authorisers.length === 0) {
    return t('pages.prnsCya.noneSelected')
  }
  return authorisers.map((a) => a.FullName).join(', ')
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/prns-cya/index', viewData)
}

function appUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}`
}

function patchUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}/tonnage`
}

export const prnsCyaGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsCya.title'),
        heading: t('pages.prnsCya.heading'),
        backLink: taskListUrl(applicationId),
        error: t('pages.prnsCya.validation.fetchError')
      }).code(500)
    }

    const tonnageBand = application.Tonnage?.PlannedTonnageBand ?? null
    const authorisers = application.Tonnage?.Authorisers ?? []
    const fromCYA = '?fromCYA=true'

    return renderPage(h, {
      pageTitle: t('pages.prnsCya.title'),
      heading: t('pages.prnsCya.heading'),
      tonnageLabel: buildTonnageLabel(tonnageBand, t),
      authorisersSummary: buildAuthorisersSummary(authorisers, t),
      changeTonnageLink: `/accreditation/prns-tonnage/${applicationId}${fromCYA}`,
      changeAuthorityLink: `/accreditation/prns-authority/${applicationId}${fromCYA}`,
      backLink: taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId)
    })
  }
}

export const prnsCyaPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params
    const { submitAction = 'confirm' } = request.payload

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsCya.title'),
        heading: t('pages.prnsCya.heading'),
        backLink: taskListUrl(applicationId),
        error: t('pages.prnsCya.validation.fetchError')
      }).code(500)
    }

    const tonnageBand = application.Tonnage?.PlannedTonnageBand ?? null
    const authorisers = application.Tonnage?.Authorisers ?? []
    const fromCYA = '?fromCYA=true'

    try {
      await apiClient.patch(patchUrl(organisationId, applicationId), {
        PlannedTonnageBand: tonnageBand,
        Authorisers: authorisers,
        SectionStatus: 'Completed'
      })
    } catch (err) {
      request.server.logger.error(
        `Error confirming PRNs section for ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsCya.title'),
        heading: t('pages.prnsCya.heading'),
        tonnageLabel: buildTonnageLabel(tonnageBand, t),
        authorisersSummary: buildAuthorisersSummary(authorisers, t),
        changeTonnageLink: `/accreditation/prns-tonnage/${applicationId}${fromCYA}`,
        changeAuthorityLink: `/accreditation/prns-authority/${applicationId}${fromCYA}`,
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        error: t('pages.prnsCya.validation.confirmError')
      }).code(500)
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
