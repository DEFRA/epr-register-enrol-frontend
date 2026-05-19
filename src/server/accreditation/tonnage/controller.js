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

function buildHeading(materialType, isExporter, t) {
  const prefix = t('pages.prnsTonnage.headingPrefix')
  const suffix = isExporter
    ? t('pages.prnsTonnage.headingSuffixExporter')
    : t('pages.prnsTonnage.headingSuffix')
  if (!materialType) return `${prefix} ${suffix}`
  const material = t(`pages.materialSelection.materials.${materialType}`)
  return `${prefix} ${material} ${suffix}`
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderForm(h, viewData) {
  return h.view('accreditation/tonnage/index', viewData)
}

export const tonnageGetController = {
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
        heading: buildHeading(null, false, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        error: t('pages.prnsTonnage.validation.fetchError')
      }).code(500)
    }

    const isExporter = application.IsExporter ?? false

    return renderForm(h, {
      pageTitle: isExporter
        ? t('pages.prnsTonnage.titleExporter')
        : t('pages.prnsTonnage.title'),
      heading: buildHeading(application.MaterialType, isExporter, t),
      tonnageOptions: buildTonnageOptions(
        application.Tonnage?.PlannedTonnageBand ?? null,
        t
      ),
      backLink: taskListUrl(applicationId),
      isExporter
    })
  }
}

export const tonnagePostController = {
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
        heading: buildHeading(null, false, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        errors: {
          plannedTonnageBand: {
            text: t('pages.prnsTonnage.validation.fetchError')
          }
        }
      }).code(500)
    }

    const isExporter = application.IsExporter ?? false
    const heading = buildHeading(application.MaterialType, isExporter, t)
    const selectTonnageKey = isExporter
      ? 'pages.prnsTonnage.validation.selectTonnageExporter'
      : 'pages.prnsTonnage.validation.selectTonnage'

    if (!plannedTonnageBand || !TONNAGE_OPTIONS.includes(plannedTonnageBand)) {
      return renderForm(h, {
        pageTitle: isExporter
          ? t('pages.prnsTonnage.titleExporter')
          : t('pages.prnsTonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        isExporter,
        errors: {
          plannedTonnageBand: {
            text: t(selectTonnageKey)
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
        `Error saving tonnage for ${applicationId}: ${error.message}`
      )
      return renderForm(h, {
        pageTitle: isExporter
          ? t('pages.prnsTonnage.titleExporter')
          : t('pages.prnsTonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(plannedTonnageBand, t),
        backLink: taskListUrl(applicationId),
        isExporter,
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

    return h.redirect(`/accreditation/tonnage-authority/${applicationId}`)
  }
}
