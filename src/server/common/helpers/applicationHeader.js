import { materialDisplayName } from './materialDisplayName.js'

/**
 * Builds the view model for the persistent application-header component
 * shown on every page of the accreditation application journey.
 * @param {object} application - must have organisationName, isExporter,
 *   siteAddress plus whatever materialDisplayName needs
 * @param {Function} t - translator function from getLocaleAndTranslator
 * @returns {{operatorName: string, materialType: string, siteName: string}}
 */
export function buildApplicationHeaderViewModel(application, t) {
  return {
    operatorName: application.organisationName,
    materialType: materialDisplayName(application, t),
    siteName: application.isExporter
      ? t('pages.operatorAccreditation.exporterLabel')
      : (application.siteAddress ?? t('pages.taskList.siteNotSet'))
  }
}
