import { currentYear, yearSuffix } from './helpers/currentYear.js'
import {
  IN_YEAR_CHANGE_ORG,
  MANAGE_EXPORTER_ORG,
  MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_REPROCESSOR,
  NO_CHANGE_REQUESTS_ORG,
  NO_OVERSEAS_SITES_ORG,
  REGISTRATION_ONLY_ORG,
  createdRegistrationNumber,
  exporterRegistrationNumber,
  reprocessorRegistrationNumber,
  seededApplicationId
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

const SITE_IDS = {
  ROTTERDAM: 901801,
  CALAIS: 901802,
  ANTWERP_FOR_ROTTERDAM: 901803,
  OLD_DEPOT: 901804,
  BHARAT: 901805,
  BERLIN: 901806,
  DRAGON: 901807,
  ANTWERP_FOR_BHARAT: 901808,
  SAIGON: 901809
}

const NO_CHANGE_REQUESTS_SITE_IDS = {
  GDANSK: 902001,
  GHENT: 902002
}

const IN_YEAR_CHANGE_SITE_IDS = {
  HAMBURG: 901901,
  LYON: 901910,
  ROTTERDAM: 901914,
  ANTWERP_FOR_ROTTERDAM: 901915,
  DELHI: 901911,
  IZMIR: 901912
}

function exporterOrs(year) {
  return [
    overseasSite(
      SITE_IDS.ROTTERDAM,
      '001',
      'Rotterdam Recycling BV',
      'Industrieweg 44',
      'Netherlands',
      {
        interimSites: [
          interimSite(SITE_IDS.CALAIS, '001', 'Calais Storage SARL', 'France', {
            operationCodes: ['R13']
          }),
          antwerpInterimSite(SITE_IDS.ANTWERP_FOR_ROTTERDAM, '002'),
          interimSite(SITE_IDS.OLD_DEPOT, '003', 'Old Depot GmbH', 'Germany', {
            removedAt: `${year}-02-01T09:00:00Z`
          })
        ]
      }
    ),
    overseasSite(
      SITE_IDS.BHARAT,
      '002',
      'Bharat Recycling',
      '12 Ring Road',
      'India',
      {
        interimSites: [antwerpInterimSite(SITE_IDS.ANTWERP_FOR_BHARAT, '004')]
      }
    ),
    overseasSite(
      SITE_IDS.BERLIN,
      '003',
      'Berlin Steel GmbH',
      'Hafenstrasse 9',
      'Germany'
    ),
    overseasSite(
      SITE_IDS.DRAGON,
      '004',
      'Dragon Recyclers',
      '8 Harbour Avenue',
      'Vietnam',
      // Registered only: the overseas-sites page must not show this.
      {
        selected: false,
        interimSites: [
          interimSite(SITE_IDS.SAIGON, '005', 'Saigon Port Storage', 'Vietnam')
        ]
      }
    )
  ]
}

// Application references end with the last 3 characters of the postcode.
const POSTCODE_SUFFIX_LENGTH = 3

function buildOrgDoc(year) {
  const suffix = yearSuffix(year)
  return {
    orgId: MANAGE_EXPORTER_ORG.orgId,
    companyDetails: { name: MANAGE_EXPORTER_ORG.orgName },
    accreditations: [
      approvedApplication(year, {
        // The backend's ids, which the change-request stub keys its seeded
        // requests on (stub-change-request-seed.js).
        id: seededApplicationId('a', year, MANAGE_EXPORTER_ORG.orgId),
        applicationReference: `AP${suffix}EA0500183ABPL`,
        accreditationReference: `A${suffix}EX0500180001PL`,
        material: MANAGE_EXPORTER_ORG.material,
        wasteProcessingType: 'exporter',
        registrationId: MANAGE_EXPORTER_ORG.registrationId,
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
        id: seededApplicationId('b', year, MANAGE_EXPORTER_ORG.orgId),
        applicationReference: `AP${suffix}EA0500185HTGL`,
        accreditationReference: `A${suffix}ER0500180002GR`,
        material: MANAGE_EXPORTER_ORG_REPROCESSOR.material,
        glassRecyclingProcess: ['glass_re_melt'],
        wasteProcessingType: 'reprocessor',
        registrationId: MANAGE_EXPORTER_ORG_REPROCESSOR.registrationId,
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
          applicationReference: `AP${suffix}EA050018${postcode.slice(-POSTCODE_SUFFIX_LENGTH)}WO`,
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

// RA-492: an ORS on org 50019, registered only unless `selected`, with the
// details the backend's dev seed gives each of them.
function inYearChangeOrs(siteId, orsId, siteName, country, extra) {
  return overseasSite(
    siteId,
    orsId,
    siteName,
    `${siteId} Industrial Estate`,
    country,
    {
      townOrCity: 'Port',
      selected: false,
      isEu: false,
      isOecd: false,
      coordinates: null,
      operationCodes: [],
      conditionsOfExport: null,
      contactName: 'Site Manager',
      contactEmail: `site${siteId}@example.com`,
      contactPhone: '+44 1234 567890',
      code1: 'B3011',
      repatriatedLoads: 'Rejected loads are returned to the UK exporter.',
      ...extra
    }
  )
}

// RA-492: one accredited ORS and four registered-only ones: two complete
// (RA-739: Lyon, then Rotterdam with an interim site), and two each missing a
// different set of the fields the in-year add journey asks for.
function inYearChangeSites(year) {
  return [
    inYearChangeOrs(
      IN_YEAR_CHANGE_SITE_IDS.HAMBURG,
      '001',
      'Hamburg Kunststoff GmbH',
      'Germany',
      {
        selected: true,
        validFrom: `${year}-01-01T00:00:00Z`,
        isEu: true,
        isOecd: true,
        coordinates: '53.5511, 9.9937',
        operationCodes: ['R3'],
        conditionsOfExport: true
      }
    ),
    inYearChangeOrs(
      IN_YEAR_CHANGE_SITE_IDS.LYON,
      '005',
      'Lyon Plastiques SA',
      'France',
      {
        isEu: true,
        isOecd: true,
        coordinates: '45.7640, 4.8357',
        operationCodes: ['R3'],
        conditionsOfExport: true
      }
    ),
    inYearChangeOrs(
      IN_YEAR_CHANGE_SITE_IDS.ROTTERDAM,
      '009',
      'Rotterdam Recycling BV',
      'Netherlands',
      {
        isEu: true,
        isOecd: true,
        coordinates: '51.9244, 4.4777',
        operationCodes: ['R3'],
        conditionsOfExport: true,
        interimSites: [
          antwerpInterimSite(
            IN_YEAR_CHANGE_SITE_IDS.ANTWERP_FOR_ROTTERDAM,
            '001'
          )
        ]
      }
    ),
    inYearChangeOrs(
      IN_YEAR_CHANGE_SITE_IDS.DELHI,
      '006',
      'Delhi Polymers Pvt',
      'India'
    ),
    inYearChangeOrs(
      IN_YEAR_CHANGE_SITE_IDS.IZMIR,
      '007',
      'Izmir Recycling AS',
      'Turkey',
      {
        isOecd: true,
        coordinates: '38.4237, 27.1428'
      }
    )
  ]
}

// RA-492: org 50019's accreditation. Matches the backend's dev seed.
function buildInYearChangeOrgDoc(year) {
  const suffix = yearSuffix(year)
  const id = seededApplicationId('a', year, IN_YEAR_CHANGE_ORG.orgId)
  return {
    orgId: IN_YEAR_CHANGE_ORG.orgId,
    companyDetails: { name: IN_YEAR_CHANGE_ORG.orgName },
    accreditations: [
      approvedApplication(year, {
        id,
        applicationReference: `AP${suffix}EA0500191AAPL`,
        accreditationReference: `A${suffix}EX0500190001PL`,
        material: IN_YEAR_CHANGE_ORG.material,
        wasteProcessingType: 'exporter',
        registrationId: IN_YEAR_CHANGE_ORG.registrationId,
        wasteRegistrationNumber: exporterRegistrationNumber(
          year,
          IN_YEAR_CHANGE_ORG.orgId
        ),
        companyRegisteredAddress: {
          line1: 'Change House',
          town: 'Hull',
          postcode: 'HU1 1AA'
        },
        companyRegisterAddressPostcode: 'HU1 1AA',
        overseasSites: {
          sectionStatus: 'Completed',
          sites: inYearChangeSites(year)
        },
        besEvidence: { sectionStatus: 'Completed' }
      })
    ]
  }
}

// RA-697: org 50020, an exporter with no change requests. Matches the
// backend's dev seed.
function buildNoChangeRequestsOrgDoc(year) {
  const suffix = yearSuffix(year)
  return {
    orgId: NO_CHANGE_REQUESTS_ORG.orgId,
    companyDetails: { name: NO_CHANGE_REQUESTS_ORG.orgName },
    accreditations: [
      approvedApplication(year, {
        id: seededApplicationId('a', year, NO_CHANGE_REQUESTS_ORG.orgId),
        applicationReference: `AP${suffix}EA0500203AAPL`,
        accreditationReference: `A${suffix}EX0500200001PL`,
        material: NO_CHANGE_REQUESTS_ORG.material,
        wasteProcessingType: 'exporter',
        registrationId: NO_CHANGE_REQUESTS_ORG.registrationId,
        wasteRegistrationNumber: exporterRegistrationNumber(
          year,
          NO_CHANGE_REQUESTS_ORG.orgId
        ),
        companyRegisteredAddress: {
          line1: '20 Dock Street',
          town: 'Grimsby',
          postcode: 'DN31 3AA'
        },
        companyRegisterAddressPostcode: 'DN31 3AA',
        overseasSites: {
          sectionStatus: 'Completed',
          sites: [
            overseasSite(
              NO_CHANGE_REQUESTS_SITE_IDS.GDANSK,
              '001',
              'Gdansk Recykling Sp. z o.o.',
              'ul. Portowa 20',
              'Poland',
              { validFrom: `${year}-01-01T00:00:00Z` }
            ),
            overseasSite(
              NO_CHANGE_REQUESTS_SITE_IDS.GHENT,
              '002',
              'Ghent Recycling NV',
              'Havenlaan 5',
              'Belgium',
              { selected: false }
            )
          ]
        },
        besEvidence: { sectionStatus: 'Completed' }
      })
    ]
  }
}

// Kept for the rest of the year because the stub API saves writes into the
// docs it serves; rebuilt (dropping those writes) once the year changes.
let cachedOrgDocs = null

export function manageStubOrgDocs() {
  const year = currentYear()
  if (cachedOrgDocs?.year !== year) {
    cachedOrgDocs = {
      year,
      docs: [
        buildOrgDoc(year),
        buildInYearChangeOrgDoc(year),
        buildNoChangeRequestsOrgDoc(year)
      ]
    }
  }
  return cachedOrgDocs.docs
}

// RA-697: the backend's registration-status fields, as for its
// RegistrationStatusResponse.
function approvedExporterRegistration(organisationName, registrationNumber) {
  return {
    registrationNumber,
    status: 'Approved',
    organisationName,
    materialType: 'Plastic',
    glassRecyclingProcess: null,
    isExporter: true,
    siteAddress: null
  }
}

/**
 * RA-425: what the backend's registration-status endpoint returns for the stub
 * registrations. A registration missing from here has no record (404).
 * RA-697: orgs 50021's and 50022's registrations have no accreditation, so
 * they are registration only; 50022's has no registered ORSs either.
 */
export function manageStubRegistrationStatuses() {
  const year = currentYear()
  return {
    [MANAGE_EXPORTER_ORG.registrationId]: approvedExporterRegistration(
      MANAGE_EXPORTER_ORG.orgName,
      exporterRegistrationNumber(year)
    ),
    [MANAGE_EXPORTER_ORG_REPROCESSOR.registrationId]: {
      registrationNumber: reprocessorRegistrationNumber(year),
      status: 'Approved',
      organisationName: MANAGE_EXPORTER_ORG.orgName,
      materialType: 'Glass',
      glassRecyclingProcess: 'glass_re_melt',
      isExporter: false,
      siteAddress: 'Unit 18, Furnace Lane, Doncaster, DN4 5HT'
    },
    [IN_YEAR_CHANGE_ORG.registrationId]: approvedExporterRegistration(
      IN_YEAR_CHANGE_ORG.orgName,
      exporterRegistrationNumber(year, IN_YEAR_CHANGE_ORG.orgId)
    ),
    [NO_CHANGE_REQUESTS_ORG.registrationId]: approvedExporterRegistration(
      NO_CHANGE_REQUESTS_ORG.orgName,
      exporterRegistrationNumber(year, NO_CHANGE_REQUESTS_ORG.orgId)
    ),
    [REGISTRATION_ONLY_ORG.registrationId]: approvedExporterRegistration(
      REGISTRATION_ONLY_ORG.orgName,
      exporterRegistrationNumber(year, REGISTRATION_ONLY_ORG.orgId)
    ),
    [NO_OVERSEAS_SITES_ORG.registrationId]: approvedExporterRegistration(
      NO_OVERSEAS_SITES_ORG.orgName,
      exporterRegistrationNumber(year, NO_OVERSEAS_SITES_ORG.orgId)
    ),
    // RA-739: numbered, unlike a real Created registration, so its /manage URL
    // reaches the not-Approved error path.
    [MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID]: {
      registrationNumber: createdRegistrationNumber(year),
      status: 'Created',
      organisationName: MANAGE_EXPORTER_ORG.orgName,
      materialType: 'Wood',
      glassRecyclingProcess: null,
      isExporter: false,
      siteAddress: 'Unit 18, Furnace Lane, Doncaster, DN4 6HT'
    }
  }
}
