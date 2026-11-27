import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { accreditationChangesService } from '../../../common/helpers/accreditationChangesService.js'
import { MAX_REPATRIATED_WORDS } from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { buildTextareaInput } from '../../add-overseas-site/repatriated-loads/controller.js'
import {
  NOTHING_TO_DO,
  loadView,
  organisationIdFrom,
  redirectToManageSites,
  submittedRequest
} from '../controller.js'
import { manageSitesUrl, requestsUrl, updateUrl } from '../urls.js'
import {
  VIEWS,
  detailsView,
  errorList,
  handler,
  refused,
  refusedStatus,
  saveChange
} from './shared.js'
import { validateStep } from './validation.js'
import { updateText } from './view-model.js'

export {
  interimAdditionGetController,
  interimAdditionPostController,
  interimChangeGetController,
  interimChangePostController,
  interimNewGetController,
  interimNewPostController,
  interimRemoveController,
  interimUndoController
} from './interim-controller.js'

const STEPS = {
  'site-name': {
    titleKey: 'pages.addOverseasSite.siteName.heading',
    fields: [
      { name: 'siteName', labelKey: 'pages.addOverseasSite.siteName.label' }
    ]
  },
  location: {
    titleKey: 'pages.addOverseasSite.siteLocation.heading',
    fields: [
      {
        name: 'addressLine1',
        labelKey: 'pages.addOverseasSite.siteLocation.addressLine1Label'
      },
      {
        name: 'addressLine2',
        labelKey: 'pages.addOverseasSite.siteLocation.addressLine2Label'
      },
      {
        name: 'townOrCity',
        labelKey: 'pages.addOverseasSite.siteLocation.townOrCityLabel',
        width: 'govuk-input--width-20'
      }
    ],
    // AC02: shown as read-only inputs from the ORS's stored values, and never
    // posted, so the update can't change them.
    readOnly: [
      {
        name: 'country',
        labelKey: 'pages.addOverseasSite.siteLocation.countryLabel'
      },
      {
        name: 'coordinates',
        labelKey: 'pages.addOverseasSite.siteLocation.coordinatesLabel',
        hintKey: 'pages.addOverseasSite.siteLocation.coordinatesHint'
      }
    ]
  },
  'contact-details': {
    titleKey: 'pages.addOverseasSite.siteContactDetails.heading',
    fields: [
      {
        name: 'contactName',
        labelKey: 'pages.addOverseasSite.siteContactDetails.nameLabel'
      },
      {
        name: 'contactEmail',
        labelKey: 'pages.addOverseasSite.siteContactDetails.emailLabel',
        type: 'email'
      },
      {
        name: 'contactPhone',
        labelKey: 'pages.addOverseasSite.siteContactDetails.phoneLabel',
        type: 'tel',
        width: 'govuk-input--width-20'
      }
    ]
  },
  'rejected-loads': {
    titleKey: 'pages.addOverseasSite.repatriatedLoads.heading',
    fields: [
      {
        name: 'repatriatedLoads',
        labelKey: 'pages.addOverseasSite.repatriatedLoads.label',
        hintKey: 'pages.addOverseasSite.repatriatedLoads.hint',
        maxwords: MAX_REPATRIATED_WORDS
      }
    ]
  }
}

export const STEP_NAMES = Object.keys(STEPS)

export const UPDATED_KEYS = [...STEP_NAMES, 'interim-sites']
export const detailsGetController = handler({}, (request, h, locale, loaded) =>
  detailsView(h, request, locale, loaded)
)
// --- ORS detail steps ----------------------------------------------------------

// The add journey's rejected-loads textarea, with this form's id and input
// testid.
function characterCount(t, input, tooManyWords) {
  return {
    ...buildTextareaInput(t, input.value, input.error, tooManyWords),
    id: input.name,
    attributes: { 'data-testid': `${input.name}-input` }
  }
}

