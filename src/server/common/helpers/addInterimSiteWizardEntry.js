import { getLocaleAndTranslator } from './get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from './overseasSiteWizardGuard.js'

// RA-486: every add-interim-site wizard step (GET and POST alike) opens with
// the same three lines - resolve the translator, read organisationId out of
// session, and run the shared entry guard against the same fallback URL.
// Pulled out once the sixth step-controller file repeated it, rather than
// leaving it duplicated across every step.
/**
 * @param {object} params
 * @param {import('@hapi/hapi').Request} params.request
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 * @param {string} params.applicationId
 * @returns {Promise<{t: Function, organisationId: string, guardRedirect: object|null}>}
 */
export async function enterInterimSiteWizardStep({
  request,
  h,
  applicationId
}) {
  const { t } = getLocaleAndTranslator(request)
  const organisationId = request.yar.get(
    ACCREDITATION_SESSION_KEYS.organisationId
  )
  const guardRedirect = await guardOverseasSiteWizardEntry({
    h,
    organisationId,
    applicationId,
    fallbackUrl: `/accreditation/select-overseas-sites/${applicationId}`
  })
  return { t, organisationId, guardRedirect }
}
