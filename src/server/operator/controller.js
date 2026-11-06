import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import {
  DELTA_GREEN_ORG_ID,
  DELTA_GREEN_SEEDED_ORG_NAME,
  DELTA_GREEN_REGISTRATION_ID,
  DELTA_GREEN_SEEDED_MATERIAL,
  IN_YEAR_CHANGE_MATERIAL,
  IN_YEAR_CHANGE_ORG_ID,
  IN_YEAR_CHANGE_ORG_NAME,
  IN_YEAR_CHANGE_REGISTRATION_ID,
  MANAGE_EXPORTER_MATERIAL,
  MANAGE_EXPORTER_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_ORG_NAME,
  MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL,
  MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID
} from '../common/constants/test-orgs.js'
import { manageUrl } from '../manage/helpers/manage-page.js'

function manageLink(
  organisationId,
  organisationName,
  registrationId,
  material
) {
  const materialType = material.charAt(0).toUpperCase() + material.slice(1)
  return {
    href: manageUrl({ organisationId, registrationId, materialType }),
    organisationName,
    materialType
  }
}

// The stub API has no plastic accreditation for Delta Green, and the backend's
// dev seed has no reprocessor for the manage test org, so each mode links to
// the reprocessor it can serve.
function reprocessorManageLink() {
  if (config.get('api.stubEnabled')) {
    return manageLink(
      MANAGE_EXPORTER_ORG_ID,
      MANAGE_EXPORTER_ORG_NAME,
      MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
      MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL
    )
  }
  return manageLink(
    DELTA_GREEN_ORG_ID,
    DELTA_GREEN_SEEDED_ORG_NAME,
    DELTA_GREEN_REGISTRATION_ID,
    DELTA_GREEN_SEEDED_MATERIAL
  )
}

function manageLinks() {
  return {
    reprocessor: reprocessorManageLink(),
    exporter: manageLink(
      MANAGE_EXPORTER_ORG_ID,
      MANAGE_EXPORTER_ORG_NAME,
      MANAGE_EXPORTER_REGISTRATION_ID,
      MANAGE_EXPORTER_MATERIAL
    ),
    // RA-492: the in-year add-ORS journey's own exporter.
    inYearChange: manageLink(
      IN_YEAR_CHANGE_ORG_ID,
      IN_YEAR_CHANGE_ORG_NAME,
      IN_YEAR_CHANGE_REGISTRATION_ID,
      IN_YEAR_CHANGE_MATERIAL
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
      manageLinks: inYearChangesEnabled ? manageLinks() : null
    })
  }
}
