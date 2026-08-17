import { materialDisplayName } from './materialDisplayName.js'

/**
 * Builds the view model for the persistent application-header component
 * shown on every page of the accreditation application journey.
 * @param {object} application - must have organisationName, isExporter,
 *   siteAddress, companyRegisteredAddress, year plus whatever
 *   materialDisplayName needs
 * @param {Function} t - translator function from getLocaleAndTranslator
 * @returns {{operatorName: string, materialType: string, siteName: string, year: number}}
 */
export function buildApplicationHeaderViewModel(application, t) {
  return {
    operatorName: application.organisationName,
    materialType: materialDisplayName(application, t),
    siteName: application.isExporter
      ? (application.companyRegisteredAddress ?? t('pages.taskList.siteNotSet'))
      : (application.siteAddress ?? t('pages.taskList.siteNotSet')),
    year: application.year
  }
}
