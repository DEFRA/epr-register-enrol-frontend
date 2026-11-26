import { COUNTRIES } from '../../../common/data/countries.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import {
  INTERIM_CONTACT_PHONE_RULES,
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../../../common/constants/siteFieldLimits.js'
import {
  accreditationChangesService,
  validationErrors
} from '../../../common/helpers/accreditationChangesService.js'
import { validateSiteLocationFields } from '../../../common/helpers/overseasSiteLocationValidation.js'
import {
  validateOrsContactDetails,
  validateRepatriatedLoads,
  validateSiteName
} from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { validateSiteContactDetails } from '../../../common/helpers/siteContactDetails.js'
import { findQueriedInterimSite, loadQueriedItem, orsValue } from './load.js'
import { interimSiteUrl } from './urls.js'

// RA-698: the pages that change one editable field of the queried ORS, or of
// one of its interim sites. Each reuses the add-overseas-site (or
// add-interim-site) page's view and validation, and saves with the item's
// own PATCH, then returns to the page it came from with a success banner.

export const FLASH_UPDATED = 'changeRequestUpdated'
export const FLASH_PROBLEM = 'changeRequestProblem'

const ORS_VIEWS = {
  siteName: 'accreditation/add-overseas-site/site-name/index',
  location: 'manage/change-requests/respond/location',
  contact: 'accreditation/add-overseas-site/site-contact-details/index',
  loads: 'accreditation/add-overseas-site/repatriated-loads/index'
}

const INTERIM_VIEWS = {
  siteName: 'accreditation/add-interim-site/site-name/index',
  location: 'accreditation/add-interim-site/site-location/index',
  contact: 'accreditation/add-interim-site/site-contact-details/index'
}

const LOADS_MAX_WORDS = 500

const ADDRESS_FIELDS = [
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'stateOrRegion',
  'postcode'
]

const trimmed = (payload, key) => {
  const value = payload?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

// ASP.NET may send a ValidationProblem's error keys in either case.
function apiErrorFor(errors, field) {
  const key = Object.keys(errors).find(
    (name) => name.toLowerCase() === field.toLowerCase()
  )
  return key ? [errors[key]].flat().find(Boolean) : null
}

const respondText = (ctx, key) =>
  ctx.t(`pages.manageChangeRequests.respond.${key}`)

// The buttons every page here shares: it saves one change and goes back.
const buttons = (ctx, back) => ({
  continueButton: respondText(ctx, 'actions.change'),
  cancelLink: respondText(ctx, 'actions.cancel'),
  backLink: back,
  cancelUrl: back
})

const addressFields = (read) =>
  Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, read(field)]))

// --- The ORS's own steps ----------------------------------------------------

