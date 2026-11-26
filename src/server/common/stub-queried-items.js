// RA-698: API_STUB_ENABLED stand-in for the backend's response to a query on
// an in-year change request item (QueriedItemEndpoints). A queried item sits
// in a submitted request, so these calls are keyed by the item, and are
// allowed only while it is Queried.

import { ITEM_STATUSES } from './constants/changeRequests.js'
import { statusCodes } from './constants/status-codes.js'
import { activeInterimSites } from './helpers/interimSites.js'

const ORS_EDITABLE = [
  'siteName',
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'stateOrRegion',
  'postcode',
  'contactName',
  'contactEmail',
  'contactPhone',
  'rejectedLoadsArrangements',
  'besEvidence'
]
const ORS_LOCKED = [
  'country',
  'coordinates',
  'operationCodes',
  'baselCodes',
  'conditionsOfExport'
]
const INTERIM_EDITABLE = ORS_EDITABLE.filter(
  (field) => !['rejectedLoadsArrangements', 'besEvidence'].includes(field)
)
const INTERIM_LOCKED = ['country', 'operationCodes', 'rejectedLoadsArrangements']
const ORS_REQUIRED = [
  'siteName',
  'addressLine1',
  'townOrCity',
  'contactName',
  'contactEmail',
  'contactPhone',
  'rejectedLoadsArrangements'
]
// The ORS record's name for a field, where it differs.
const SITE_FIELD = { rejectedLoadsArrangements: 'repatriatedLoads' }

const answerFields = ORS_EDITABLE.filter((field) => field !== 'besEvidence')

export const isQueried = (entry) => entry.status === ITEM_STATUSES.queried

/** The item's own answers over the ORS's values, for the view's `effective`. */
export function queriedEffective(site, entry) {
  return Object.fromEntries(
    answerFields.map((field) => [
      field,
      entry.answers[field] ?? site[SITE_FIELD[field] ?? field] ?? null
    ])
  )
}

function interimView(entry, interim) {
  const answers =
    entry.answers.interimSites?.find((a) => a.siteId === interim.siteId) ?? {}
  const open = isQueried(entry)
  return {
    siteId: interim.siteId,
    siteNumber: interim.siteNumber,
    country: interim.country,
    operationCodes: interim.operationCodes ?? [],
    values: Object.fromEntries(
      INTERIM_EDITABLE.map((field) => [
        field,
        answers[field] ?? interim[field] ?? null
      ])
    ),
    editableFields: open ? INTERIM_EDITABLE : [],
    lockedFields: open ? INTERIM_LOCKED : []
  }
}

/** The view's `query`: null until the item has been queried. */
export function queryView(site, entry) {
  if (!entry.query) {
    return null
  }
  const open = isQueried(entry)
  return {
    queryNote: entry.query.queryNote,
    raisedAt: entry.query.raisedAt ?? null,
    querySubmissions: entry.query.querySubmissions ?? [],
    editableFields: open ? ORS_EDITABLE : [],
    lockedFields: open ? ORS_LOCKED : [],
    preQueryBesFileIds: entry.query.preQueryBesFileIds ?? [],
    interimSites: open
      ? activeInterimSites(site).map((interim) => interimView(entry, interim))
      : []
  }
}

function stubError(status, message, response) {
  return Object.assign(new Error(message), { status, response })
}

function refuse(status, errors) {
  throw stubError(status, 'Validation failed', JSON.stringify({ errors }))
}

function queriedItem(ctx, itemId) {
  const entry = ctx.store.submitted
    .flatMap((request) => request.sites)
    .find((item) => item.itemId === itemId)
  if (!entry) {
    throw stubError(statusCodes.notFound, 'Item not found')
  }
  if (!isQueried(entry) || !entry.query) {
    throw stubError(statusCodes.conflict, 'Item has not been queried')
  }
  return entry
}

// Applies the body's editable fields to `answers`: 422 for a locked field,
// 400 for a blank required one.
function applyAnswers(answers, body, { editable, locked }) {
  const supplied = Object.entries(body ?? {}).filter(
    ([, value]) => value != null
  )
  const lockedHits = supplied.filter(([field]) => locked.includes(field))
  if (lockedHits.length > 0) {
    refuse(
      statusCodes.unprocessableEntity,
      Object.fromEntries(
        lockedHits.map(([field]) => [
          field,
          [`${field} cannot be changed in response to a query.`]
        ])
      )
    )
  }
  const blank = supplied.filter(
    ([field, value]) => ORS_REQUIRED.includes(field) && !String(value).trim()
  )
  if (blank.length > 0) {
    refuse(
      statusCodes.badRequest,
      Object.fromEntries(
        blank.map(([field]) => [field, [`${field} is required.`]])
      )
    )
  }
  for (const [field, value] of supplied) {
    if (editable.includes(field)) {
      answers[field] = String(value).trim()
    }
  }
}

