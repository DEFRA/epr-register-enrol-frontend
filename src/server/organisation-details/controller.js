/**
 * Organisation details controller.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const OrgDetailsViewModel = {
  companyName: 'Bananaman Export Company',
  companiesHouseNumber: '087654321', //company number
  regid: 'BN2712300000001',
  registeredAddress: '29 Acacia Road',
  approvedPerson: 'General Blight',
  directors: [
    { name: 'Eric Twinge' },
    { name: 'Crow' },
    { name: 'Doctor Gloom' }
  ]
}
export const organisationDetailsController = {
  handler(request, h) {
    const { organisationId } = request.params
    const { t } = getLocaleAndTranslator(request)

    const org = OrgDetailsViewModel
    org.companiesHouseNumber = organisationId

    return h.view('organisation-details/index', {
      pageTitle: t('pages.organisationDetails.title'),
      heading: t('pages.organisationDetails.heading'),
      orgDetailsViewModel: org
    })
  }
}
