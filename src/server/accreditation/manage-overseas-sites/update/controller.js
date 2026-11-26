import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import {
  CHANGE_TYPES,
  ITEM_STATUSES
} from '../../../common/constants/changeRequests.js'
import { COUNTRIES } from '../../../common/data/countries.js'
import { INTERIM_OPERATION_CODES } from '../../../common/helpers/interimSiteValidation.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'
import {
  accreditationChangesService,
  validationErrors
} from '../../../common/helpers/accreditationChangesService.js'
import {
  NOTHING_TO_DO,
  loadView,
  organisationIdFrom,
  redirectToManageSites
} from '../controller.js'
import { errorKeyFor, refusal } from '../steps-controller.js'
import {
  manageSitesUrl,
  newInterimSiteUrl,
  requestsUrl,
  updateUrl
} from '../urls.js'
import {
  buildDetailRows,
  buildInterimRows,
  interimAddition,
  interimFields,
  resolveUpdate,
  updateText
} from './view-model.js'
import { isTooManyWords, validateInterim, validateStep } from './validation.js'

const VIEWS = {
  details: 'accreditation/manage-overseas-sites/update/details',
  step: 'accreditation/manage-overseas-sites/update/step',
  interim: 'accreditation/manage-overseas-sites/update/interim',
  submitted: 'accreditation/manage-overseas-sites/update/submitted'
}

const MAX_REPATRIATED_WORDS = 500

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
    // AC02: shown as read-only inputs (RA-682) from the ORS's stored values,
    // and never posted, so the update can't change them.
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

/**
 * The accredited ORS for the route, or a redirect to Manage ORS when it isn't
 * one. With `editable`, an ORS held by a submitted request (AC03) goes back to
 * its details page, which shows it read only.
 */
async function loadUpdate(request, h, { editable = false } = {}) {
  const { applicationId, siteId } = request.params
  const view = await loadView(request)
  const update = resolveUpdate(view, siteId)
  if (!update) {
    return { redirect: await redirectToManageSites(request, h, view) }
  }
  if (editable && update.pending) {
    return { redirect: h.redirect(updateUrl(applicationId, siteId)) }
  }
  return { view, update }
}

function handler(options, run) {
  return {
    async handler(request, h) {
      const loaded = await loadUpdate(request, h, options)
      if (loaded.redirect) {
        return loaded.redirect
      }
      return run(request, h, getLocaleAndTranslator(request), loaded)
    }
  }
}

// Results.Conflict(string) sends the message as a JSON string; a
// ProblemDetails carries it as its detail.
function conflictMessage(err) {
  try {
    const body =
      typeof err.response === 'string' ? JSON.parse(err.response) : null
    return typeof body === 'string' ? body : (body?.detail ?? null)
  } catch {
    return null
  }
}

// After a failed first save the update item holds nothing, so it comes back
// out rather than show the ORS as In progress with no change.
async function takeOutEmptyItem(
  request,
  organisationId,
  applicationId,
  siteId
) {
  try {
    await accreditationChangesService.removeSite(
      organisationId,
      applicationId,
      siteId
    )
  } catch (err) {
    logStructuredError(
      request.logger,
      err,
      { applicationId, siteId },
      'Could not take an empty ORS update back out of the draft'
    )
  }
}

/**
 * Starts the ORS's update item if the draft doesn't hold it yet, then runs
 * `call`. Returns null when it saved, the backend's field errors on a 400, its
 * message on a 409 (a concurrent edit, or a change already sent), or a
 * redirect when the ORS has gone.
 */
async function saveChange(request, h, update, call) {
  const { applicationId, siteId } = request.params
  const organisationId = organisationIdFrom(request)
  let started = false
  try {
    if (!update.item) {
      await accreditationChangesService.addSite(
        organisationId,
        applicationId,
        siteId,
        CHANGE_TYPES.updateOverseasSite
      )
      started = true
    }
    await call(organisationId, applicationId, siteId)
    return null
  } catch (err) {
    if (started) {
      await takeOutEmptyItem(request, organisationId, applicationId, siteId)
    }
    if (err.status === statusCodes.badRequest) {
      return { errors: validationErrors(err) }
    }
    if (err.status === statusCodes.conflict) {
      return { message: conflictMessage(err) }
    }
    if (err.status === statusCodes.notFound) {
      return { redirect: h.redirect(updateUrl(applicationId, siteId)) }
    }
    throw err
  }
}

/** A refused save's message against each field it names, or the first field when it names none. */
function refusedFields(t, result, names) {
  if (result.errors) {
    const named = names.filter((name) => errorKeyFor(result.errors, name))
    return Object.fromEntries(
      (named.length > 0 ? named : names.slice(0, 1)).map((name) => [
        name,
        refusal(t, result.errors, name)
      ])
    )
  }
  return {
    [names[0]]: result.message ?? t('pages.manageOverseasSites.saveRefused')
  }
}

function refusedStatus(result) {
  return result.errors ? statusCodes.badRequest : statusCodes.conflict
}

function errorList(errors) {
  return Object.entries(errors).map(([name, text]) => ({
    href: `#${name}`,
    text
  }))
}

