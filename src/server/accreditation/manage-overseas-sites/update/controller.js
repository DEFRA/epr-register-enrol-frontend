import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { CHANGE_TYPES } from '../../../common/constants/changeRequests.js'
import { COUNTRIES } from '../../../common/data/countries.js'
import {
  accreditationChangesService,
  validationErrors
} from '../../../common/helpers/accreditationChangesService.js'
import {
  loadView,
  organisationIdFrom,
  redirectToManageSites
} from '../controller.js'
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
import { validateInterim, validateStep } from './validation.js'

const VIEWS = {
  details: 'accreditation/manage-overseas-sites/update/details',
  step: 'accreditation/manage-overseas-sites/update/step',
  interim: 'accreditation/manage-overseas-sites/update/interim',
  submitted: 'accreditation/manage-overseas-sites/update/submitted'
}

// 404 no such site or draft; 409 held by a submitted request (AC03) or the
// draft was sent once and is fixed.
const NOTHING_TO_DO = new Set([statusCodes.notFound, statusCodes.conflict])

const INTERIM_CODES = ['R12', 'R13', 'R3', 'R4', 'R5']

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
    // AC02: shown as read-only inputs (user, 2026-11-26), and sent unchanged.
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
        type: 'textarea'
      }
    ]
  }
}

export const STEP_NAMES = Object.keys(STEPS)

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

/**
 * Puts the ORS's update item in the draft if it isn't there yet (the first
 * change starts it), then runs `call`. Returns the backend's field errors on a
 * 400, a redirect when there's nothing to change, or null when it saved.
 */
async function saveChange(request, h, call) {
  const { applicationId, siteId } = request.params
  const organisationId = organisationIdFrom(request)
  try {
    await accreditationChangesService.addSite(
      organisationId,
      applicationId,
      siteId,
      CHANGE_TYPES.updateOverseasSite
    )
    await call(organisationId, applicationId, siteId)
    return null
  } catch (err) {
    if (err.status === statusCodes.badRequest) {
      return { errors: validationErrors(err) }
    }
    if (NOTHING_TO_DO.has(err.status)) {
      return { redirect: h.redirect(updateUrl(applicationId, siteId)) }
    }
    throw err
  }
}

// ASP.NET may send a ValidationProblem's keys in PascalCase.
function backendErrors(t, errors, names) {
  const byLower = Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value
    ])
  )
  const mapped = {}
  for (const name of names) {
    const message = [byLower[name.toLowerCase()]].flat().find(Boolean)
    if (message) {
      mapped[name] = message
    }
  }
  if (Object.keys(mapped).length === 0) {
    mapped[names[0]] = t('pages.manageOverseasSites.saveRefused')
  }
  return mapped
}

function errorList(errors) {
  return Object.entries(errors).map(([name, text]) => ({
    href: `#${name}`,
    text
  }))
}

// --- Site details (Figma screens 3 and 5) -----------------------------------

export const detailsGetController = handler(
  {},
  (request, h, { t, currentLocale }, loaded) => {
    const { applicationId } = request.params
    const { view, update } = loaded
    const { entry, item, pending } = update
    const updated = updateText(t, `updated.${request.query?.updated}`)
    return h.view(VIEWS.details, {
      pageTitle: `${update.details.siteName ?? entry.site.siteName} (${entry.orsId})`,
      heading: `${entry.site.siteName} (${entry.orsId})`,
      backLink: manageSitesUrl(view, currentLocale),
      manageSitesUrl: manageSitesUrl(view, currentLocale),
      status: pending ? 'pending' : item ? 'inProgress' : 'approved',
      validFrom: entry.site.validFrom ?? null,
      successBanner:
        request.query?.updated && !updated.startsWith('pages.')
          ? updated
          : null,
      rows: buildDetailRows({ t, applicationId, update }),
      interimSites: buildInterimRows({ applicationId, update }),
      addInterimSiteUrl: pending
        ? null
        : newInterimSiteUrl(applicationId, entry.siteId),
      continueUrl: item ? requestsUrl(applicationId) : null,
      pending
    })
  }
)

// --- ORS detail steps ----------------------------------------------------------

