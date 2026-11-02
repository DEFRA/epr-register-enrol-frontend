/**
 * RA-425: stub organisation for the /manage pages, which only show an Approved
 * accreditation for the current calendar year. Its own organisation, so no
 * other stub journey's data changes, with one exporter and one reprocessor
 * registration. The year is worked out when the stub loads.
 */
export const MANAGE_STUB_ORG_ID = 50018
export const MANAGE_STUB_EXPORTER_REGISTRATION_ID = 'aaa000000000000000050018'
export const MANAGE_STUB_REPROCESSOR_REGISTRATION_ID =
  'bbb000000000000000050018'

const CURRENT_YEAR = new Date().getUTCFullYear()
const YEAR_SUFFIX = String(CURRENT_YEAR).slice(-2)

function approvedApplication(overrides) {
  return {
    applicationStatus: 'Approved',
    yearlyMetrics: { year: String(CURRENT_YEAR) },
    createdAt: `${CURRENT_YEAR - 1}-09-01T09:00:00Z`,
    formSubmissionTime: `${CURRENT_YEAR - 1}-09-15T09:00:00Z`,
    submitterContactDetails: {
      fullName: 'Sam Patel',
      email: 'sam.patel@example.com',
      role: 'Director'
    },
    prnIssuance: {
      sectionStatus: 'Completed',
      plannedIssuance: 'UpTo5000',
      signatories: []
    },
    businessPlan: { sectionStatus: 'Completed', items: [] },
    samplingPlan: { sectionStatus: 'Completed', files: [] },
    ...overrides
  }
}

export const MANAGE_STUB_ORG_DOC = {
  orgId: MANAGE_STUB_ORG_ID,
  companyDetails: { name: 'Manage Accreditation Test Ltd' },
  accreditations: [
    approvedApplication({
      id: 'app018exp',
      applicationReference: `APP${YEAR_SUFFIX}EX500180001PL`,
      accreditationReference: `A${YEAR_SUFFIX}EX500180001PL`,
      material: 'plastic',
      wasteProcessingType: 'exporter',
      registrationId: MANAGE_STUB_EXPORTER_REGISTRATION_ID,
      wasteRegistrationNumber: `R${YEAR_SUFFIX}EX500180001PL`,
      companyRegisteredAddress: {
        line1: '18 Harbour Road',
        town: 'Felixstowe',
        postcode: 'IP11 3AB'
      },
      companyRegisterAddressPostcode: 'IP11 3AB',
      overseasSites: { sectionStatus: 'Completed', sites: [] },
      besEvidence: { sectionStatus: 'Completed' }
    }),
    approvedApplication({
      id: 'app018rep',
      applicationReference: `APP${YEAR_SUFFIX}ER500180002GL`,
      accreditationReference: `A${YEAR_SUFFIX}ER500180002GL`,
      material: 'glass',
      glassRecyclingProcess: ['glass_re_melt'],
      wasteProcessingType: 'reprocessor',
      registrationId: MANAGE_STUB_REPROCESSOR_REGISTRATION_ID,
      wasteRegistrationNumber: `R${YEAR_SUFFIX}ER500180002GL`,
      siteAddress: {
        line1: 'Unit 18, Furnace Lane',
        town: 'Doncaster',
        postcode: 'DN4 5HT'
      }
    })
  ]
}
