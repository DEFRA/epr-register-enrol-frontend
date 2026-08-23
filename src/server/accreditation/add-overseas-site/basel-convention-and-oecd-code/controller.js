import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'
import { BASEL_OECD_CODES } from '../../../common/data/baselOecdCodes.js'

const BASEL_OECD_CODES_SET = new Set(
  BASEL_OECD_CODES.map((code) => code.toUpperCase())
)
const MAX_CODES = 3
const GUIDANCE_LINK_URL =
  'https://www.gov.uk/government/publications/waste-shipments-regulation-wsr-consolidated-waste-list'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function recyclingOperationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/recycling-operation-details`
}

function repatriatedLoadsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/repatriated-loads`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/basel-convention-and-oecd-code/index',
    viewData
  )
}

function buildViewData(t, applicationId, session, values, errors) {
  const codes = values.map((value, index) => ({
    index,
    value,
    error: errors[index]
  }))

  return {
    pageTitle: t('pages.addOverseasSite.baselAndOecdCodes.title'),
    heading: t('pages.addOverseasSite.baselAndOecdCodes.heading'),
    codeLabel: t('pages.addOverseasSite.baselAndOecdCodes.codeLabel'),
    hint: t('pages.addOverseasSite.baselAndOecdCodes.hint'),
    chooseOption: t('pages.addOverseasSite.baselAndOecdCodes.chooseOption'),
    noMatchesFound: t('pages.addOverseasSite.baselAndOecdCodes.noMatchesFound'),
    errorSummaryTitle: t('common.errorSummaryTitle'),
    guidanceLinkUrl: GUIDANCE_LINK_URL,
    guidanceLinkText: t(
      'pages.addOverseasSite.baselAndOecdCodes.guidanceLinkText'
    ),
    addCodeButtonLabel: t(
      'pages.addOverseasSite.baselAndOecdCodes.addCodeButton'
    ),
    removeCodeButtonLabel: t(
      'pages.addOverseasSite.baselAndOecdCodes.removeCodeButton'
    ),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    backLink: recyclingOperationUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    siteName: session.siteName ?? '',
    siteAddress: formatSiteAddress(session),
    baselOecdCodes: BASEL_OECD_CODES,
    codes,
    visibleCount: values.length,
    canAddMore: values.length < MAX_CODES,
    canRemove: values.length > 1,
    errors
  }
}

function fieldsFromPayload(payload, visibleCount) {
  return Array.from({ length: visibleCount }, (_, i) =>
    (payload?.[`code-${i}`] ?? '').trim().toUpperCase()
  )
}

export const addOrsBaselCodeGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const codes = session.baselAndOecdCodes ?? []
    const values = codes.length > 0 ? codes : ['']
    return renderPage(h, buildViewData(t, applicationId, session, values, {}))
  }
}

export const addOrsBaselCodePostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const action = request.payload?.action ?? 'continue'
    const rawVisibleCount = Number.parseInt(request.payload?.visibleCount, 10)
    const visibleCount = Math.min(
      Math.max(Number.isNaN(rawVisibleCount) ? 1 : rawVisibleCount, 1),
      MAX_CODES
    )
    const values = fieldsFromPayload(request.payload, visibleCount)

    if (action === 'addCode') {
      const newValues = [...values]
      if (newValues.length < MAX_CODES) {
        newValues.push('')
      }
      return renderPage(
        h,
        buildViewData(t, applicationId, session, newValues, {})
      )
    }

    if (action.startsWith('removeCode-')) {
      const removeIndex = Number.parseInt(action.replace('removeCode-', ''), 10)
      const newValues = values.filter((_, i) => i !== removeIndex)
      if (newValues.length === 0) {
        newValues.push('')
      }
      return renderPage(
        h,
        buildViewData(t, applicationId, session, newValues, {})
      )
    }

    const errors = {}
    const seenCodes = new Set()
    let anyCodeEntered = false

    values.forEach((value, index) => {
      if (!value) {
        return
      }

      anyCodeEntered = true

      if (!BASEL_OECD_CODES_SET.has(value.toUpperCase())) {
        errors[index] = t(
          'pages.addOverseasSite.baselAndOecdCodes.validation.codeInvalid'
        )
        return
      }

      if (seenCodes.has(value.toUpperCase())) {
        errors[index] = t(
          'pages.addOverseasSite.baselAndOecdCodes.validation.duplicateCode'
        )
        return
      }

      seenCodes.add(value.toUpperCase())
    })

    if (!anyCodeEntered) {
      errors[0] = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.atLeastOneCodeRequired'
      )
    }

    if (Object.keys(errors).length > 0) {
      return renderPage(
        h,
        buildViewData(t, applicationId, session, values, errors)
      ).code(400)
    }

    const baselAndOecdCodes = values.filter(Boolean)
    setAddOrsSession(request, { baselAndOecdCodes })
    return h.redirect(repatriatedLoadsUrl(applicationId))
  }
}