// A legacy ORS has only its one-line siteAddress. The location step puts all
// of it in address line 1, so nothing in it is dropped when the operator
// splits it across the lines.
function stepValues(update) {
  return {
    ...update.details,
    addressLine1:
      update.details.addressLine1 ||
      update.entry.site.addressLine1 ||
      update.entry.site.siteAddress
  }
}

function stepView(
  h,
  t,
  request,
  { update, values, errors = {}, tooManyWords = false, pageError = null }
) {
  const { applicationId, siteId, step } = request.params
  const config = STEPS[step]
  const site = update.entry.site
  return h.view(VIEWS.step, {
    pageTitle: t(config.titleKey),
    heading: t(config.titleKey),
    backLink: updateUrl(applicationId, siteId),
    cancelUrl: updateUrl(applicationId, siteId),
    inputs: config.fields.map((field) => {
      const input = {
        ...field,
        label: t(field.labelKey),
        hint: field.hintKey ? t(field.hintKey) : null,
        value: values[field.name] ?? '',
        error: errors[field.name] ?? null
      }
      return field.maxwords
        ? { ...input, characterCount: characterCount(t, input, tooManyWords) }
        : input
    }),
    readOnly: (config.readOnly ?? []).map((field) => ({
      ...field,
      label: t(field.labelKey),
      hint: field.hintKey ? t(field.hintKey) : null,
      value: site[field.name] ?? ''
    })),
    errors: errorList(errors, pageError)
  })
}

export const stepGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) =>
    stepView(h, t, request, { update, values: stepValues(update) })
)

export const stepPostController = handler(
  { editable: true },
  async (request, h, { t }, { update }) => {
    const { applicationId, siteId, step } = request.params
    const names = STEPS[step].fields.map((field) => field.name)
    const values = Object.fromEntries(
      names.map((name) => [name, String(request.payload?.[name] ?? '').trim()])
    )
    const { errors, tooManyWords } = validateStep(t, step, values)
    if (Object.keys(errors).length > 0) {
      return stepView(h, t, request, {
        update,
        values,
        errors,
        tooManyWords
      }).code(statusCodes.badRequest)
    }
    const result = await saveChange(request, h, update, (org, app, site) =>
      accreditationChangesService.patchSite(org, app, site, values)
    )
    if (result?.redirect) {
      return result.redirect
    }
    if (result) {
      return stepView(h, t, request, {
        update,
        values,
        ...refused(t, result, names)
      }).code(refusedStatus(result))
    }
    return h.redirect(`${updateUrl(applicationId, siteId)}?updated=${step}`)
  }
)
// --- Taking the update back out of the draft (the requests page's Remove) -------

export const cancelUpdateController = {
  async handler(request, h) {
    const { applicationId, siteId } = request.params
    try {
      await accreditationChangesService.removeSite(
        organisationIdFrom(request),
        applicationId,
        siteId
      )
    } catch (err) {
      if (!NOTHING_TO_DO.has(err.status)) {
        throw err
      }
    }
    return h.redirect(requestsUrl(applicationId))
  }
}

// --- AC06: submitted, with nothing to pay ------------------------------------------

// A submitted request of ORS changes with nothing to pay.
function isFreeChange(changeRequest) {
  return (
    changeRequest.sites?.length > 0 &&
    (changeRequest.charge?.chargeableSites ?? 0) === 0
  )
}

export const submittedGetController = {
  async handler(request, h) {
    const { t, currentLocale } = getLocaleAndTranslator(request)
    const view = await loadView(request)
    const submitted = submittedRequest(
      view,
      request.query?.request,
      isFreeChange
    )
    if (!submitted) {
      return redirectToManageSites(request, h, view)
    }
    return h.view(VIEWS.submitted, {
      pageTitle: updateText(t, 'submitted.title'),
      references: submitted.sites
        .map((site) => site.caseManagementReference)
        .filter(Boolean),
      manageSitesUrl: manageSitesUrl(view, currentLocale)
    })
  }
}
