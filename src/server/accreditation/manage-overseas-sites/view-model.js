import { hasValue } from '../../common/helpers/hasValue.js'
import { orsAddressLine } from '../../common/helpers/orsAddress.js'
import {
  addSiteToRequestUrl,
  addToAccreditationUrl,
  besEvidenceFileDeleteUrl,
  stepUrl
} from './urls.js'

// RA-492: view models for the in-year add-ORS pages, built from the
// backend's AccreditationChangesView (see accreditationChangesService.js).

export const IN_PROGRESS = 'InProgress'
export const SUBMITTED = 'Submitted'

// Backend field (lockedFields / missingFields / PATCH body) -> summary row
// and the step that edits it. Country and coordinates share the location
// step; the other rows have no step because the backend cannot change them.
export const EDITABLE_FIELDS = {
  country: { row: 'location', step: 'location' },
  coordinates: { row: 'coordinates', step: 'location' },
  operationCodes: { row: 'recycling-operation', step: 'recycling-operation' },
  conditionsOfExport: {
    row: 'conditions-of-export',
    step: 'conditions-of-export'
  },
  besEvidence: { row: 'bes-evidence', step: 'bes-evidence' }
}

/** A translation from this journey's `pages.manageOverseasSites` keys. */
export function manageSitesText(t, key, params) {
  return t(`pages.manageOverseasSites.${key}`, params)
}

export function findSite(view, siteId) {
  return view.sites?.find((entry) => String(entry.siteId) === String(siteId))
}

export function findRequestSite(view, siteId) {
  return view.activeRequest?.sites?.find(
    (site) => String(site.siteId) === String(siteId)
  )
}

/**
 * RA-492's part of RA-425's Manage overseas reprocessing sites page
 * (f02/f03/f12/f13): where each ORS stands in the operator's in-year change
 * requests, and how many sites the in-progress request holds (AC10 banner).
 */
export function changeRequestsSummary(view) {
  const statusBySiteId = new Map(
    view.sites.map((entry) => [
      String(entry.siteId),
      entry.pendingRequestStatus ?? null
    ])
  )
  return {
    pendingRequestStatus: (siteId) =>
      statusBySiteId.get(String(siteId)) ?? null,
    readyForSubmissionCount: view.activeRequest?.sites?.length ?? 0
  }
}

/**
 * RA-492's actions for an ORS on RA-425's Registered tab: "Pending" and no
 * action while it is in a submitted request (AC09), "In progress" and a View
 * link while it is in the draft request, otherwise "Add to accreditation".
 *
 * RA-697: with no accreditation (a null applicationId, for registration only)
 * there is nothing to add the ORS to, and RA-492's View link has no
 * registration-only page yet, so neither link; the tag still follows the data.
 */
export function registeredSiteActions(applicationId, siteId, status) {
  const hasAccreditation = Boolean(applicationId)
  return {
    pending: status === SUBMITTED,
    inProgress: status === IN_PROGRESS,
    addUrl: hasAccreditation
      ? addSiteToRequestUrl(applicationId, siteId)
      : null,
    viewUrl: hasAccreditation
      ? addToAccreditationUrl(applicationId, siteId)
      : null
  }
}

