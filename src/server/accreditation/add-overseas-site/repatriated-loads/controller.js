import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import {
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../../../common/constants/siteFieldLimits.js'

const STEEL_ALU_MATERIALS = new Set(['Steel', 'Aluminium'])

export function requiresConditionsOfExport(materialType) {
  return STEEL_ALU_MATERIALS.has(materialType)
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function baselCodeUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
}

function conditionsOfExportUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/conditions-of-export`
}

function cyaUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/check-your-answers`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/repatriated-loads/index',
    viewData
  )
}

// RA-361: hands the field to GOV.UK Frontend's own govukCharacterCount
// macro (the same one business-plan-detail and withdraw-application's
// reason field already use), so the keys here are macro parameter names.
// maxwords, not maxlength — countWords below already splits on whitespace,
// which is immune to the CRLF-doubling a browser applies to a textarea's
// line breaks on submit (the bug fixed on business-plan-detail), so this
// field never had a false-positive validation bug. What it lacked was the
// same live, self-clearing feedback: no data-module was wired up, so the
// "You can enter up to 500 words" line was static text with no JS behind
// it, and going over the limit only ever showed up after a full submit.
// The macro's JS progressively enhances this into a live "words
// remaining"/"words too many" counter that updates on every keystroke,
// before any submit, on top of (never instead of) the countWords check in
// the POST handler below.
//
// The live counter updating is NOT the same as the error going away,
// though — govuk-frontend's CharacterCount deliberately never removes a
// server-rendered .govuk-error-message it finds on the page (it reads it
// once, in its constructor, purely to decide whether to also toggle error
// styling on the textarea itself, and never touches it again). So without
// more, reducing back under 500 words leaves the "too many words" paragraph
// on screen right next to a counter that already says otherwise — the same
// bug found and fixed on business-plan-detail. `data-error-type="length"`
// on that paragraph, only for the tooManyWords case and never for the
// unrelated "required" error below (which shares this slot but isn't fixed
// by reducing word count), is what lets application.js's
// initCharacterCountLiveErrorClearing find and clear it once the operator
// is back within the limit.
function buildTextareaInput(t, repatriatedLoads, error, tooManyWords) {
  return {
    id: 'repatriated-loads',
    name: 'repatriatedLoads',
    maxwords: 500,
    rows: 8,
    value: repatriatedLoads,
    label: { text: t('pages.addOverseasSite.repatriatedLoads.label') },
    hint: { text: t('pages.addOverseasSite.repatriatedLoads.hint') },
    errorMessage: error
      ? {
          text: error,
          attributes: {
            'data-testid': 'repatriated-loads-error',
            ...(tooManyWords ? { 'data-error-type': 'length' } : {})
          }
        }
      : undefined,
    attributes: { 'data-testid': 'repatriated-loads-textarea' }
  }
}

function buildViewData(
  t,
  applicationId,
  repatriatedLoads,
  error,
  tooManyWords = false
) {
  return {
    pageTitle: t('pages.addOverseasSite.repatriatedLoads.title'),
    heading: t('pages.addOverseasSite.repatriatedLoads.heading'),
    continueButton: t('pages.addOverseasSite.repatriatedLoads.continueButton'),
    cancelLink: t('pages.addOverseasSite.repatriatedLoads.cancelLink'),
    backLink: baselCodeUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    textareaInput: buildTextareaInput(t, repatriatedLoads, error, tooManyWords),
    error
  }
}

export const addOrsRepatriatedLoadsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const session = getAddOrsSession(request)
    return renderPage(
      h,
      buildViewData(t, applicationId, session.repatriatedLoads ?? '', null)
    )
  }
}

export const addOrsRepatriatedLoadsPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const repatriatedLoads = (request.payload?.repatriatedLoads ?? '').trim()

    if (!repatriatedLoads) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          '',
          t('pages.addOverseasSite.repatriatedLoads.validation.required')
        )
      ).code(400)
    }

    const wordCount = countWords(repatriatedLoads)
    if (wordCount > 500) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          repatriatedLoads,
          t('pages.addOverseasSite.repatriatedLoads.validation.tooManyWords'),
          true
        )
      ).code(400)
    }

    // RA-620: 500 words can still run past the backend's 5000-character cap
    // (long words, or a pasted list with heavy punctuation), so both apply.
    // Counted as submitted, line breaks as the browser's CRLF, because that is
    // the string the backend receives and measures. Not flagged
    // tooManyWords: the browser clears a "length" error once the text is back
    // under 500 words, which says nothing about this limit.
    if (
      exceedsMaxLength(
        repatriatedLoads,
        SITE_FIELD_MAX_LENGTHS.repatriatedLoads
      )
    ) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          repatriatedLoads,
          t(
            'pages.addOverseasSite.repatriatedLoads.validation.tooManyCharacters'
          )
        )
      ).code(400)
    }

    setAddOrsSession(request, { repatriatedLoads })

    const materialType = request.yar.get(
      ACCREDITATION_SESSION_KEYS.materialType
    )
    const nextUrl = STEEL_ALU_MATERIALS.has(materialType)
      ? conditionsOfExportUrl(applicationId)
      : cyaUrl(applicationId)

    return h.redirect(nextUrl)
  }
}
