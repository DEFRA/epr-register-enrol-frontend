import {
  CHANGE_TYPES,
  ITEM_STATUSES
} from '../../../common/constants/changeRequests.js'
import { activeInterimSites } from '../../../common/helpers/interimSites.js'
import { hasValue } from '../../../common/helpers/hasValue.js'
import { orsAddressLine } from '../../../common/helpers/orsAddress.js'
import { findRequestSite, findSite } from '../view-model.js'
import {
  interimSiteAdditionUrl,
  interimSiteUrl,
  updateStepUrl
} from '../urls.js'

// RA-682: view models for changing an accredited ORS's details, built from
// the backend's AccreditationChangesView. An ORS in the draft as an
// update-overseas-site item shows its proposed details; otherwise its own.

/** A translation from this journey's `pages.updateOverseasSite` keys. */
export function updateText(t, key, params) {
  return t(`pages.updateOverseasSite.${key}`, params)
}

// The details an operator may change (AC02), as the backend's
// OverseasSiteDetails holds them.
export const DETAIL_FIELDS = [
  'siteName',
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'contactName',
  'contactEmail',
  'contactPhone',
  'repatriatedLoads'
]

export function detailsOf(site) {
  return Object.fromEntries(
    DETAIL_FIELDS.map((field) => [field, site?.[field] ?? null])
  )
}

/**
 * The accredited ORS and where it stands: in the draft as an update (its
 * proposed details apply), held by a submitted request (AC03: read only), or
 * free to change. Null when the site is not an accredited ORS of this
 * accreditation.
 */
export function resolveUpdate(view, siteId) {
  const entry = findSite(view, siteId)
  if (!entry || entry.accreditationStatus !== 'Accredited') {
    return null
  }
  const item = findRequestSite(view, siteId)
  const inDraft = item?.changeType === CHANGE_TYPES.updateOverseasSite
  return {
    entry,
    item: inDraft ? item : null,
    pending: entry.pendingRequestStatus === ITEM_STATUSES.submitted,
    details: inDraft ? item.proposed : detailsOf(entry.site)
  }
}

function row(id, label, value, href, t) {
  return {
    id,
    label,
    value: hasValue(value) ? value : '',
    action: href ? { href, text: t('pages.manageOverseasSites.change') } : null
  }
}

/**
 * The ORS's summary rows. Editable rows link to the step that changes them;
 * the locked ones (AC02: country, coordinates, recycling operations, Basel
 * codes, conditions of export, BES) have no action. A pending ORS has none.
 */
export function buildDetailRows({ t, applicationId, update }) {
  const { entry, details, pending } = update
  const site = entry.site
  const label = (key) => t(`pages.manageOverseasSites.rows.${key}`)
  const step = (name) =>
    pending ? null : updateStepUrl(applicationId, entry.siteId, name)
  const besFiles = site.besEvidence?.besEvidenceUploads ?? []
  return [
    row(
      'site-name',
      updateText(t, 'rows.orsName'),
      details.siteName,
      step('site-name'),
      t
    ),
    row(
      'location',
      label('location'),
      orsAddressLine({ ...site, ...details, siteAddress: null }),
      step('location'),
      t
    ),
    row('coordinates', label('coordinates'), site.coordinates, null, t),
    row(
      'contact-name',
      label('contactName'),
      details.contactName,
      step('contact-details'),
      t
    ),
    row(
      'contact-email',
      label('contactEmail'),
      details.contactEmail,
      step('contact-details'),
      t
    ),
    row(
      'contact-phone',
      label('contactPhone'),
      details.contactPhone,
      step('contact-details'),
      t
    ),
    row(
      'recycling-operations',
      updateText(t, 'rows.recyclingOperations'),
      (site.operationCodes ?? []).join(', '),
      null,
      t
    ),
    row(
      'basel-codes',
      label('baselCodes'),
      [site.code1, site.code2, site.code3].filter(Boolean).join(', '),
      null,
      t
    ),
    row(
      'repatriated-loads',
      label('repatriatedLoads'),
      details.repatriatedLoads,
      step('rejected-loads'),
      t
    ),
    row(
      'conditions-of-export',
      label('conditionsOfExport'),
      hasValue(site.conditionsOfExport)
        ? t(site.conditionsOfExport ? 'common.yes' : 'common.no')
        : '',
      null,
      t
    ),
    row(
      'bes-evidence',
      label('besEvidence'),
      besFiles.map((file) => file.filename).join(', '),
      null,
      t
    )
  ]
}

function interimLine(details) {
  return [details.siteName, details.country, ...(details.operationCodes ?? [])]
    .filter(Boolean)
    .join(', ')
}

/**
 * AC04: the ORS's interim sites as the update would leave them: each active
 * one, changed or marked for removal, then the ones being added. Each says
 * what the operator can do with it, none when the ORS is pending.
 */
export function buildInterimRows({ applicationId, update }) {
  const { entry, item, pending } = update
  const siteId = entry.siteId
  const changes = item?.interimSiteChanges ?? []
  const changeFor = (interimSiteId) =>
    changes.find((c) => String(c.interimSiteId) === String(interimSiteId))
  const existing = activeInterimSites(entry.site).map((interim) => {
    const change = changeFor(interim.siteId)
    const state = change?.action ?? 'unchanged'
    return {
      key: `interim-${interim.siteId}`,
      line: interimLine(change?.proposed ?? interim),
      state,
      changeUrl:
        pending || state === 'remove'
          ? null
          : interimSiteUrl(applicationId, siteId, interim.siteId),
      removeUrl:
        pending || state === 'remove'
          ? null
          : `${interimSiteUrl(applicationId, siteId, interim.siteId)}/remove`,
      undoUrl:
        pending || !change
          ? null
          : `${interimSiteAdditionUrl(applicationId, siteId, change.changeId)}/undo`
    }
  })
  const added = changes
    .filter((change) => change.action === 'add')
    .map((change) => ({
      key: `interim-new-${change.changeId}`,
      line: interimLine(change.proposed),
      state: 'add',
      changeUrl: pending
        ? null
        : interimSiteAdditionUrl(applicationId, siteId, change.changeId),
      removeUrl: null,
      undoUrl: pending
        ? null
        : `${interimSiteAdditionUrl(applicationId, siteId, change.changeId)}/undo`
    }))
  return [...existing, ...added]
}

/** The interim site being changed, as the update would leave it. */
export function interimFields(update, interimSiteId) {
  const interim = activeInterimSites(update.entry.site).find(
    (site) => String(site.siteId) === String(interimSiteId)
  )
  if (!interim) {
    return null
  }
  const change = update.item?.interimSiteChanges?.find(
    (c) => String(c.interimSiteId) === String(interimSiteId)
  )
  return change?.action === 'change' ? change.proposed : interim
}

/** A pending interim site addition, by its change id. */
export function interimAddition(update, changeId) {
  return update.item?.interimSiteChanges?.find(
    (c) => c.changeId === changeId && c.action === 'add'
  )
}