// `fields` maps the page's form field to the backend's.
const ORS_STEPS = {
  'site-name': {
    label: 'siteName',
    fields: { siteName: 'siteName' },
    read: (ctx) => ({ siteName: orsValue(ctx, 'siteName') }),
    parse: (payload) => ({ siteName: trimmed(payload, 'siteName') }),
    validate: (t, values) => {
      const error = validateSiteName(t, values.siteName)
      return error ? { siteName: error } : {}
    },
    render: (h, ctx, values, errors, back) =>
      h.view(ORS_VIEWS.siteName, {
        pageTitle: ctx.t('pages.addOverseasSite.siteName.title'),
        heading: ctx.t('pages.addOverseasSite.siteName.heading'),
        label: ctx.t('pages.addOverseasSite.siteName.label'),
        hint: ctx.t('pages.addOverseasSite.siteName.hint'),
        ...buttons(ctx, back),
        siteName: values.siteName,
        error: errors.siteName ?? null
      })
  },

  location: {
    label: 'location',
    fields: Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, field])),
    read: (ctx) => addressFields((field) => orsValue(ctx, field)),
    parse: (payload) => addressFields((field) => trimmed(payload, field)),
    validate: (t, values, ctx) => {
      // Country and coordinates cannot change, so only the address's rules apply.
      const all = validateSiteLocationFields(t, {
        ...values,
        country: orsValue(ctx, 'country'),
        coordinates: orsValue(ctx, 'coordinates')
      })
      return Object.fromEntries(
        Object.entries(all).filter(([field]) => ADDRESS_FIELDS.includes(field))
      )
    },
    render: (h, ctx, values, errors, back) =>
      h.view(ORS_VIEWS.location, {
        pageTitle: ctx.t('pages.addOverseasSite.siteLocation.title'),
        heading: ctx.t('pages.addOverseasSite.siteLocation.heading'),
        ...buttons(ctx, back),
        countries: COUNTRIES,
        fields: values,
        locked: {
          country: orsValue(ctx, 'country'),
          coordinates: orsValue(ctx, 'coordinates')
        },
        lockedHint: respondText(ctx, 'lockedHint'),
        errors
      })
  },

  'contact-details': {
    label: 'contactName',
    fields: {
      siteContactName: 'contactName',
      siteContactEmail: 'contactEmail',
      siteContactPhone: 'contactPhone'
    },
    read: (ctx) => ({
      siteContactName: orsValue(ctx, 'contactName'),
      siteContactEmail: orsValue(ctx, 'contactEmail'),
      siteContactPhone: orsValue(ctx, 'contactPhone')
    }),
    parse: (payload) => ({
      siteContactName: trimmed(payload, 'siteContactName'),
      siteContactEmail: trimmed(payload, 'siteContactEmail'),
      siteContactPhone: trimmed(payload, 'siteContactPhone')
    }),
    validate: (t, values) => validateOrsContactDetails(t, values),
    render: (h, ctx, values, errors, back) =>
      h.view(ORS_VIEWS.contact, {
        pageTitle: ctx.t('pages.addOverseasSite.siteContactDetails.title'),
        heading: ctx.t('pages.addOverseasSite.siteContactDetails.heading'),
        ...buttons(ctx, back),
        fields: values,
        errors
      })
  },

  'rejected-loads': {
    label: 'repatriatedLoads',
    fields: { repatriatedLoads: 'rejectedLoadsArrangements' },
    read: (ctx) => ({
      repatriatedLoads: orsValue(ctx, 'rejectedLoadsArrangements')
    }),
    parse: (payload) => ({
      repatriatedLoads: trimmed(payload, 'repatriatedLoads')
    }),
    validate: (t, values) => {
      const invalid = validateRepatriatedLoads(t, values.repatriatedLoads)
      return invalid
        ? {
            repatriatedLoads: invalid.message,
            tooManyWords: invalid.tooManyWords
          }
        : {}
    },
    render: (h, ctx, values, errors, back) =>
      h.view(ORS_VIEWS.loads, {
        pageTitle: ctx.t('pages.addOverseasSite.repatriatedLoads.title'),
        heading: ctx.t('pages.addOverseasSite.repatriatedLoads.heading'),
        ...buttons(ctx, back),
        error: errors.repatriatedLoads ?? null,
        textareaInput: {
          id: 'repatriated-loads',
          name: 'repatriatedLoads',
          maxwords: LOADS_MAX_WORDS,
          rows: 8,
          value: values.repatriatedLoads,
          label: {
            text: ctx.t('pages.addOverseasSite.repatriatedLoads.label')
          },
          hint: { text: ctx.t('pages.addOverseasSite.repatriatedLoads.hint') },
          errorMessage: errors.repatriatedLoads
            ? {
                text: errors.repatriatedLoads,
                attributes: {
                  'data-testid': 'repatriated-loads-error',
                  ...(errors.tooManyWords
                    ? { 'data-error-type': 'length' }
                    : {})
                }
              }
            : undefined,
          attributes: { 'data-testid': 'repatriated-loads-textarea' }
        }
      })
  }
}

// --- An interim site's steps ------------------------------------------------

const INTERIM_CONTACT_OPTIONS = {
  keyPrefix: 'pages.addInterimSite.siteContactDetails.validation',
  phoneRequired: true,
  nameRejectsDigits: false,
  phoneRules: INTERIM_CONTACT_PHONE_RULES
}

