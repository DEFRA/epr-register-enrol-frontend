import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { apiClient } from '../../common/api-client.js'

const MATERIAL_WASTE_CODES = {
  Steel: 'R4',
  Wood: 'R3',
  Aluminium: 'R4',
  Fibre: 'R3',
  Glass: 'R5',
  Paper: 'R3',
  Plastic: 'R3'
}

const ALL_MATERIALS = Object.keys(MATERIAL_WASTE_CODES)

export function buildMaterialOptions(
  applications,
  selectedMaterial,
  currentYear,
  t
) {
  const appliedMaterials = new Set(
    applications
      .filter((app) => app.Year === currentYear)
      .map((app) => app.MaterialType)
  )

  return ALL_MATERIALS.map((material) => {
    const alreadyApplied = appliedMaterials.has(material)
    return {
      value: material,
      text: `${t(`pages.materialSelection.materials.${material}`)} (${MATERIAL_WASTE_CODES[material]})`,
      checked: selectedMaterial === material,
      disabled: alreadyApplied,
      hint: alreadyApplied
        ? { text: t('pages.materialSelection.alreadyApplied') }
        : null
    }
  })
}

async function fetchApplications(organisationId, logger) {
  try {
    return await apiClient.get(
      `/api/v1/accreditation-applications/${organisationId}`
    )
  } catch (error) {
    logger.error(`Error fetching accreditation applications: ${error.message}`)
    return []
  }
}

export const materialSelectionGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const currentYear = new Date().getFullYear()

    const applications = await fetchApplications(
      organisationId,
      request.server.logger
    )

    return h.view('accreditation/material-selection/index', {
      pageTitle: t('pages.materialSelection.title'),
      heading: t('pages.materialSelection.heading'),
      materialOptions: buildMaterialOptions(applications, null, currentYear, t),
      backLink: '/operator-accreditation'
    })
  }
}

export const materialSelectionPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const currentYear = new Date().getFullYear()
    const { materialType } = request.payload

    if (!materialType) {
      const applications = await fetchApplications(
        organisationId,
        request.server.logger
      )

      return h
        .view('accreditation/material-selection/index', {
          pageTitle: t('pages.materialSelection.title'),
          heading: t('pages.materialSelection.heading'),
          materialOptions: buildMaterialOptions(
            applications,
            null,
            currentYear,
            t
          ),
          backLink: '/operator-accreditation',
          errors: {
            materialType: {
              text: t('pages.materialSelection.validation.selectMaterial')
            }
          }
        })
        .code(400)
    }

    let application
    try {
      application = await apiClient.post(
        `/api/v1/accreditation-applications/${organisationId}/seed`,
        { materialType, year: currentYear, siteId: null }
      )
    } catch (error) {
      request.server.logger.error(
        `Error creating accreditation application: ${error.message}`
      )

      const applications = await fetchApplications(
        organisationId,
        request.server.logger
      )

      return h
        .view('accreditation/material-selection/index', {
          pageTitle: t('pages.materialSelection.title'),
          heading: t('pages.materialSelection.heading'),
          materialOptions: buildMaterialOptions(
            applications,
            materialType,
            currentYear,
            t
          ),
          backLink: '/operator-accreditation',
          errors: {
            materialType: {
              text: t('pages.materialSelection.validation.createError')
            }
          }
        })
        .code(500)
    }

    request.yar.set('accreditationApplicationId', application.ApplicationId)

    return h.redirect(`/accreditation/task-list/${application.ApplicationId}`)
  }
}
