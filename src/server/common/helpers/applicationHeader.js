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
  const siteName = application.isExporter
    ? (application.companyRegisteredAddress ?? t('pages.taskList.siteNotSet'))
    : (application.siteAddress ?? t('pages.taskList.siteNotSet'))
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
      siteName
    }),
    showFullHeader: false
  }
}

/**
 * Composes the "operatorName (year, material and siteName)" caption shown
 * above the page heading on journey pages (RA-506). siteName is omitted,
 * along with its leading "and", when null, undefined, or empty.
 * @param {{operatorName: string, year: number, materialType: string, siteName?: string}} params
 * @returns {string}
 */
export function composeApplicationCaption({
  operatorName,
  year,
  materialType,
  siteName
}) {
  const detailParts = [year, materialType].filter(
    (part) => part !== null && part !== undefined && part !== ''
  )

  if (siteName !== null && siteName !== undefined && siteName !== '') {
    return `${operatorName} (${detailParts.join(', ')} and ${siteName})`
  }

  return `${operatorName} (${detailParts.join(', ')})`
}
