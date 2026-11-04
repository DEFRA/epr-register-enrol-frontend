import { currentYear, yearSuffix } from './helpers/currentYear.js'
import {
  MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID,
  MANAGE_EXPORTER_MATERIAL,
  MANAGE_EXPORTER_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_ORG_NAME,
  MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL,
  MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID
} from './constants/test-orgs.js'

/**
 * RA-425: stub organisation for the /manage pages, which only show an Approved
 * accreditation for the current calendar year. Its own organisation, so no
 * other stub journey's data changes, with one exporter and one reprocessor
 * registration. The year is read from the clock whenever the stub is served,
 * so a dev server running across 1 January rolls over.
 */

// Real formats. Registration and accreditation numbers: R or A, 2-digit year,
// agency letter, R (reprocessor) or X (exporter), 6-digit org id, 4-digit
// sequence, material code. Both follow the clock, as the backend's dev seeds
// and fake registry (FakeOrganisationPersistence) do. Application references
// (management-be's ApplicationReferenceGenerator): AP, 2-digit year, agency
// code, 6-digit org id, last 3 characters of the postcode, first 2 letters of
// the material.
function exporterRegistrationNumber(year) {
  return `R${yearSuffix(year)}EX0500180001PL`
}

function reprocessorRegistrationNumber(year) {
  return `R${yearSuffix(year)}ER0500180002GR`
}

function approvedApplication(year, overrides) {
  return {
    applicationStatus: 'Approved',
    yearlyMetrics: { year: String(year) },
    createdAt: `${year - 1}-09-01T09:00:00Z`,
    formSubmissionTime: `${year - 1}-09-15T09:00:00Z`,
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

function exporterOrs(year) {
  return [
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
            removedAt: `${year}-02-01T09:00:00Z`
          })
        ]
      }
    ),
    overseasSite(901805, '002', 'Bharat Recycling', '12 Ring Road', 'India', {
      interimSites: [antwerpInterimSite(901808, '004')]
    }),
    overseasSite(
      901806,
      '003',
      'Berlin Steel GmbH',
      'Hafenstrasse 9',
      'Germany'
    ),
    overseasSite(
      901807,
      '004',
      'Dragon Recyclers',
      '8 Harbour Avenue',
      'Vietnam',
      { selected: false }
    )
  ]
}

function buildOrgDoc(year) {
  const suffix = yearSuffix(year)
  return {
    orgId: MANAGE_EXPORTER_ORG_ID,
    companyDetails: { name: MANAGE_EXPORTER_ORG_NAME },
    accreditations: [
      approvedApplication(year, {
        id: 'app018exp',
        applicationReference: `AP${suffix}EA0500183ABPL`,
        accreditationReference: `A${suffix}EX0500180001PL`,
        material: MANAGE_EXPORTER_MATERIAL,
        wasteProcessingType: 'exporter',
        registrationId: MANAGE_EXPORTER_REGISTRATION_ID,
        wasteRegistrationNumber: exporterRegistrationNumber(year),
        companyRegisteredAddress: {
          line1: '18 Harbour Road',
          town: 'Felixstowe',
          postcode: 'IP11 3AB'
        },
        companyRegisterAddressPostcode: 'IP11 3AB',
        overseasSites: { sectionStatus: 'Completed', sites: exporterOrs(year) },
        besEvidence: { sectionStatus: 'Completed' }
      }),
      approvedApplication(year, {
        id: 'app018rep',
        applicationReference: `AP${suffix}EA0500185HTGL`,
        accreditationReference: `A${suffix}ER0500180002GR`,
        material: MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL,
        glassRecyclingProcess: ['glass_re_melt'],
        wasteProcessingType: 'reprocessor',
        registrationId: MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
        wasteRegistrationNumber: reprocessorRegistrationNumber(year),
        siteAddress: {
          line1: 'Unit 18, Furnace Lane',
          town: 'Doncaster',
          postcode: 'DN4 5HT'
        }
      }),
      ...[
        [
          'app018created',
          MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID,
          '0003',
          'DN4 6HT'
        ],
        [
          'app018missing',
          MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID,
          '0004',
          'DN4 7HT'
        ]
      ].map(([id, registrationId, sequence, postcode]) =>
        approvedApplication(year, {
          id,
          applicationReference: `AP${suffix}EA050018${postcode.slice(-3)}WO`,
          accreditationReference: `A${suffix}ER050018${sequence}WO`,
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
}

// Kept for the rest of the year because the stub API saves writes into the
// doc it serves; rebuilt (dropping those writes) once the year changes.
let cachedOrgDoc = null

export function manageStubOrgDoc() {
  const year = currentYear()
  if (cachedOrgDoc?.year !== year) {
    cachedOrgDoc = { year, doc: buildOrgDoc(year) }
  }
  return cachedOrgDoc.doc
}

/**
 * RA-425: what the backend's registration-status endpoint returns for the stub
 * registrations. A registration missing from here has no record (404).
 */
export function manageStubRegistrationStatuses() {
  const year = currentYear()
  return {
    [MANAGE_EXPORTER_REGISTRATION_ID]: {
      registrationNumber: exporterRegistrationNumber(year),
      status: 'Approved'
    },
    [MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID]: {
      registrationNumber: reprocessorRegistrationNumber(year),
      status: 'Approved'
    },
    [MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID]: {
      registrationNumber: null,
      status: 'Created'
    }
  }
}