const latest = (ctx) => ctx.view().requests[0]

function patchItemAnswers(ctx, itemId) {
  const entry = queriedItem(ctx, itemId)
  applyAnswers(entry.answers, ctx.body, {
    editable: ORS_EDITABLE,
    locked: ORS_LOCKED
  })
  return latest(ctx)
}

function patchItemInterimSite(ctx, itemId, interimSiteId) {
  const entry = queriedItem(ctx, itemId)
  const site = ctx.application.overseasSites.sites.find(
    (candidate) => candidate.siteId === entry.siteId
  )
  const interim = activeInterimSites(site).find(
    (candidate) => candidate.siteId === Number(interimSiteId)
  )
  if (!interim) {
    refuse(statusCodes.unprocessableEntity, {
      interimSiteId: [
        'This is not an active interim site of the queried overseas site.'
      ]
    })
  }
  entry.answers.interimSites ??= []
  let answers = entry.answers.interimSites.find(
    (candidate) => candidate.siteId === interim.siteId
  )
  if (!answers) {
    answers = { siteId: interim.siteId }
    entry.answers.interimSites.push(answers)
  }
  applyAnswers(answers, ctx.body, {
    editable: INTERIM_EDITABLE,
    locked: INTERIM_LOCKED
  })
  return latest(ctx)
}

async function addItemBesFile(ctx, itemId) {
  const entry = queriedItem(ctx, itemId)
  const status = await ctx.deps.getUploadStatus(
    ctx.orgId,
    ctx.appId,
    ctx.body.fileUploadId
  )
  entry.besEvidenceUploads.push({
    fileId: ctx.body.fileUploadId,
    filename: status.form.file.filename,
    scanStatus: 'Clean',
    besEvidenceValidFromDate: ctx.body.besEvidenceValidFromDate ?? null,
    besEvidenceExpiryDate: ctx.body.besEvidenceExpiryDate ?? null
  })
  return latest(ctx)
}

function deleteItemBesFile(ctx, itemId, fileId) {
  const entry = queriedItem(ctx, itemId)
  if (entry.query.preQueryBesFileIds?.includes(fileId)) {
    throw stubError(
      statusCodes.unprocessableEntity,
      'A file uploaded before the query cannot be removed.'
    )
  }
  const remaining = entry.besEvidenceUploads.filter(
    (file) => file.fileId !== fileId
  )
  if (remaining.length === entry.besEvidenceUploads.length) {
    throw stubError(statusCodes.notFound, 'File not found')
  }
  entry.besEvidenceUploads = remaining
  return latest(ctx)
}

function resubmitItem(ctx, itemId) {
  const entry = queriedItem(ctx, itemId)
  const changed = Object.keys(entry.answers).filter(
    (field) => answerFields.includes(field) || field === 'interimSites'
  )
  const added = entry.besEvidenceUploads.filter(
    (file) => !entry.query.preQueryBesFileIds?.includes(file.fileId)
  )
  if (changed.length === 0 && added.length === 0) {
    refuse(statusCodes.unprocessableEntity, {
      changes: [
        'Change at least one field or upload a BES file before you resubmit.'
      ]
    })
  }
  entry.query.querySubmissions = [
    ...(entry.query.querySubmissions ?? []),
    {
      submittedAt: new Date().toISOString(),
      fullName: ctx.body.fullName,
      jobTitle: ctx.body.jobTitle,
      changedFields: changed,
      newBesFileIds: added.map((file) => file.fileId)
    }
  ]
  entry.status = ITEM_STATUSES.updated
  return latest(ctx)
}

const ITEM_PATH = '/items/([^/]+)'

// [method, path, handler(ctx, ...captures)], for the stub's route table.
export const QUERIED_ITEM_ROUTES = [
  ['patch', `${ITEM_PATH}/answers`, patchItemAnswers],
  ['patch', `${ITEM_PATH}/interim-sites/(\\d+)/answers`, patchItemInterimSite],
  [
    'post',
    `${ITEM_PATH}/bes-evidence/initiate`,
    (ctx, itemId) => {
      queriedItem(ctx, itemId)
      return ctx.deps.initiateUpload(ctx.orgId, ctx.appId, ctx.body)
    }
  ],
  ['post', `${ITEM_PATH}/bes-evidence/files`, addItemBesFile],
  ['delete', `${ITEM_PATH}/bes-evidence/files/([^/]+)`, deleteItemBesFile],
  ['post', `${ITEM_PATH}/resubmit`, resubmitItem]
]
