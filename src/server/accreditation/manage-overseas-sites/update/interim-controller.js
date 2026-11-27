import { statusCodes } from '../../../common/constants/status-codes.js'
import { COUNTRIES } from '../../../common/data/countries.js'
import { INTERIM_OPERATION_CODES } from '../../../common/helpers/interimSiteValidation.js'
import {
  accreditationChangesService,
  conflictMessage
} from '../../../common/helpers/accreditationChangesService.js'
import { organisationIdFrom } from '../controller.js'
import { updateUrl, updatedUrl } from '../urls.js'
import {
  VIEWS,
  errorList,
  handler,
  refused,
  refusedOnDetails,
  refusedStatus,
  saveChange,
  trimmedFields
} from './shared.js'
import { INTERIM_SITES_UPDATED } from './steps.js'
import { validateInterim } from './validation.js'
import { interimAddition, interimFields, updateText } from './view-model.js'

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
    ...trimmedFields(payload, [...INTERIM_TEXT_FIELDS, 'country']),
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

function interimView(
  h,
  t,
  request,
  { isNew, values, errors = {}, pageError = null }
) {
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
    countryItems: [
      { value: '', text: '' },
      ...COUNTRIES.map((country) => ({
        value: country,
        text: country,
        selected: country === values.country
      }))
    ],
    codeItems: INTERIM_OPERATION_CODES.map((code) => ({
      value: code,
      text: code,
      id: `operation-${code}`,
      checked: (values.operationCodes ?? []).includes(code),
      attributes: { 'data-testid': `operation-${code}` }
    })),
    values,
    errors,
    errorSummary: errorList(errors, pageError)
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
      ...refused(t, result, INTERIM_FIELDS)
    }).code(refusedStatus(result))
  }
  return h.redirect(updatedUrl(applicationId, siteId, INTERIM_SITES_UPDATED))
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
    return h.redirect(updatedUrl(applicationId, siteId, INTERIM_SITES_UPDATED))
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
