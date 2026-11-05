import {
  addSiteToRequestUrl,
  addToAccreditationUrl,
  besEvidenceFileDeleteUrl,
  stepUrl
} from './urls.js'

// RA-492: view models for the in-year add-ORS pages, built from the
// backend's AccreditationChangesView (see service.js).

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
 */
export function registeredSiteActions(applicationId, siteId, status) {
  return {
    pending: status === SUBMITTED,
    inProgress: status === IN_PROGRESS,
    addUrl: addSiteToRequestUrl(applicationId, siteId),
    viewUrl: addToAccreditationUrl(applicationId, siteId)
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