function displayValue(t, field, value) {
  if (!hasValue(value)) {
    return ''
  }
  if (field === 'conditionsOfExport') {
    return t(value ? 'common.yes' : 'common.no')
  }
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function fixedRow(id, label, value) {
  return { id, label, value, missing: !hasValue(value), action: null }
}

function editableRow({ t, applicationId, siteId, field, label, value }) {
  return {
    id: EDITABLE_FIELDS[field].row,
    label,
    value,
    missing: !hasValue(value),
    action: {
      href: stepUrl(applicationId, siteId, EDITABLE_FIELDS[field].step),
      text: manageSitesText(t, hasValue(value) ? 'change' : 'addInformation')
    }
  }
}

// The site's rows, each with the backend field that edits it (if any) and
// that field's own answer, which decides whether the row is missing: the
// location row shows the whole address but is missing only without a country.
function siteDetailRows(t, site, effective) {
  const label = (key) => manageSitesText(t, `rows.${key}`)
  const answer = (field, key) => {
    const value = displayValue(t, field, effective[field])
    return {
      id: EDITABLE_FIELDS[field].row,
      field,
      label: label(key),
      value,
      answer: value
    }
  }
  const fixed = (id, key, value) => ({
    id,
    field: null,
    label: label(key),
    value,
    answer: value
  })
  return [
    fixed('site-name', 'siteName', site.siteName),
    {
      ...answer('country', 'location'),
      // RA-697: an operator-entered ORS's siteAddress already ends with its
      // country, so use the /manage one-line address, with the request's
      // country, rather than appending a second one.
      value: orsAddressLine({ ...site, country: effective.country })
    },
    answer('coordinates', 'coordinates'),
    fixed('contact-name', 'contactName', site.contactName),
    fixed('contact-email', 'contactEmail', site.contactEmail),
    fixed('contact-phone', 'contactPhone', site.contactPhone),
    answer('operationCodes', 'recyclingOperation'),
    fixed(
      'basel-codes',
      'baselCodes',
      [site.code1, site.code2, site.code3].filter(Boolean).join(', ')
    ),
    fixed('repatriated-loads', 'repatriatedLoads', site.repatriatedLoads),
    answer('conditionsOfExport', 'conditionsOfExport')
  ]
}

const readOnlyRow = ({ id, label, value, answer }) => ({
  ...fixedRow(id, label, answer),
  value
})

/**
 * RA-697: the add-to-accreditation summary's site rows, with the request
 * site's effective answers, but never an action, for a read-only page. BES
 * evidence is left to the caller.
 */
export function buildSiteDetailRows({ t, entry, requestSite }) {
  return siteDetailRows(t, entry.site, requestSite.effective).map(readOnlyRow)
}

/**
 * Add to accreditation summary rows (f04/f09). "Add information" for a
 * field that has never been filled, "Change" for one the operator filled in
 * this request, and no action at all for a field already recorded on the
 * ORS (locked) or one the backend cannot change.
 */
export function buildSummaryRows({ t, applicationId, entry, requestSite }) {
  const locked = new Set(entry.lockedFields)
  const rows = siteDetailRows(t, entry.site, requestSite.effective).map(
    (row) =>
      row.field && !locked.has(row.field)
        ? {
            ...editableRow({
              t,
              applicationId,
              siteId: entry.siteId,
              field: row.field,
              label: row.label,
              value: row.answer
            }),
            value: row.value
          }
        : readOnlyRow(row)
  )
  const label = (key) => manageSitesText(t, `rows.${key}`)

  const files = requestSite.besEvidence?.besEvidenceUploads ?? []
  if (requestSite.besEvidenceRequired || files.length > 0) {
    rows.push({
      ...editableRow({
        t,
        applicationId,
        siteId: entry.siteId,
        field: 'besEvidence',
        label: label('besEvidence'),
        value: files.map((file) => file.filename).join(', ')
      }),
      // Each uploaded file can be removed, as on the reaccreditation
      // journey's evidence page.
      files: files.map((file) => ({
        fileId: file.fileId,
        filename: file.filename,
        deleteUrl: besEvidenceFileDeleteUrl(
          applicationId,
          entry.siteId,
          file.fileId
        )
      }))
    })
  }
  return rows
}

/**
 * AC02: the backend's missingFields for one request site, as error-summary
 * items pointing at the summary rows.
 */
export function buildMissingFieldErrors(t, requestSite) {
  return requestSite.missingFields
    .filter((field) => EDITABLE_FIELDS[field])
    .map((field) => ({
      row: EDITABLE_FIELDS[field].row,
      text: manageSitesText(t, `missing.${field}`)
    }))
}