function stepView(h, t, request, update, values, errors) {
  const { applicationId, siteId, step } = request.params
  const config = STEPS[step]
  const site = update.entry.site
  return h.view(VIEWS.step, {
    pageTitle: t(config.titleKey),
    heading: t(config.titleKey),
    backLink: updateUrl(applicationId, siteId),
    cancelUrl: updateUrl(applicationId, siteId),
    inputs: config.fields.map((field) => ({
      ...field,
      label: t(field.labelKey),
      hint: field.hintKey ? t(field.hintKey) : null,
      value: values[field.name] ?? '',
      error: errors[field.name] ?? null
    })),
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
    const config = STEPS[step]
    const names = config.fields.map((field) => field.name)
    const values = Object.fromEntries(
      names.map((name) => [name, String(request.payload?.[name] ?? '').trim()])
    )
    const errors = validateStep(t, step, values)
    if (Object.keys(errors).length > 0) {
      return stepView(h, t, request, update, values, errors).code(
        statusCodes.badRequest
      )
    }
    // The read-only fields are sent as the form shows them; the backend refuses a change to them.
    const readOnly = Object.fromEntries(
      (config.readOnly ?? []).map((field) => [
        field.name,
        request.payload?.[field.name]
      ])
    )
    const result = await saveChange(request, h, (org, app, site) =>
      accreditationChangesService.patchSite(org, app, site, {
        ...values,
        ...readOnly
      })
    )
    if (result?.redirect) {
      return result.redirect
    }
    if (result?.errors) {
      return stepView(
        h,
        t,
        request,
        update,
        values,
        backendErrors(t, result.errors, names)
      ).code(statusCodes.badRequest)
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

function interimValues(payload) {
  const values = Object.fromEntries(
    INTERIM_TEXT_FIELDS.map((name) => [
      name,
      String(payload?.[name] ?? '').trim()
    ])
  )
  values.country = String(payload?.country ?? '').trim()
  values.operationCodes = [payload?.operationCodes ?? []].flat().filter(Boolean)
  return values
}

function interimBody(values) {
  return {
    ...values,
    addressLine2: values.addressLine2 || null,
    stateOrRegion: values.stateOrRegion || null,
    postcode: values.postcode || null
  }
}

function interimView(h, t, request, { isNew, values, errors }) {
  const { applicationId, siteId } = request.params
  return h.view(VIEWS.interim, {
    pageTitle: updateText(
      t,
      isNew ? 'interim.addHeading' : 'interim.changeHeading'
    ),
    heading: updateText(
      t,
      isNew ? 'interim.addHeading' : 'interim.changeHeading'
    ),
    backLink: updateUrl(applicationId, siteId),
    cancelUrl: updateUrl(applicationId, siteId),
    isNew,
    countries: COUNTRIES,
    codes: INTERIM_CODES,
    values,
    errors: errors ?? {},
    errorSummary: errorList(errors ?? {})
  })
}

async function saveInterim(request, h, t, { isNew, call }) {
  const { applicationId, siteId } = request.params
  const values = interimValues(request.payload)
  const errors = validateInterim(t, values, { isNew })
  if (Object.keys(errors).length > 0) {
    return interimView(h, t, request, { isNew, values, errors }).code(
      statusCodes.badRequest
    )
  }
  const result = await saveChange(request, h, (org, app, site) =>
    call(org, app, site, interimBody(values))
  )
  if (result?.redirect) {
    return result.redirect
  }
  if (result?.errors) {
    return interimView(h, t, request, {
      isNew,
      values,
      errors: backendErrors(t, result.errors, [
        ...INTERIM_TEXT_FIELDS,
        'country',
        'operationCodes'
      ])
    }).code(statusCodes.badRequest)
  }
  return h.redirect(`${updateUrl(applicationId, siteId)}?updated=interim-sites`)
}

export const interimChangeGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const fields = interimFields(update, request.params.interimSiteId)
    if (!fields) {
      return h.redirect(
        updateUrl(request.params.applicationId, request.params.siteId)
      )
    }
    return interimView(h, t, request, { isNew: false, values: fields })
  }
)

export const interimChangePostController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const fields = interimFields(update, request.params.interimSiteId)
    if (!fields) {
      return h.redirect(
        updateUrl(request.params.applicationId, request.params.siteId)
      )
    }
    // AC02: an interim site's country and recycling operations stay as they are.
    request.payload = {
      ...request.payload,
      country: fields.country,
      operationCodes: fields.operationCodes
    }
    return saveInterim(request, h, t, {
      isNew: false,
      call: (org, app, site, body) =>
        accreditationChangesService.changeInterimSite(
          org,
          app,
          site,
          request.params.interimSiteId,
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
  (request, h, { t }) =>
    saveInterim(request, h, t, {
      isNew: true,
      call: (org, app, site, body) =>
        accreditationChangesService.addInterimSite(org, app, site, body)
    })
)

export const interimAdditionGetController = handler(
  { editable: true },
  (request, h, { t }, { update }) => {
    const addition = interimAddition(update, request.params.changeId)
    if (!addition) {
      return h.redirect(
        updateUrl(request.params.applicationId, request.params.siteId)
      )
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
    if (!interimAddition(update, request.params.changeId)) {
      return h.redirect(
        updateUrl(request.params.applicationId, request.params.siteId)
      )
    }
    return saveInterim(request, h, t, {
      isNew: true,
      call: (org, app, site, body) =>
        accreditationChangesService.changeInterimSiteAddition(
          org,
          app,
          site,
          request.params.changeId,
          body
        )
    })
  }
)

// Remove and undo change the draft, so each is a crumb-protected POST styled as a link.
export const interimRemoveController = handler(
  { editable: true },
  async (request, h) => {
    const { applicationId, siteId, interimSiteId } = request.params
    const result = await saveChange(request, h, (org, app, site) =>
      accreditationChangesService.removeInterimSite(
        org,
        app,
        site,
        interimSiteId
      )
    )
    return (
      result?.redirect ??
      h.redirect(`${updateUrl(applicationId, siteId)}?updated=interim-sites`)
    )
  }
)

export const interimUndoController = handler(
  { editable: true },
  async (request, h) => {
    const { applicationId, siteId, changeId } = request.params
    try {
      await accreditationChangesService.undoInterimSiteChange(
        organisationIdFrom(request),
        applicationId,
        siteId,
        changeId
      )
    } catch (err) {
      if (!NOTHING_TO_DO.has(err.status)) {
        throw err
      }
    }
    return h.redirect(updateUrl(applicationId, siteId))
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

export const submittedGetController = {
  async handler(request, h) {
    const { t, currentLocale } = getLocaleAndTranslator(request)
    const view = await loadView(request)
    const submitted = view.requests?.find(
      (changeRequest) => changeRequest.status === 'Submitted'
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
