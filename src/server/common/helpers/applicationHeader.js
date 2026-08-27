import { materialDisplayName } from './materialDisplayName.js'

/**
 * Builds the view model for the persistent application-header component
 * shown on every page of the accreditation application journey.
 * @param {object} application - must have organisationName, isExporter,
 *   siteAddress, companyRegisteredAddress, year plus whatever
 *   materialDisplayName needs
 * @param {Function} t - translator function from getLocaleAndTranslator
 * @returns {{operatorName: string, materialType: string, siteName: string, year: number, captionText: string, showFullHeader: boolean}}
 */
export function buildApplicationHeaderViewModel(application, t) {
  const operatorName = application.organisationName
  const materialType = materialDisplayName(application, t)
  // Raw, pre-fallback site value: composeApplicationCaption must omit the
  // site entirely when it's genuinely unset, not include the translated
  // "Not set" placeholder text (RA102-mgwh).
  const rawSiteName = application.isExporter
    ? application.companyRegisteredAddress
    : application.siteAddress
  const siteName = rawSiteName ?? t('pages.taskList.siteNotSet')
  const year = application.year

  return {
    operatorName,
    materialType,
    siteName,
    year,
    captionText: composeApplicationCaption({
      operatorName,
      year,
      materialType,
      siteName: rawSiteName
    }),
    showFullHeader: false
  }
}

/**
 * Composes the "operatorName (year, material, siteName)" caption shown
 * above the page heading on journey pages (RA-506). Every present part is
 * comma-joined; siteName is omitted entirely when null, undefined, or
 * empty.
 * @param {{operatorName: string, year: number, materialType: string, siteName?: string}} params
 * @returns {string}
 */
export function composeApplicationCaption({
  operatorName,
  year,
  materialType,
  siteName
}) {
  const parts = [year, materialType, siteName].filter(
    (part) => part !== null && part !== undefined && part !== ''
  )

  return `${operatorName} (${parts.join(', ')})`
}