const INTERIM_LOCATION_RULES = [
  ['addressLine1', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine1TooLong'],
  ['addressLine2', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine2TooLong'],
  ['townOrCity', SITE_FIELD_MAX_LENGTHS.townOrCity, 'townOrCityTooLong'],
  [
    'stateOrRegion',
    SITE_FIELD_MAX_LENGTHS.stateOrRegion,
    'stateOrRegionTooLong'
  ],
  ['postcode', SITE_FIELD_MAX_LENGTHS.postcode, 'postcodeTooLong']
]

// The add-interim-site location page's rules, which it keeps inline.
function validateInterimLocation(t, values) {
  const text = (key) => t(`pages.addInterimSite.siteLocation.validation.${key}`)
  const errors = {}
  if (!values.addressLine1) {
    errors.addressLine1 = text('addressLine1Required')
  }
  if (!values.townOrCity) {
    errors.townOrCity = text('townOrCityRequired')
  }
  for (const [field, maxLength, key] of INTERIM_LOCATION_RULES) {
    if (!errors[field] && exceedsMaxLength(values[field], maxLength)) {
      errors[field] = text(key)
    }
  }
  return errors
}

function validateInterimName(t, siteName) {
  if (!siteName) {
    return t('pages.addInterimSite.siteName.validation.required')
  }
  return exceedsMaxLength(siteName, SITE_FIELD_MAX_LENGTHS.siteName)
    ? t('pages.addInterimSite.siteName.validation.tooLong')
    : null
}

const interimValue = (interim, field) => interim.values?.[field] ?? ''

const INTERIM_STEPS = {
  'site-name': {
    label: 'siteName',
    fields: { siteName: 'siteName' },
    read: (_ctx, interim) => ({ siteName: interimValue(interim, 'siteName') }),
    parse: (payload) => ({ siteName: trimmed(payload, 'siteName') }),
    validate: (t, values) => {
      const error = validateInterimName(t, values.siteName)
      return error ? { siteName: error } : {}
    },
    render: (h, ctx, values, errors, back) =>
      h.view(INTERIM_VIEWS.siteName, {
        pageTitle: ctx.t('pages.addInterimSite.siteName.title'),
        heading: ctx.t('pages.addInterimSite.siteName.heading'),
        label: ctx.t('pages.addInterimSite.siteName.label'),
        hint: ctx.t('pages.addInterimSite.siteName.hint'),
        ...buttons(ctx, back),
        siteName: values.siteName,
        error: errors.siteName ?? null
      })
  },

  location: {
    label: 'location',
    fields: Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, field])),
    read: (_ctx, interim) =>
      addressFields((field) => interimValue(interim, field)),
    parse: (payload) => addressFields((field) => trimmed(payload, field)),
    validate: (t, values) => validateInterimLocation(t, values),
    render: (h, ctx, values, errors, back) =>
      h.view(INTERIM_VIEWS.location, {
        pageTitle: ctx.t('pages.addInterimSite.siteLocation.title'),
        heading: ctx.t('pages.addInterimSite.siteLocation.heading'),
        ...buttons(ctx, back),
        fields: values,
        errors
      })
  },

  'contact-details': {
    label: 'contactName',
    fields: {
      siteContactName: 'contactName',
      siteContactEmail: 'contactEmail',
      siteContactPhone: 'contactPhone'
    },
    read: (_ctx, interim) => ({
      siteContactName: interimValue(interim, 'contactName'),
      siteContactEmail: interimValue(interim, 'contactEmail'),
      siteContactPhone: interimValue(interim, 'contactPhone')
    }),
    parse: (payload) => ({
      siteContactName: trimmed(payload, 'siteContactName'),
      siteContactEmail: trimmed(payload, 'siteContactEmail'),
      siteContactPhone: trimmed(payload, 'siteContactPhone')
    }),
    validate: (t, values) =>
      validateSiteContactDetails(t, values, INTERIM_CONTACT_OPTIONS),
    render: (h, ctx, values, errors, back) =>
      h.view(INTERIM_VIEWS.contact, {
        pageTitle: ctx.t('pages.addInterimSite.siteContactDetails.title'),
        heading: ctx.t('pages.addInterimSite.siteContactDetails.heading'),
        ...buttons(ctx, back),
        fields: values,
        errors
      })
  }
}

// --- The shared GET and POST ------------------------------------------------

function patchBody(step, values) {
  return Object.fromEntries(
    Object.entries(step.fields).map(([formKey, apiKey]) => [
      apiKey,
      values[formKey]
    ])
  )
}

