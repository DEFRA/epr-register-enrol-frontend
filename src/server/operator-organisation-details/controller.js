import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const OperatorOrgDetailsViewModel = {
  companyName: 'Operator Export Company',
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
export const operatororganisationDetailsController = {
  handler(request, h) {
    const { companiesHouseNo } = request.params
    const { t } = getLocaleAndTranslator(request)

    const org = {
      ...OperatorOrgDetailsViewModel,
      companiesHouseNumber: companiesHouseNo
    }

    return h.view('operator-organisation-details/index', {
      pageTitle: t('pages.operatorOrganisationDetails.title'),
      heading: t('pages.operatorOrganisationDetails.heading'),
      operatorOrgDetailsViewModel: org
    })
  }
}
