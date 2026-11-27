import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { accreditationChangesService } from '../../../common/helpers/accreditationChangesService.js'
import { buildTextareaInput } from '../../add-overseas-site/repatriated-loads/controller.js'
import {
  NOTHING_TO_DO,
  loadView,
  organisationIdFrom,
  redirectToManageSites,
  submittedRequest
} from '../controller.js'
import { manageSitesUrl, requestsUrl, updateUrl, updatedUrl } from '../urls.js'
import {
  VIEWS,
  detailsView,
  errorList,
  handler,
  refused,
  refusedStatus,
  saveChange,
  trimmedFields
} from './shared.js'
import { STEPS } from './steps.js'
import { updateText } from './view-model.js'

// --- Site details (Figma screens 3 and 5) -----------------------------------

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
    const values = trimmedFields(request.payload, names)
    const { errors, tooManyWords } = STEPS[step].validate(t, values)
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
    return h.redirect(updatedUrl(applicationId, siteId, step))
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