function sendPatch(ctx, interimSiteId, body) {
  const { organisationId, applicationId } = ctx
  const { itemId } = ctx.item
  return interimSiteId
    ? accreditationChangesService.patchItemInterimSite(
        organisationId,
        applicationId,
        itemId,
        interimSiteId,
        body
      )
    : accreditationChangesService.patchItem(
        organisationId,
        applicationId,
        itemId,
        body
      )
}

// The form's errors from the backend's refusal (400 for a field's rules, 422
// for a locked one): against each field it names, or the first when it names
// none.
function refusalErrors(ctx, step, err) {
  const apiErrors = validationErrors(err)
  const named = Object.entries(step.fields).filter(([, apiKey]) =>
    apiErrorFor(apiErrors, apiKey)
  )
  const [first] = Object.entries(step.fields)
  return Object.fromEntries(
    (named.length > 0 ? named : [first]).map(([formKey, apiKey]) => [
      formKey,
      apiErrorFor(apiErrors, apiKey) ??
        ctx.t('pages.manageOverseasSites.saveRefused')
    ])
  )
}

/**
 * Saves the form's values. Returns null when the backend took them, the
 * form's errors when it refused them, or `{ notQueried: true }` for a 409:
 * the item is no longer Queried.
 */
async function save(ctx, interimSiteId, step, values) {
  try {
    await sendPatch(ctx, interimSiteId, patchBody(step, values))
    return null
  } catch (err) {
    if (err.status === statusCodes.conflict) {
      return { notQueried: true }
    }
    if (
      err.status !== statusCodes.badRequest &&
      err.status !== statusCodes.unprocessableEntity
    ) {
      throw err
    }
    return refusalErrors(ctx, step, err)
  }
}

function resolveTarget(ctx, interimSiteId) {
  if (!interimSiteId) {
    return { interim: null, back: ctx.itemUrl }
  }
  return {
    interim: findQueriedInterimSite(ctx.item, interimSiteId),
    back: interimSiteUrl(
      ctx.params,
      ctx.item.itemId,
      interimSiteId,
      ctx.currentLocale
    )
  }
}

// A field the query leaves closed goes back to the page that lists it.
function isOpen(ctx, step, interim) {
  const open = new Set((interim ?? ctx.item.query).editableFields ?? [])
  return Object.values(step.fields).every((field) => open.has(field))
}

function stepRoutes(steps, name) {
  const step = steps[name]
  const run = (action) => ({
    async handler(request, h) {
      const { ctx, response } = await loadQueriedItem(request, h)
      if (response) {
        return response
      }
      const { interimSiteId } = request.params
      const { interim, back } = resolveTarget(ctx, interimSiteId)
      if (interimSiteId && !interim) {
        return h.redirect(ctx.itemUrl)
      }
      if (!isOpen(ctx, step, interim)) {
        return h.redirect(back)
      }
      return action(ctx, h, { interim, back, interimSiteId })
    }
  })

  return {
    get: run((ctx, h, { interim, back }) =>
      step.render(h, ctx, step.read(ctx, interim), {}, back)
    ),
    post: run(async (ctx, h, { back, interimSiteId }) => {
      const values = step.parse(ctx.request.payload)
      const invalid = (failures) =>
        step.render(h, ctx, values, failures, back).code(statusCodes.badRequest)

      const errors = step.validate(ctx.t, values, ctx)
      if (Object.keys(errors).length > 0) {
        return invalid(errors)
      }
      const refused = await save(ctx, interimSiteId, step, values)
      if (refused?.notQueried) {
        return h.redirect(ctx.itemUrl)
      }
      if (refused) {
        return invalid(refused)
      }
      ctx.request.yar.flash(
        FLASH_UPDATED,
        respondText(ctx, `fieldLabels.${step.label}`)
      )
      return h.redirect(back)
    })
  }
}

const controllersFor = (steps) =>
  Object.fromEntries(
    Object.keys(steps).map((name) => [name, stepRoutes(steps, name)])
  )

export const orsStepControllers = controllersFor(ORS_STEPS)
export const interimStepControllers = controllersFor(INTERIM_STEPS)
