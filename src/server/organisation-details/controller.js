import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const OrgDetailsViewModel = {
  companyName: 'Bananaman Export Company',
  companiesHouseNumber: '11044891', //company number
  schemeRegistrationId: 'BN2712300000001',
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
    const { companiesHouseNo } = request.params
    const { t } = getLocaleAndTranslator(request)

    const org = {
      ...OrgDetailsViewModel,
      companiesHouseNumber: companiesHouseNo
    }

    return h.view('organisation-details/index', {
      pageTitle: t('pages.organisationDetails.title'),
      heading: t('pages.organisationDetails.heading'),
      orgDetailsViewModel: org
    })
  }
}
