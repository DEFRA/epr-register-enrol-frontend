import {
  ITEM_STATUSES,
  ORS_ANSWER_FIELDS,
  SITE_ACCREDITATION_STATUSES,
  isOrsUpdate,
  orsUpdateDetailsOf
} from '../../../common/constants/changeRequests.js'
import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'
import { activeInterimSites } from '../../../common/helpers/interimSites.js'
import { requiresConditionsOfExport } from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { besEvidenceRequired } from '../../upload-evidence-for-overseas-site/controller.js'
import {
  findRequestSite,
  findSite,
  grantedBesUploads,
  siteDetailRows
} from '../view-model.js'
import {
  interimSiteAdditionUrl,
  interimSiteUrl,
  updateBesEvidenceFileDeleteUrl,
  updateBesEvidenceUrl,
  updateStepUrl
} from '../urls.js'
import { STEP_FOR_ROW } from './steps.js'

// RA-682: view models for changing an accredited ORS's details, built from
// the backend's AccreditationChangesView. An ORS in the draft as an
// update-overseas-site item shows its proposed details; otherwise its own.

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
  if (entry?.accreditationStatus !== SITE_ACCREDITATION_STATUSES.accredited) {
    return null
  }
  const item = findRequestSite(view, siteId)
  const inDraft = isOrsUpdate(item)
  return {
    entry,
    item: inDraft ? item : null,
    pending: entry.pendingRequestStatus === ITEM_STATUSES.submitted,
    details: inDraft ? item.proposed : orsUpdateDetailsOf(entry.site)
  }
}

const ROW_LABELS = {
  'site-name': 'rows.orsName',
  'recycling-operation': 'rows.recyclingOperations'
}

// Every address line and the town, so a change to any of them shows. An ORS
// with only a one-line siteAddress (which ends with its country) shows that
// until an address is proposed.
function locationValue(site) {
  return site.addressLine1
    ? formatSiteAddress(site)
    : (site.siteAddress ?? formatSiteAddress(site))
}

// RA-682: conditions of export apply to steel and aluminium only.
function shownRow(id, materialType) {
  return (
    id !== 'conditions-of-export' || requiresConditionsOfExport(materialType)
  )
}

/**
 * RA-682: BES evidence can't be amended, but new evidence can be uploaded. The
 * ORS's own files are shown and can't be removed; the update's can be.
 */
function besEvidenceRow({ t, applicationId, update }) {
  const { entry, item, pending } = update
  const { held, added } = grantedBesUploads(entry.site, item)
  const file =
    (deleteUrl) =>
    ({ fileId, filename }) => ({
      fileId,
      filename,
      deleteUrl: deleteUrl?.(fileId) ?? null
    })
  const files = [
    ...held.map(file(null)),
    ...added.map(
      file(
        pending
          ? null
          : (fileId) =>
              updateBesEvidenceFileDeleteUrl(
                applicationId,
                entry.siteId,
                fileId
              )
      )
    )
  ]
  return {
    id: 'bes-evidence',
    label: t('pages.manageOverseasSites.rows.besEvidence'),
    value: files.map(({ filename }) => filename).join(', '),
    files,
    action:
      pending || !besEvidenceRequired(entry.site)
        ? null
        : {
            href: updateBesEvidenceUrl(applicationId, entry.siteId),
            text: updateText(t, 'besEvidence.upload')
          }
  }
}

/**
 * The ORS's summary rows, as RA-492's summary builds them, with the update's
 * details in place of the ORS's own. Editable rows link to their step; a
 * pending ORS has no actions.
 */
export function buildDetailRows({ t, applicationId, update, materialType }) {
  const { entry, details, pending } = update
  const site = entry.site
  const shown = { ...site, ...details }
  const locked = Object.fromEntries(
    ORS_ANSWER_FIELDS.map((field) => [field, site[field]])
  )
  const rows = siteDetailRows(t, shown, locked)
    .filter(({ id }) => shownRow(id, materialType))
    .map(({ id, label, value }) => ({
      id,
      label: ROW_LABELS[id] ? updateText(t, ROW_LABELS[id]) : label,
      value: id === 'location' ? locationValue(shown) : value,
      action:
        STEP_FOR_ROW[id] && !pending
          ? {
              href: updateStepUrl(
                applicationId,
                entry.siteId,
                STEP_FOR_ROW[id]
              ),
              text: t('pages.manageOverseasSites.change')
            }
          : null
    }))
  return [...rows, besEvidenceRow({ t, applicationId, update })]
}

const INTERIM_TAGS = {
  change: { key: 'interim.changed', colour: 'blue' },
  add: { key: 'interim.new', colour: 'turquoise' },
  remove: { key: 'interim.toBeRemoved', colour: 'red' }
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
export function buildInterimRows({ t, applicationId, update }) {
  const { entry, item, pending } = update
  const tag = (state) =>
    INTERIM_TAGS[state]
      ? {
          text: updateText(t, INTERIM_TAGS[state].key),
          colour: INTERIM_TAGS[state].colour
        }
      : null
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
      tag: tag(state),
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
      tag: tag('add'),
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

export function interimAddition(update, changeId) {
  return update.item?.interimSiteChanges?.find(
    (c) => c.changeId === changeId && c.action === 'add'
  )
}
