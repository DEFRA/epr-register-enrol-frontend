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
// Error paths: Approved current-year accreditations whose registration is
// Created, or has no registration record at all.
export const MANAGE_STUB_CREATED_REGISTRATION_ID = 'ccc000000000000000050018'
export const MANAGE_STUB_MISSING_REGISTRATION_ID = 'ddd000000000000000050018'

const CURRENT_YEAR = new Date().getUTCFullYear()
const YEAR_SUFFIX = String(CURRENT_YEAR).slice(-2)

// Real formats. Registration and accreditation numbers: R or A, 2-digit year,
// agency letter, R (reprocessor) or X (exporter), 6-digit org id, 4-digit
// sequence, material code. Both follow the clock, as the backend's dev seeds
// and fake registry (FakeOrganisationPersistence) do. Application references (management-be's ApplicationReferenceGenerator): AP, 2-digit year,
// agency code, 6-digit org id, last 3 characters of the postcode, first 2
// letters of the material.
const EXPORTER_REGISTRATION_NUMBER = `R${YEAR_SUFFIX}EX0500180001PL`
const REPROCESSOR_REGISTRATION_NUMBER = `R${YEAR_SUFFIX}ER0500180002GR`

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

// The exporter's ORSs: three accredited and one registered only. Its interim
// sites include a withdrawn one, and ORSs 001 and 002 both use the same
// physical site, so the overseas-sites page's per-ORS filtering shows up
// locally. Each copy has its own id and number, as the backend allocates them.
// Matches the backend's DevExporterAccreditationSeedService.
function interimSite(siteId, siteNumber, siteName, country, overrides = {}) {
  return {
    siteId,
    siteNumber,
    siteName,
    country,
    addressLine1: '1 Quay Street',
    townOrCity: 'Port',
    contactName: 'Alex Morgan',
    contactEmail: 'alex.morgan@example.com',
    contactPhone: '0123456789',
    operationCodes: ['R3', 'R13'],
    removedAt: null,
    ...overrides
  }
}

function antwerpInterimSite(siteId, siteNumber) {
  return interimSite(siteId, siteNumber, 'Antwerp Transfer Hub', 'Belgium')
}

function overseasSite(siteId, orsId, siteName, addressLine1, country, extra) {
  return {
    siteId,
    orsId,
    siteName,
    addressLine1,
    country,
    siteAddress: `${addressLine1}, ${country}`,
    isNewSite: false,
    registeredNowAccredited: false,
    selected: true,
    interimSites: [],
    ...extra
  }
}

const EXPORTER_ORS = [
  overseasSite(
    901801,
    '001',
    'Rotterdam Recycling BV',
    'Industrieweg 44',
    'Netherlands',
    {
      interimSites: [
        interimSite(901802, '001', 'Calais Storage SARL', 'France', {
          operationCodes: ['R13']
        }),
        antwerpInterimSite(901803, '002'),
        interimSite(901804, '003', 'Old Depot GmbH', 'Germany', {
          removedAt: `${CURRENT_YEAR}-02-01T09:00:00Z`
        })
      ]
    }
  ),
  overseasSite(901805, '002', 'Bharat Recycling', '12 Ring Road', 'India', {
    interimSites: [antwerpInterimSite(901808, '004')]
  }),
  overseasSite(901806, '003', 'Berlin Steel GmbH', 'Hafenstrasse 9', 'Germany'),
  overseasSite(
    901807,
    '004',
    'Dragon Recyclers',
    '8 Harbour Avenue',
    'Vietnam',
    { selected: false }
  )
]

export const MANAGE_STUB_ORG_DOC = {
  orgId: MANAGE_STUB_ORG_ID,
  companyDetails: { name: 'Manage Accreditation Test Ltd' },
  accreditations: [
    approvedApplication({
      id: 'app018exp',
      applicationReference: `AP${YEAR_SUFFIX}EA0500183ABPL`,
      accreditationReference: `A${YEAR_SUFFIX}EX0500180001PL`,
      material: 'plastic',
      wasteProcessingType: 'exporter',
      registrationId: MANAGE_STUB_EXPORTER_REGISTRATION_ID,
      wasteRegistrationNumber: EXPORTER_REGISTRATION_NUMBER,
      companyRegisteredAddress: {
        line1: '18 Harbour Road',
        town: 'Felixstowe',
        postcode: 'IP11 3AB'
      },
      companyRegisterAddressPostcode: 'IP11 3AB',
      overseasSites: { sectionStatus: 'Completed', sites: EXPORTER_ORS },
      besEvidence: { sectionStatus: 'Completed' }
    }),
    approvedApplication({
      id: 'app018rep',
      applicationReference: `AP${YEAR_SUFFIX}EA0500185HTGL`,
      accreditationReference: `A${YEAR_SUFFIX}ER0500180002GR`,
      material: 'glass',
      glassRecyclingProcess: ['glass_re_melt'],
      wasteProcessingType: 'reprocessor',
      registrationId: MANAGE_STUB_REPROCESSOR_REGISTRATION_ID,
      wasteRegistrationNumber: REPROCESSOR_REGISTRATION_NUMBER,
      siteAddress: {
        line1: 'Unit 18, Furnace Lane',
        town: 'Doncaster',
        postcode: 'DN4 5HT'
      }
    }),
    ...[
      ['app018created', MANAGE_STUB_CREATED_REGISTRATION_ID, '0003', 'DN4 6HT'],
      ['app018missing', MANAGE_STUB_MISSING_REGISTRATION_ID, '0004', 'DN4 7HT']
    ].map(([id, registrationId, sequence, postcode]) =>
      approvedApplication({
        id,
        applicationReference: `AP${YEAR_SUFFIX}EA050018${postcode.slice(-3)}WO`,
        accreditationReference: `A${YEAR_SUFFIX}ER050018${sequence}WO`,
        material: 'wood',
        wasteProcessingType: 'reprocessor',
        registrationId,
        siteAddress: {
          line1: 'Unit 18, Furnace Lane',
          town: 'Doncaster',
          postcode
        }
      })
    )
  ]
}

/**
 * RA-425: what the backend's registration-status endpoint returns for the stub
 * registrations. A registration missing from here has no record (404).
 */
export const MANAGE_STUB_REGISTRATION_STATUSES = {
  [MANAGE_STUB_EXPORTER_REGISTRATION_ID]: {
    registrationNumber: EXPORTER_REGISTRATION_NUMBER,
    status: 'Approved'
  },
  [MANAGE_STUB_REPROCESSOR_REGISTRATION_ID]: {
    registrationNumber: REPROCESSOR_REGISTRATION_NUMBER,
    status: 'Approved'
  },
  [MANAGE_STUB_CREATED_REGISTRATION_ID]: {
    registrationNumber: null,
    status: 'Created'
  }
}
