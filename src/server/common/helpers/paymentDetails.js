import { resolveNationFromPostcode, NATIONS } from './nation-from-postcode.js'
import { materialDisplayName } from './materialDisplayName.js'

export const BANK_DETAILS_BY_NATION = {
  [NATIONS.ENGLAND]: {
    accountName: 'EA RECEIPTS',
    companyName: 'Environment Agency',
    sortCode: '60-70-80',
    accountNumber: '10014411',
    bank: 'RBS/Natwest, London Corporate Service Centre, CPB Services, 2nd floor, 280 Bishopsgate, London EC2M 4RB'
  },
  [NATIONS.SCOTLAND]: {
    accountName: 'Scottish Environment Protection Agency',
    accountNumber: '00137187',
    sortCode: '83 – 34 – 00',
    bank: 'Royal Bank of Scotland, 30 Nicholson Street, Edinburgh, EH8 9DL'
  },
  [NATIONS.WALES]: {
    companyName: 'Natural Resources Wales',
    sortCode: '60-70-80',
    accountNumber: '10014438',
    bank: 'RBS, National Westminster bank plc, 2 ½ Devonshire Square, London, EC2M 4BA',
    companyAddress: 'Income department, PO BOX 663, Cardiff, CF24 0TP'
  },
  [NATIONS.NORTHERN_IRELAND]: {
    accountName: 'DAERA',
    sortCode: '95-01-21',
    accountNumber: '61253506',
    bank: 'Danske bank, PO BOX 183 Donegall Square West, Belfast, BT1 6JS'
  }
}

export const REGULATOR_CONTACT_BY_NATION = {
  [NATIONS.ENGLAND]: {
    name: 'Environment Agency',
    email: 'packagingnotifications@environment-agency.gov.uk'
  },
  [NATIONS.SCOTLAND]: {
    name: 'Scottish Environment Protection Agency',
    email: 'producer.responsibility@sepa.org.uk'
  },
  [NATIONS.WALES]: {
    name: 'Natural Resources Wales',
    email: 'packaging@naturalresourceswales.gov.uk'
  },
  [NATIONS.NORTHERN_IRELAND]: {
    name: 'Northern Ireland Environment Agency',
    email: 'repandexp@daera-ni.gov.uk'
  }
}

export function resolveRegulatorContact(nation) {
  return (
    REGULATOR_CONTACT_BY_NATION[nation] ??
    REGULATOR_CONTACT_BY_NATION[NATIONS.ENGLAND]
  )
}

export const ORS_FEE = 328

export const TONNAGE_FEES = {
  UpTo500: 546,
  UpTo5000: 2184,
  UpTo10000: 3276,
  Over10000: 3965
}

export function resolveNation(application) {
  if (application.nation) {
    return application.nation
  }
  return resolveNationFromPostcode(application.sitePostcode)
}

export function buildPaymentReference(nation, organisationId, isExporter) {
  switch (nation) {
    case NATIONS.NORTHERN_IRELAND:
      return `NI/PR/REEX/${organisationId}`
    case NATIONS.WALES:
      return `PREX/${organisationId}`
    case NATIONS.SCOTLAND:
      return `E800 81581/${organisationId}`
    case NATIONS.ENGLAND:
    default:
      return isExporter
        ? `PR/PK/EXP/${organisationId}`
        : `PR/PK/REP/${organisationId}`
  }
}

export function siteNameFromAddress(siteAddress) {
  if (!siteAddress) {
    return ''
  }
  return siteAddress.split(',')[0].trim()
}

export function tonnageFeeCalculator(tonnage) {
  const fee = TONNAGE_FEES[tonnage]
  if (fee === undefined) {
    throw new Error(`Tonnage not set: ${tonnage}`)
  }
  return fee
}

export function buildPaymentDetails(application, t, nation) {
  const tonnage = application.prns?.plannedTonnageBand
  const selectedSites = (application.overseasSites?.sites ?? []).filter(
    (s) => s.selected !== false
  )
  const numberOfORSs = selectedSites?.length ?? 0
  const amountTonnageDue = tonnageFeeCalculator(tonnage)
  const amountOrsDue = numberOfORSs * ORS_FEE
  const bankDetails =
    BANK_DETAILS_BY_NATION[nation] ?? BANK_DETAILS_BY_NATION[NATIONS.ENGLAND]

  return {
    ...bankDetails,
    materialName: materialDisplayName(application, t),
    tonnageDisplay: t(`pages.tonnage.options.${tonnage}`),
    numberOfORSs,
    amountTonnageDue,
    amountOrsDue,
    amount: amountTonnageDue + amountOrsDue
  }
}
