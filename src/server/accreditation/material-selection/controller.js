import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { apiClient } from '../../common/api-client.js'

// Waste recovery operation codes defined in Schedule 3 of the Environmental Permitting Regulations.
// R3 = recycling of organic materials (paper, wood, fibre, plastic), R4 = recycling of metals,
// R5 = recycling of inorganic materials (glass). Accreditations are granted per material/operation pair.
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

async function fetchApplications(organisationId) {
  return apiClient.get(`/api/v1/accreditation-applications/${organisationId}`)
}

export const materialSelectionGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const currentYear = new Date().getFullYear()

    let applications = []
    try {
      applications = await fetchApplications(organisationId)
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation applications: ${error.message}`
      )
    }

    return h.view('accreditation/material-selection/index', {
      pageTitle: t('pages.materialSelection.title'),
      heading: t('pages.materialSelection.heading'),
      materialOptions: buildMaterialOptions(applications, null, currentYear, t),
      backLink: '/operator-accreditation'
    })
  }
}

export function isAlreadyApplied(applications, materialType, currentYear) {
  return applications.some(
    (app) => app.Year === currentYear && app.MaterialType === materialType
  )
}

function renderForm(h, viewData) {
  return h.view('accreditation/material-selection/index', viewData)
}

export const materialSelectionPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const currentYear = new Date().getFullYear()
    const { materialType } = request.payload

    let applications
    try {
      applications = await fetchApplications(organisationId)
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation applications: ${error.message}`
      )
      return renderForm(h, {
        pageTitle: t('pages.materialSelection.title'),
        heading: t('pages.materialSelection.heading'),
        backLink: '/operator-accreditation',
        materialOptions: buildMaterialOptions([], null, currentYear, t),
        errors: {
          materialType: {
            text: t('pages.materialSelection.validation.fetchError')
          }
        }
      }).code(500)
    }

    const baseViewData = {
      pageTitle: t('pages.materialSelection.title'),
      heading: t('pages.materialSelection.heading'),
      backLink: '/operator-accreditation'
    }

    if (!materialType) {
      return renderForm(h, {
        ...baseViewData,
        materialOptions: buildMaterialOptions(
          applications,
          null,
          currentYear,
          t
        ),
        errors: {
          materialType: {
            text: t('pages.materialSelection.validation.selectMaterial')
          }
        }
      }).code(400)
    }

    if (!ALL_MATERIALS.includes(materialType)) {
      return renderForm(h, {
        ...baseViewData,
        materialOptions: buildMaterialOptions(
          applications,
          null,
          currentYear,
          t
        ),
        errors: {
          materialType: {
            text: t('pages.materialSelection.validation.selectMaterial')
          }
        }
      }).code(400)
    }

    if (isAlreadyApplied(applications, materialType, currentYear)) {
      return renderForm(h, {
        ...baseViewData,
        materialOptions: buildMaterialOptions(
          applications,
          materialType,
          currentYear,
          t
        ),
        errors: {
          materialType: {
            text: t('pages.materialSelection.alreadyApplied')
          }
        }
      }).code(400)
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

      return renderForm(h, {
        ...baseViewData,
        materialOptions: buildMaterialOptions(
          applications,
          materialType,
          currentYear,
          t
        ),
        errors: {
          materialType: {
            text: t('pages.materialSelection.validation.createError')
          }
        }
      }).code(500)
    }

    request.yar.set('accreditationApplicationId', application.ApplicationId)

    return h.redirect(`/accreditation/task-list/${application.ApplicationId}`)
  }
}
