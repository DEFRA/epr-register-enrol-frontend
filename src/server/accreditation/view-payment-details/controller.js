import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

const BANK_DETAILS = {
  sortCode: '30 94 30',
  accountNumber: '00733445',
  accountName: 'Environment Agency'
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

function buildPaymentDetails(application, t) {
  const tonnage = application.prns?.plannedTonnageBand
  const numberOfORSs = application.overseasSites?.sites?.length ?? 0
  const amountTonnageDue = tonnageFeeCalculator(tonnage)
  const amountOrsDue = numberOfORSs * ORS_FEE

  return {
    ...BANK_DETAILS,
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

    let paymentDetails
    try {
      paymentDetails = buildPaymentDetails(application, t)
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

    return h.view('accreditation/view-payment-details/index', {
      pageTitle: t('pages.viewPaymentDetails.title'),
      backLink: confirmationUrl(applicationId),
      siteName: siteNameFromAddress(application.siteAddress),
      materialDisplay,
      submitterName: submittedBy.name ?? '',
      submitterEmail: submittedBy.email ?? '',
      paymentReference: application.accreditationReference ?? '',
      paymentDetails
    })
  }
}
