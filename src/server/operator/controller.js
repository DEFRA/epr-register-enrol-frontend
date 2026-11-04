import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import {
  DELTA_GREEN_STUB_ORG_ID,
  DELTA_GREEN_STUB_REGISTRATION_ID
} from '../common/stub-api-client.js'
import {
  MANAGE_STUB_EXPORTER_REGISTRATION_ID,
  manageStubOrgDoc
} from '../common/stub-manage-accreditations.js'

function dashboardHref(organisationId, registrationId, material) {
  const materialType = material.charAt(0).toUpperCase() + material.slice(1)
  return `/manage/${organisationId}/${registrationId}/${materialType}`
}

// RA-425: test-only links, built from the stub entries so the ids live in one
// place.
function manageDashboardHrefs() {
  const exporterDoc = manageStubOrgDoc()
  const exporter = exporterDoc.accreditations.find(
    (accreditation) =>
      accreditation.registrationId === MANAGE_STUB_EXPORTER_REGISTRATION_ID
  )
  return {
    // Plastic, not the frontend stub's glass: the backend's
    // DevAccreditationHistorySeedService approves Delta Green for plastic.
    deltaGreen: dashboardHref(
      DELTA_GREEN_STUB_ORG_ID,
      DELTA_GREEN_STUB_REGISTRATION_ID,
      'plastic'
    ),
    exporter: dashboardHref(
      exporterDoc.orgId,
      exporter.registrationId,
      exporter.material
    )
  }
}

export const operatorController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const notification = request.yar.flash('notification')[0] ?? null
    const inYearChangesEnabled = config.get('featureFlags.inYearChangesEnabled')
    return h.view('operator/index', {
      pageTitle: t('pages.operator.title'),
      heading: t('pages.operator.heading'),
      notification,
      inYearChangesEnabled,
      manageDashboardHrefs: inYearChangesEnabled ? manageDashboardHrefs() : null
    })
  }
}
