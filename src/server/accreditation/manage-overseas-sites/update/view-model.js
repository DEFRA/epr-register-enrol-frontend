import {
  CHANGE_TYPES,
  ITEM_STATUSES,
  SITE_ACCREDITATION_STATUSES,
  orsUpdateDetailsOf
} from '../../../common/constants/changeRequests.js'
import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'
import { activeInterimSites } from '../../../common/helpers/interimSites.js'
import { findRequestSite, findSite, siteDetailRows } from '../view-model.js'
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

/**
 * The accredited ORS and where it stands: in the draft as an update (its
 * proposed details apply), held by a submitted request (AC03: read only), or
 * free to change. Null when the site is not an accredited ORS of this
 * accreditation.
 */
export function resolveUpdate(view, siteId) {
  const entry = findSite(view, siteId)
  if (
    !entry ||
    entry.accreditationStatus !== SITE_ACCREDITATION_STATUSES.accredited
  ) {
    return null
  }
  const item = findRequestSite(view, siteId)
  const inDraft = item?.changeType === CHANGE_TYPES.updateOverseasSite
  return {
    entry,
    item: inDraft ? item : null,
    pending: entry.pendingRequestStatus === ITEM_STATUSES.submitted,
    details: inDraft ? item.proposed : orsUpdateDetailsOf(entry.site)
  }
}

// The update step that changes each of siteDetailRows' rows. The rest are
// locked (AC02) and have no action.
const ROW_STEPS = {
  'site-name': 'site-name',
  location: 'location',
  'contact-name': 'contact-details',
  'contact-email': 'contact-details',
  'contact-phone': 'contact-details',
  'repatriated-loads': 'rejected-loads'
}

const ROW_LABELS = {
  'site-name': 'rows.orsName',
  'recycling-operation': 'rows.recyclingOperations'
}

const LOCKED_ANSWERS = [
  'country',
  'coordinates',
  'operationCodes',
  'conditionsOfExport'
]

// Every address line and the town, so a change to any of them shows. An ORS
// with only a one-line siteAddress (which ends with its country) shows that
// until an address is proposed.
function locationValue(site) {
  return site.addressLine1
    ? formatSiteAddress(site)
    : (site.siteAddress ?? formatSiteAddress(site))
}

/**
 * The ORS's summary rows, as RA-492's summary builds them, with the update's
 * details in place of the ORS's own. Editable rows link to their step; a
 * pending ORS has no actions.
 */
export function buildDetailRows({ t, applicationId, update }) {
  const { entry, details, pending } = update
  const site = entry.site
  const shown = { ...site, ...details }
  const locked = Object.fromEntries(
    LOCKED_ANSWERS.map((field) => [field, site[field]])
  )
  const rows = siteDetailRows(t, shown, locked).map(({ id, label, value }) => ({
    id,
    label: ROW_LABELS[id] ? updateText(t, ROW_LABELS[id]) : label,
    value: id === 'location' ? locationValue(shown) : value,
    action:
      ROW_STEPS[id] && !pending
        ? {
            href: updateStepUrl(applicationId, entry.siteId, ROW_STEPS[id]),
            text: t('pages.manageOverseasSites.change')
          }
        : null
  }))
  const besFiles = site.besEvidence?.besEvidenceUploads ?? []
  return [
    ...rows,
    {
      id: 'bes-evidence',
      label: t('pages.manageOverseasSites.rows.besEvidence'),
      value: besFiles.map((file) => file.filename).join(', '),
      action: null
    }
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