// --- Site details (Figma screens 3 and 5) -----------------------------------

function statusOf({ pending, item }) {
  if (pending) {
    return 'pending'
  }
  return item ? 'inProgress' : 'approved'
}

function detailsView(h, request, { t, currentLocale }, loaded, error = null) {
  const { applicationId } = request.params
  const { view, update } = loaded
  const { entry, item, pending } = update
  const updated = request.query?.updated
  const name = `${entry.site.siteName} (${entry.orsId})`
  return h.view(VIEWS.details, {
    pageTitle: name,
    heading: name,
    backLink: manageSitesUrl(view, currentLocale),
    manageSitesUrl: manageSitesUrl(view, currentLocale),
    status: statusOf(update),
    validFrom: entry.site.validFrom ?? null,
    successBanner:
      updated && !error ? updateText(t, `updated.${updated}`) : null,
    error,
    rows: buildDetailRows({ t, applicationId, update }),
    interimSites: buildInterimRows({ applicationId, update }),
    addInterimSiteUrl: pending
      ? null
      : newInterimSiteUrl(applicationId, entry.siteId),
    continueUrl: item ? requestsUrl(applicationId) : null,
    pending
  })
}

export const detailsGetController = handler({}, (request, h, locale, loaded) =>
  detailsView(h, request, locale, loaded)
)

// --- ORS detail steps ----------------------------------------------------------

function characterCount(field, value, error, tooManyWords) {
  return {
    id: field.name,
    name: field.name,
    maxwords: field.maxwords,
    rows: 8,
    value,
    label: { text: field.label },
    hint: field.hint ? { text: field.hint } : undefined,
    errorMessage: error
      ? {
          text: error,
          attributes: {
            'data-testid': `${field.name}-error`,
            ...(tooManyWords ? { 'data-error-type': 'length' } : {})
          }
        }
      : undefined,
    attributes: { 'data-testid': `${field.name}-input` }
  }
}

function stepView(h, t, request, update, values, errors) {
  const { applicationId, siteId, step } = request.params
  const config = STEPS[step]
  const site = update.entry.site
  const tooManyWords =
    Boolean(errors.repatriatedLoads) && isTooManyWords(t, values)
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
        ? {
            ...input,
            characterCount: characterCount(
              input,
              input.value,
              input.error,
              tooManyWords
            )
          }
        : input
    }),
    readOnly: (config.readOnly ?? []).map((field) => ({
      ...field,
      label: t(field.labelKey),
      hint: field.hintKey ? t(field.hintKey) : null,
      value: site[field.name] ?? ''
    })),
    errors: errorList(errors)
  })
}

export const stepGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) =>
    stepView(h, t, request, update, update.details, {})
)

export const stepPostController = handler(
  { editable: true },
  async (request, h, { t }, { update }) => {
    const { applicationId, siteId, step } = request.params
    const names = STEPS[step].fields.map((field) => field.name)
    const values = Object.fromEntries(
      names.map((name) => [name, String(request.payload?.[name] ?? '').trim()])
    )
    const errors = validateStep(t, step, values)
    if (Object.keys(errors).length > 0) {
      return stepView(h, t, request, update, values, errors).code(
        statusCodes.badRequest
      )
    }
    const result = await saveChange(request, h, update, (org, app, site) =>
      accreditationChangesService.patchSite(org, app, site, values)
    )
    if (result?.redirect) {
      return result.redirect
    }
    if (result) {
      return stepView(
        h,
        t,
        request,
        update,
        values,
        refusedFields(t, result, names)
      ).code(refusedStatus(result))
    }
    return h.redirect(`${updateUrl(applicationId, siteId)}?updated=${step}`)
  }
)

// --- Interim sites (AC04) ------------------------------------------------------

const INTERIM_TEXT_FIELDS = [
  'siteName',
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'stateOrRegion',
  'postcode',
  'contactName',
  'contactEmail',
  'contactPhone'
]

const INTERIM_FIELDS = [...INTERIM_TEXT_FIELDS, 'country', 'operationCodes']

function interimValues(payload) {
  return {
    ...Object.fromEntries(
      INTERIM_TEXT_FIELDS.map((name) => [
        name,
        String(payload?.[name] ?? '').trim()
      ])
    ),
    country: String(payload?.country ?? '').trim(),
    operationCodes: [payload?.operationCodes ?? []].flat().filter(Boolean)
  }
}

function interimBody(values) {
  return {
    ...values,
    addressLine2: values.addressLine2 || null,
    stateOrRegion: values.stateOrRegion || null,
    postcode: values.postcode || null
  }
}

function interimView(h, t, request, { isNew, values, errors = {} }) {
  const { applicationId, siteId } = request.params
  const heading = updateText(
    t,
    isNew ? 'interim.addHeading' : 'interim.changeHeading'
  )
  return h.view(VIEWS.interim, {
    pageTitle: heading,
    heading,
    backLink: updateUrl(applicationId, siteId),
    cancelUrl: updateUrl(applicationId, siteId),
    isNew,
    countries: COUNTRIES,
    codes: INTERIM_OPERATION_CODES,
    values,
    errors,
    errorSummary: errorList(errors)
  })
}

