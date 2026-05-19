import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

export const TONNAGE_OPTIONS = ['UpTo500', 'UpTo1000', 'UpTo10000', 'Over10000']

export function buildTonnageOptions(selectedTonnage, t) {
  return TONNAGE_OPTIONS.map((value) => ({
    value,
    text: t(`pages.prnsTonnage.options.${value}`),
    checked: selectedTonnage === value
  }))
}

function buildHeading(materialType, t) {
  const prefix = t('pages.prnsTonnage.headingPrefix')
  const suffix = t('pages.prnsTonnage.headingSuffix')
  if (!materialType) return `${prefix} ${suffix}`
  const material = t(`pages.materialSelection.materials.${materialType}`)
  return `${prefix} ${material} ${suffix}`
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderForm(h, viewData) {
  return h.view('accreditation/prns-tonnage/index', viewData)
}

export const prnsTonnageGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${error.message}`
      )
      return renderForm(h, {
        pageTitle: t('pages.prnsTonnage.title'),
        heading: buildHeading(null, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        error: t('pages.prnsTonnage.validation.fetchError')
      }).code(500)
    }

    return renderForm(h, {
      pageTitle: t('pages.prnsTonnage.title'),
      heading: buildHeading(application.MaterialType, t),
      tonnageOptions: buildTonnageOptions(
        application.Tonnage?.PlannedTonnageBand ?? null,
        t
      ),
      backLink: taskListUrl(applicationId)
    })
  }
}

export const prnsTonnagePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params
    const { plannedTonnageBand, submitAction = 'saveAndContinue' } =
      request.payload

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${error.message}`
      )
      return renderForm(h, {
        pageTitle: t('pages.prnsTonnage.title'),
        heading: buildHeading(null, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        errors: {
          plannedTonnageBand: {
            text: t('pages.prnsTonnage.validation.fetchError')
          }
        }
      }).code(500)
    }

    const heading = buildHeading(application.MaterialType, t)

    if (!plannedTonnageBand || !TONNAGE_OPTIONS.includes(plannedTonnageBand)) {
      return renderForm(h, {
        pageTitle: t('pages.prnsTonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        errors: {
          plannedTonnageBand: {
            text: t('pages.prnsTonnage.validation.selectTonnage')
          }
        }
      }).code(400)
    }

    try {
      await accreditationApiService.patchTonnage(
        organisationId,
        applicationId,
        {
          PlannedTonnageBand: plannedTonnageBand
        }
      )
    } catch (error) {
      request.server.logger.error(
        `Error saving PRNs tonnage for ${applicationId}: ${error.message}`
      )
      return renderForm(h, {
        pageTitle: t('pages.prnsTonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(plannedTonnageBand, t),
        backLink: taskListUrl(applicationId),
        errors: {
          plannedTonnageBand: {
            text: t('pages.prnsTonnage.validation.saveError')
          }
        }
      }).code(500)
    }

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(`/accreditation/prns-authority/${applicationId}`)
  }
}
