import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import {
  IN_YEAR_CHANGE_ORG,
  MANAGE_EXPORTER_ORG,
  MANAGE_EXPORTER_ORG_REPROCESSOR,
  NO_CHANGE_REQUESTS_ORG,
  NO_OVERSEAS_SITES_ORG,
  REGISTRATION_ONLY_ORG
} from '../common/constants/test-orgs.js'
import { manageUrl } from '../manage/helpers/manage-urls.js'

function manageLink({ orgId, orgName, registrationId, material }) {
  const materialType = material.charAt(0).toUpperCase() + material.slice(1)
  return {
    href: manageUrl({ organisationId: orgId, registrationId, materialType }),
    organisationName: orgName,
    materialType
  }
}

function manageLinks() {
  return {
    // RA-697: the stub API and the backend's dev seed both have it.
    reprocessor: manageLink(MANAGE_EXPORTER_ORG_REPROCESSOR),
    exporter: manageLink(MANAGE_EXPORTER_ORG),
    // RA-492: the in-year add-ORS journey's own exporter.
    inYearChange: manageLink(IN_YEAR_CHANGE_ORG),
    noChangeRequests: manageLink(NO_CHANGE_REQUESTS_ORG),
    // RA-697: registered, never accredited.
    registrationOnly: manageLink(REGISTRATION_ONLY_ORG),
    // RA-697: registered, never accredited, with no registered ORSs.
    noOverseasSites: manageLink(NO_OVERSEAS_SITES_ORG)
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
