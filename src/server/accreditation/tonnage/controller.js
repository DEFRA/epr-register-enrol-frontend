import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

export const TONNAGE_OPTIONS = ['UpTo500', 'UpTo1000', 'UpTo10000', 'Over10000']

export function buildTonnageOptions(selectedTonnage, t) {
  return TONNAGE_OPTIONS.map((value) => ({
    value,
    text: t(`pages.tonnage.options.${value}`),
    checked: selectedTonnage === value
  }))
}

function buildHeading(materialType, isExporter, t) {
  const prefix = t('pages.tonnage.headingPrefix')
  const suffix = isExporter
    ? t('pages.tonnage.headingSuffixExporter')
    : t('pages.tonnage.headingSuffix')
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
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
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
        pageTitle: t('pages.tonnage.title'),
        heading: buildHeading(null, false, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        error: t('pages.tonnage.validation.fetchError')
      }).code(500)
    }

    const isExporter = application.isExporter ?? false

    return renderForm(h, {
      pageTitle: isExporter
        ? t('pages.tonnage.titleExporter')
        : t('pages.tonnage.title'),
      heading: buildHeading(application.materialType, isExporter, t),
      tonnageOptions: buildTonnageOptions(
        application.prns?.plannedTonnageBand ?? null,
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
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
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
        pageTitle: t('pages.tonnage.title'),
        heading: buildHeading(null, false, t),
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        errors: {
          plannedTonnageBand: {
            text: t('pages.tonnage.validation.fetchError')
          }
        }
      }).code(500)
    }

    const isExporter = application.isExporter ?? false
    const heading = buildHeading(application.materialType, isExporter, t)
    const selectTonnageKey = isExporter
      ? 'pages.tonnage.validation.selectTonnageExporter'
      : 'pages.tonnage.validation.selectTonnage'

    if (!plannedTonnageBand || !TONNAGE_OPTIONS.includes(plannedTonnageBand)) {
      return renderForm(h, {
        pageTitle: isExporter
          ? t('pages.tonnage.titleExporter')
          : t('pages.tonnage.title'),
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
          plannedTonnageBand
        }
      )
    } catch (error) {
      request.server.logger.error(
        `Error saving tonnage for ${applicationId}: ${error.message}`
      )
      if (!error.status || error.status >= 500) {
        return h
          .view('errors/service-problem', {
            pageTitle: t('common.errors.serviceTitle'),
            retryUrl: request.path
          })
          .code(500)
      }
      return renderForm(h, {
        pageTitle: isExporter
          ? t('pages.tonnage.titleExporter')
          : t('pages.tonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(plannedTonnageBand, t),
        backLink: taskListUrl(applicationId),
        isExporter,
        errors: {
          plannedTonnageBand: {
            text: t('pages.tonnage.validation.saveError')
          }
        }
      }).code(400)
    }

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(`/accreditation/tonnage-authority/${applicationId}`)
  }
}
