import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import {
  IN_YEAR_CHANGE_MATERIAL,
  IN_YEAR_CHANGE_ORG_ID,
  IN_YEAR_CHANGE_ORG_NAME,
  IN_YEAR_CHANGE_REGISTRATION_ID,
  MANAGE_EXPORTER_MATERIAL,
  MANAGE_EXPORTER_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_ORG_NAME,
  MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL,
  MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
  NO_CHANGE_REQUESTS_MATERIAL,
  NO_CHANGE_REQUESTS_ORG_ID,
  NO_CHANGE_REQUESTS_ORG_NAME,
  NO_CHANGE_REQUESTS_REGISTRATION_ID,
  REGISTRATION_ONLY_MATERIAL,
  REGISTRATION_ONLY_ORG_ID,
  REGISTRATION_ONLY_ORG_NAME,
  REGISTRATION_ONLY_REGISTRATION_ID
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

function manageLinks() {
  return {
    // RA-697: the stub API and the backend's dev seed both have it.
    reprocessor: manageLink(
      MANAGE_EXPORTER_ORG_ID,
      MANAGE_EXPORTER_ORG_NAME,
      MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
      MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL
    ),
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
    ),
    noChangeRequests: manageLink(
      NO_CHANGE_REQUESTS_ORG_ID,
      NO_CHANGE_REQUESTS_ORG_NAME,
      NO_CHANGE_REQUESTS_REGISTRATION_ID,
      NO_CHANGE_REQUESTS_MATERIAL
    ),
    // RA-697: registered, never accredited.
    registrationOnly: manageLink(
      REGISTRATION_ONLY_ORG_ID,
      REGISTRATION_ONLY_ORG_NAME,
      REGISTRATION_ONLY_REGISTRATION_ID,
      REGISTRATION_ONLY_MATERIAL
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
