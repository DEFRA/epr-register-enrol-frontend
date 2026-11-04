import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import {
  DELTA_GREEN_ORG_ID,
  DELTA_GREEN_REGISTRATION_ID,
  DELTA_GREEN_SEEDED_MATERIAL,
  MANAGE_TEST_EXPORTER_MATERIAL,
  MANAGE_TEST_EXPORTER_REGISTRATION_ID,
  MANAGE_TEST_ORG_ID,
  MANAGE_TEST_ORG_NAME,
  MANAGE_TEST_REPROCESSOR_MATERIAL,
  MANAGE_TEST_REPROCESSOR_REGISTRATION_ID
} from '../common/constants/test-orgs.js'
import { dashboardUrl } from '../manage/helpers/manage-page.js'

function dashboardLink(
  organisationId,
  organisationName,
  registrationId,
  material
) {
  const materialType = material.charAt(0).toUpperCase() + material.slice(1)
  return {
    href: dashboardUrl({ organisationId, registrationId, materialType }),
    organisationName,
    materialType
  }
}

// The stub API has no plastic accreditation for Delta Green, and the backend's
// dev seed has no reprocessor for the manage test org, so each mode links to
// the reprocessor it can serve.
function reprocessorDashboardLink() {
  if (config.get('api.stubEnabled')) {
    return dashboardLink(
      MANAGE_TEST_ORG_ID,
      MANAGE_TEST_ORG_NAME,
      MANAGE_TEST_REPROCESSOR_REGISTRATION_ID,
      MANAGE_TEST_REPROCESSOR_MATERIAL
    )
  }
  return dashboardLink(
    DELTA_GREEN_ORG_ID,
    'Delta Green Ltd',
    DELTA_GREEN_REGISTRATION_ID,
    DELTA_GREEN_SEEDED_MATERIAL
  )
}

function manageDashboardLinks() {
  return {
    reprocessor: reprocessorDashboardLink(),
    exporter: dashboardLink(
      MANAGE_TEST_ORG_ID,
      MANAGE_TEST_ORG_NAME,
      MANAGE_TEST_EXPORTER_REGISTRATION_ID,
      MANAGE_TEST_EXPORTER_MATERIAL
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
      manageDashboardLinks: inYearChangesEnabled ? manageDashboardLinks() : null
    })
  }
}