/**
 * Saves the interim site form. `locked` holds a changed interim site's
 * country and recycling operations (AC02), which stay as they are whatever is
 * posted; a new one takes them from the form.
 */
async function saveInterim(request, h, t, { update, locked, call }) {
  const { applicationId, siteId } = request.params
  const isNew = !locked
  const values = { ...interimValues(request.payload), ...locked }
  const errors = validateInterim(t, values, { isNew })
  if (Object.keys(errors).length > 0) {
    return interimView(h, t, request, { isNew, values, errors }).code(
      statusCodes.badRequest
    )
  }
  const result = await saveChange(request, h, update, (org, app, site) =>
    call(org, app, site, interimBody(values))
  )
  if (result?.redirect) {
    return result.redirect
  }
  if (result) {
    return interimView(h, t, request, {
      isNew,
      values,
      errors: refusedFields(t, result, INTERIM_FIELDS)
    }).code(refusedStatus(result))
  }
  return h.redirect(`${updateUrl(applicationId, siteId)}?updated=interim-sites`)
}

function backToDetails(request, h) {
  return h.redirect(
    updateUrl(request.params.applicationId, request.params.siteId)
  )
}

export const interimChangeGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const fields = interimFields(update, request.params.interimSiteId)
    if (!fields) {
      return backToDetails(request, h)
    }
    return interimView(h, t, request, { isNew: false, values: fields })
  }
)

export const interimChangePostController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const { interimSiteId } = request.params
    const fields = interimFields(update, interimSiteId)
    if (!fields) {
      return backToDetails(request, h)
    }
    return saveInterim(request, h, t, {
      update,
      locked: {
        country: fields.country,
        operationCodes: fields.operationCodes
      },
      call: (org, app, site, body) =>
        accreditationChangesService.changeInterimSite(
          org,
          app,
          site,
          interimSiteId,
          body
        )
    })
  }
)

export const interimNewGetController = handler(
  { editable: true },
  (request, h, { t }) =>
    interimView(h, t, request, { isNew: true, values: { operationCodes: [] } })
)

export const interimNewPostController = handler(
  { editable: true },
  (request, h, { t }, { update }) =>
    saveInterim(request, h, t, {
      update,
      call: (org, app, site, body) =>
        accreditationChangesService.addInterimSite(org, app, site, body)
    })
)

export const interimAdditionGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const addition = interimAddition(update, request.params.changeId)
    if (!addition) {
      return backToDetails(request, h)
    }
    return interimView(h, t, request, {
      isNew: true,
      values: addition.proposed
    })
  }
)

export const interimAdditionPostController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const { changeId } = request.params
    if (!interimAddition(update, changeId)) {
      return backToDetails(request, h)
    }
    return saveInterim(request, h, t, {
      update,
      call: (org, app, site, body) =>
        accreditationChangesService.changeInterimSiteAddition(
          org,
          app,
          site,
          changeId,
          body
        )
    })
  }
)

function refusedOnDetails(h, request, locale, loaded, result) {
  return detailsView(
    h,
    request,
    locale,
    loaded,
    result.message ?? locale.t('pages.manageOverseasSites.saveRefused')
  ).code(refusedStatus(result))
}

// Remove and undo change the draft, so each is a crumb-protected POST styled as a link.
export const interimRemoveController = handler(
  { editable: true },
  async (request, h, locale, loaded) => {
    const { applicationId, siteId, interimSiteId } = request.params
    const result = await saveChange(
      request,
      h,
      loaded.update,
      (org, app, site) =>
        accreditationChangesService.removeInterimSite(
          org,
          app,
          site,
          interimSiteId
        )
    )
    if (result?.redirect) {
      return result.redirect
    }
    if (result) {
      return refusedOnDetails(h, request, locale, loaded, result)
    }
    return h.redirect(
      `${updateUrl(applicationId, siteId)}?updated=interim-sites`
    )
  }
)

export const interimUndoController = handler(
  { editable: true },
  async (request, h, locale, loaded) => {
    const { applicationId, siteId, changeId } = request.params
    try {
      await accreditationChangesService.undoInterimSiteChange(
        organisationIdFrom(request),
        applicationId,
        siteId,
        changeId
      )
    } catch (err) {
      if (err.status === statusCodes.conflict) {
        return refusedOnDetails(h, request, locale, loaded, {
          message: conflictMessage(err)
        })
      }
      if (err.status !== statusCodes.notFound) {
        throw err
      }
    }
    return backToDetails(request, h)
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

/** The newest submitted request of ORS changes with nothing to pay. */
function submittedFreeRequest(view) {
  return view.requests?.find(
    (changeRequest) =>
      changeRequest.status === ITEM_STATUSES.submitted &&
      changeRequest.sites?.length > 0 &&
      (changeRequest.charge?.chargeableSites ?? 0) === 0
  )
}

export const submittedGetController = {
  async handler(request, h) {
    const { t, currentLocale } = getLocaleAndTranslator(request)
    const view = await loadView(request)
    const submitted = submittedFreeRequest(view)
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
