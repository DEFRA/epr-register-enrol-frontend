import { REGISTRATION_ONLY_REGISTRATION_ID } from './constants/test-orgs.js'

// RA-697: org 50021's registered ORSs, which have no accreditation: the
// backend dev seed's domain-model ORS records
// (DevExporterAccreditationSeedService.RegisteredOverseasSites) as its
// registration change requests view maps them, with the ORS id's integer
// value as the site id. Keep the two in step.
function registeredOrs(orsId, siteName, addressLine1, town, country, extra) {
  return {
    siteId: Number(orsId),
    orsId,
    siteName,
    siteAddress: `${addressLine1}, ${town}, ${country}`,
    addressLine1,
    addressLine2: null,
    townOrCity: town,
    country,
    contactName: 'Site Manager',
    contactEmail: `ors${orsId}@registrationonlyexports.example.com`,
    contactPhone: '+44 1234 567021',
    operationCodes: ['R3'],
    code1: 'B3011',
    code2: null,
    code3: null,
    repatriatedLoads: 'Rejected loads are returned to the UK exporter.',
    conditionsOfExport: true,
    selected: false,
    isNewSite: false,
    registeredNowAccredited: false,
    interimSites: [],
    ...extra
  }
}

function registeredInterimSite(
  siteNumber,
  siteName,
  addressLine1,
  town,
  country
) {
  return {
    siteId: Number(siteNumber),
    siteNumber,
    siteName,
    addressLine1,
    addressLine2: null,
    townOrCity: town,
    stateOrRegion: null,
    postcode: null,
    country,
    contactName: 'Alex Morgan',
    contactEmail: 'alex.morgan@example.com',
    contactPhone: '0123456789',
    operationCodes: ['R13'],
    isNewSite: false,
    createdAt: null,
    removedAt: null
  }
}

function withInterimMirror(site) {
  return { ...site, interimSite: site.interimSites[0] ?? null }
}

function registrationOnlyOrs() {
  return [
    registeredOrs(
      '001',
      'Porto Plasticos Lda',
      'Rua do Porto 21',
      'Porto',
      'Portugal',
      {
        coordinates: '41.1579, -8.6291',
        isEu: true,
        isOecd: true,
        interimSites: [
          registeredInterimSite(
            '001',
            'Leixoes Port Storage',
            'Doca 4',
            'Matosinhos',
            'Portugal'
          ),
          registeredInterimSite(
            '002',
            'Aveiro Transfer Hub',
            'Cais 9',
            'Aveiro',
            'Portugal'
          )
        ]
      }
    ),
    registeredOrs(
      '002',
      'Milano Riciclo SpA',
      'Via Industriale 7',
      'Milan',
      'Italy',
      {
        coordinates: '45.4642, 9.1900',
        isEu: true,
        isOecd: true,
        interimSites: [
          registeredInterimSite(
            '003',
            'Genoa Dock Store',
            'Molo 2',
            'Genoa',
            'Italy'
          )
        ]
      }
    ),
    registeredOrs(
      '003',
      'Penang Polymers Sdn Bhd',
      'Jalan Pelabuhan 3',
      'George Town',
      'Malaysia',
      { coordinates: '5.4141, 100.3288', isEu: false, isOecd: false }
    ),
    registeredOrs(
      '004',
      'Jakarta Daur Ulang PT',
      'Jalan Pelabuhan 12',
      'Jakarta',
      'Indonesia',
      { coordinates: '-6.2088, 106.8456', isEu: false, isOecd: false }
    )
  ].map(withInterimMirror)
}

// RA-697: an accredited registration's ORSs come from its accreditation.
export function registeredOverseasSites(registrationId) {
  return registrationId === REGISTRATION_ONLY_REGISTRATION_ID
    ? registrationOnlyOrs()
    : []
}
