import {
  addSiteToRequestUrl,
  addToAccreditationUrl,
  besEvidenceFileDeleteUrl,
  stepUrl
} from './urls.js'

// RA-492: view models for the in-year add-ORS pages, built from the
// backend's AccreditationChangesView (see service.js).

export const ACCREDITED = 'Accredited'
export const REGISTERED = 'Registered'
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

const hasValue = (value) =>
  Array.isArray(value) ? value.length > 0 : value != null && value !== ''

const t2 = (t, key) => t(`pages.manageOverseasSites.${key}`)

export function siteAddressLine(site) {
  const address =
    typeof site?.siteAddress === 'string'
      ? site.siteAddress
      : [site?.addressLine1, site?.addressLine2, site?.townOrCity]
          .filter(Boolean)
          .join(', ')
  return [address, site?.country].filter(Boolean).join(', ')
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
 * Manage overseas reprocessing sites (f02/f03/f12/f13). A site whose add
 * request has been submitted moves to the Accredited tab with a Pending tag
 * (AC08) and loses its actions (AC09); one in the draft shows In progress.
 */
export function buildManageViewModel(view, applicationId) {
  const toRow = (entry) => ({
    orsId: entry.orsId,
    addUrl: addSiteToRequestUrl(applicationId, entry.siteId),
    viewUrl: addToAccreditationUrl(applicationId, entry.siteId),
    siteName: entry.site.siteName,
    address: siteAddressLine(entry.site),
    pending: entry.pendingRequestStatus === SUBMITTED,
    inProgress: entry.pendingRequestStatus === IN_PROGRESS
  })
  const sites = view.sites
  const accredited = sites
    .filter(
      (entry) =>
        entry.accreditationStatus === ACCREDITED ||
        entry.pendingRequestStatus === SUBMITTED
    )
    .map(toRow)
  const registered = sites
    .filter(
      (entry) =>
        entry.accreditationStatus === REGISTERED &&
        entry.pendingRequestStatus !== SUBMITTED
    )
    .map(toRow)
  return {
    accredited,
    registered,
    readyForSubmissionCount: view.activeRequest?.sites?.length ?? 0,
    pendingCount: accredited.filter((row) => row.pending).length
  }
}

function displayValue(t, field, value) {
  if (!hasValue(value)) {
    return ''
  }
  if (field === 'conditionsOfExport') {
    return t2(t, value ? 'yes' : 'no')
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
      text: t2(t, hasValue(value) ? 'change' : 'addInformation')
    }
  }
}

/**
 * Add to accreditation summary rows (f04/f09). "Add information" for a
 * field that has never been filled, "Change" for one the operator filled in
 * this request, and no action at all for a field already recorded on the
 * ORS (locked) or one the backend cannot change.
 */
export function buildSummaryRows({ t, applicationId, entry, requestSite }) {
  const site = entry.site
  // The backend's effective value: the ORS's own, or the operator's answer.
  const effective = requestSite.effective
  const locked = new Set(entry.lockedFields)
  const lockable = (field, rowLabel) => {
    const value = displayValue(t, field, effective[field])
    if (locked.has(field)) {
      return fixedRow(EDITABLE_FIELDS[field].row, rowLabel, value)
    }
    return editableRow({
      t,
      applicationId,
      siteId: entry.siteId,
      field,
      label: rowLabel,
      value
    })
  }
  const label = (key) => t2(t, `rows.${key}`)
  const rows = [
    fixedRow('site-name', label('siteName'), site.siteName),
    {
      ...lockable('country', label('location')),
      value: siteAddressLine({ ...site, country: effective.country })
    },
    lockable('coordinates', label('coordinates')),
    fixedRow('contact-name', label('contactName'), site.contactName),
    fixedRow('contact-email', label('contactEmail'), site.contactEmail),
    fixedRow('contact-phone', label('contactPhone'), site.contactPhone),
    lockable('operationCodes', label('recyclingOperation')),
    fixedRow(
      'basel-codes',
      label('baselCodes'),
      [site.code1, site.code2, site.code3].filter(Boolean).join(', ')
    ),
    fixedRow(
      'repatriated-loads',
      label('repatriatedLoads'),
      site.repatriatedLoads
    ),
    lockable('conditionsOfExport', label('conditionsOfExport'))
  ]
  // The location row is only "missing" when the country is.
  rows[1].missing = !hasValue(effective.country)

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
      text: t2(t, `missing.${field}`)
    }))
}
