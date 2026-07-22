import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  resolveNationFromPostcode,
  NATIONS
} from '../../common/helpers/nation-from-postcode.js'

const BANK_DETAILS_BY_NATION = {
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

function resolveNation(application) {
  if (application.nation) return application.nation
  return resolveNationFromPostcode(application.sitePostcode)
}

const ORS_FEE = 346

const TONNAGE_FEES = {
  UpTo500: 546,
  UpTo1000: 2184,
  UpTo10000: 3276,
  Over10000: 3965
}

function confirmationUrl(applicationId) {
  return `/accreditation/submit-confirmation/${applicationId}`
}

function siteNameFromAddress(siteAddress) {
  if (!siteAddress) return ''
  return siteAddress.split(',')[0].trim()
}

const GLASS_RECYCLING_PROCESS_KEYS = {
  glass_re_melt: 'pages.materialSelection.glassRemelt',
  glass_other: 'pages.materialSelection.glassOther'
}

function materialDisplayName(application, t) {
  const { materialType, glassRecyclingProcess } = application
  if (!materialType) return ''

  const glassKey = GLASS_RECYCLING_PROCESS_KEYS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassKey) return t(glassKey)

  return t(`pages.materialSelection.materials.${materialType}`)
}

function tonnageFeeCalculator(tonnage) {
  const fee = TONNAGE_FEES[tonnage]
  if (fee === undefined) {
    throw new Error(`Tonnage not set: ${tonnage}`)
  }
  return fee
}

function buildPaymentDetails(application, t, nation) {
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

export const viewPaymentDetailsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params

    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId} for payment details: ${err.message}`
      )
      return h
        .view('accreditation/view-payment-details/index', {
          pageTitle: t('pages.viewPaymentDetails.title'),
          backLink: confirmationUrl(applicationId),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const nation = resolveNation(application)

    let paymentDetails
    try {
      paymentDetails = buildPaymentDetails(application, t, nation)
    } catch (err) {
      request.server.logger.error(
        `Error calculating payment details for ${applicationId}: ${err.message}`
      )
      return h
        .view('accreditation/view-payment-details/index', {
          pageTitle: t('pages.viewPaymentDetails.title'),
          backLink: confirmationUrl(applicationId),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const materialDisplay = materialDisplayName(application, t)

    const submittedBy = application.submittedBy ?? {}
    const regulatorName =
      paymentDetails.companyName ?? paymentDetails.accountName

    return h.view('accreditation/view-payment-details/index', {
      pageTitle: t('pages.viewPaymentDetails.title'),
      backLink: confirmationUrl(applicationId),
      siteName: siteNameFromAddress(application.siteAddress),
      materialDisplay,
      submitterName: submittedBy.name ?? '',
      submitterEmail: submittedBy.email ?? '',
      paymentReference: application.accreditationReference ?? '',
      regulatorName,
      paymentDetails
    })
  }
}
