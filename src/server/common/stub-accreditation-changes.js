// RA-492: API_STUB_ENABLED stand-in for the backend's accreditation-changes
// API (in-year requests to add registered ORSs to a granted accreditation),
// following the backend contract: one InProgress draft per approved
// application holding many sites, Submitted on declaration, charged the ORS
// fee per site.
// Sites come from the stub application itself, so any Approved exporter in
// the stub org docs (org 50019 is seeded for it) can be used locally.
// RA-697: each site on a request is an item with its own id, type and
// status; a tonnage band upgrade request has one tonnageBandUpgrade item and
// no sites. A site is pending only while an item for it is active, and a
// granted reprocessor's view lists its requests but no sites. Org 50018's
// accreditations start with the backend dev seed's requests
// (stub-change-request-seed.js).
// RA-697: a registration-only operator's view is read by organisation,
// registration and material (GET only), with the registration's ORSs as
// Registered sites; org 50021 starts with the backend dev seed's requests.

import { randomUUID } from 'node:crypto'

import {
  ACTIVE_ITEM_STATUSES,
  CHANGE_TYPES
} from './constants/changeRequests.js'
import { statusCodes } from './constants/status-codes.js'
import { currentYear } from './helpers/currentYear.js'
import { hasValue } from './helpers/hasValue.js'
import { ORS_FEE, PENCE_PER_POUND } from './helpers/paymentDetails.js'
import {
  seededStubChangeRequests,
  seededStubRegistrationChangeRequests
} from './stub-change-request-seed.js'

const REGISTRATION_RE =
  /^\/api\/v1\/accreditation-changes\/([^/]+)\/registrations\/([^/]+)\/([^/]+)(\/.*)?$/
const CHANGES_RE = /^\/api\/v1\/accreditation-changes\/([^/]+)\/([^/]+)(\/.*)?$/
const LOCKABLE = [
  'country',
  'coordinates',
  'operationCodes',
  'conditionsOfExport'
]
const CHARGE_PER_SITE_PENCE = ORS_FEE * PENCE_PER_POUND

const state = new Map()

function stubError(status, message, response) {
  return Object.assign(new Error(message), { status, response })
}

function stateFor(key, initialRequests = () => []) {
  if (!state.has(key)) {
    const store = { draft: null, submitted: [] }
    for (const request of initialRequests()) {
      storeRequest(store, request)
    }
    state.set(key, store)
  }
  return state.get(key)
}

function newItem(changeType, item = {}) {
  return {
    itemId: randomUUID(),
    changeType,
    status: 'InProgress',
    validFrom: null,
    withdrawnAt: null,
    ...item
  }
}

function newSiteItem(entry) {
  return {
    ...newItem(CHANGE_TYPES.addOverseasSite, entry),
    answers: entry.answers ?? {},
    besEvidenceUploads: entry.besEvidenceUploads ?? []
  }
}

function setItemStatuses(request, status) {
  for (const item of [...request.sites, request.tonnageBandUpgrade]) {
    if (item) {
      item.status = status
    }
  }
}

function storeRequest(store, request) {
  const now = new Date().toISOString()
  const seeded = {
    changeType: CHANGE_TYPES.addOverseasSite,
    createdAt: now,
    updatedAt: request.createdAt ?? now,
    submittedAt: null,
    submittedBy: null,
    caseManagementReference: null,
    ...request,
    sites: (request.sites ?? []).map(newSiteItem),
    tonnageBandUpgrade: request.tonnageBandUpgrade
      ? newItem(CHANGE_TYPES.upgradeTonnageBand, request.tonnageBandUpgrade)
      : null
  }
  if (seeded.status === 'InProgress') {
    store.draft = seeded
  } else {
    store.submitted.push(seeded)
  }
}

/**
 * Stores a change request for `${orgId}/${appId}` as the backend's seed
 * would: a Submitted (or later) request, or the one InProgress draft.
 */
export function seedStubChangeRequest(key, request) {
  storeRequest(stateFor(key), request)
}

function besRequired(site, effective) {
  return !site.isEu && !site.isOecd && effective.conditionsOfExport !== true
}

function requestSiteView(site, entry) {
  const effective = Object.fromEntries(
    LOCKABLE.map((field) => [
      field,
      entry.answers[field] ?? site[field] ?? null
    ])
  )
  const required = besRequired(site, effective)
  const missingFields = LOCKABLE.filter((field) => !hasValue(effective[field]))
  if (required && entry.besEvidenceUploads.length === 0) {
    missingFields.push('besEvidence')
  }
  return {
    siteId: site.siteId,
    orsId: site.orsId,
    siteName: site.siteName,
    answers: entry.answers,
    effective,
    besEvidenceRequired: required,
    besEvidence: { besEvidenceUploads: entry.besEvidenceUploads },
    missingFields,
    isComplete: missingFields.length === 0,
    itemId: entry.itemId,
    changeType: entry.changeType,
    status: entry.status,
    validFrom: entry.validFrom,
    withdrawnAt: entry.withdrawnAt
  }
}

function requestView(request, sitesById) {
  const sites = request.sites.map((entry) =>
    requestSiteView(sitesById.get(entry.siteId), entry)
  )
  return {
    requestId: request.requestId,
    changeType: request.changeType,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    submittedAt: request.submittedAt ?? null,
    submittedBy: request.submittedBy ?? null,
    caseManagementReference: request.caseManagementReference ?? null,
    sites,
    isComplete: sites.length > 0 && sites.every((site) => site.isComplete),
    charge: {
      chargeableSites: sites.length,
      chargePerSitePence: CHARGE_PER_SITE_PENCE,
      totalPence: sites.length * CHARGE_PER_SITE_PENCE
    },
    tonnageBandUpgrade: request.tonnageBandUpgrade ?? null
  }
}

const isActive = (item) => ACTIVE_ITEM_STATUSES.has(item.status)

function buildView(orgId, appId, application, store) {
  const sites = application.isExporter
    ? (application.overseasSites?.sites ?? [])
    : []
  const sitesById = new Map(sites.map((site) => [site.siteId, site]))
  const requests = [store.draft, ...store.submitted]
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const activeSiteItems = requests.flatMap((request) =>
    request.sites
      .filter(isActive)
      .map((item) => ({ request, siteId: item.siteId }))
  )
  const siteView = (site) => {
    const pending = activeSiteItems.find(
      (item) => item.siteId === site.siteId
    )?.request
    return {
      siteId: site.siteId,
      orsId: site.orsId,
      accreditationStatus:
        site.selected === false ? 'Registered' : 'Accredited',
      pendingRequestId: pending?.requestId ?? null,
      pendingRequestStatus: pending?.status ?? null,
      lockedFields: LOCKABLE.filter((field) => hasValue(site[field])),
      site
    }
  }
  return {
    organisationId: orgId,
    applicationId: appId,
    organisationName: application.organisationName ?? null,
    registrationId: application.registrationId,
    materialType: application.materialType,
    year: application.year,
    accreditationReference: application.accreditationReference ?? null,
    registrationReference: application.registrationReference ?? null,
    sites: sites.map(siteView),
    activeRequest: store.draft ? requestView(store.draft, sitesById) : null,
    requests: requests.map((r) => requestView(r, sitesById)),
    pendingOrsIds: [
      ...new Set(
        activeSiteItems
          .map((item) => sitesById.get(item.siteId)?.orsId)
          .filter(Boolean)
      )
    ]
  }
}

function siteOf(ctx, siteId) {
  return ctx.application.overseasSites.sites.find(
    (site) => site.siteId === Number(siteId)
  )
}

function draftSite(ctx, siteId) {
  const entry = ctx.store.draft?.sites.find(
    (site) => site.siteId === Number(siteId)
  )
  if (!entry) {
    throw stubError(statusCodes.notFound, 'Site not in the draft')
  }
  return entry
}

const currentRequest = (ctx) => ctx.view().activeRequest

function addSite(ctx) {
  const target = siteOf(ctx, ctx.body?.siteId)
  if (!target) {
    throw stubError(statusCodes.notFound, 'Site not found')
  }
  const listed = ctx.view().sites.find((s) => s.siteId === target.siteId)
  const awaitingDecision = ctx.store.submitted.some((request) =>
    request.sites.some(
      (item) => item.siteId === target.siteId && isActive(item)
    )
  )
  if (listed.accreditationStatus === 'Accredited' || awaitingDecision) {
    throw stubError(statusCodes.conflict, 'Site cannot be added')
  }
  if (!ctx.store.draft) {
    storeRequest(ctx.store, {
      requestId: `stub-request-${Date.now()}`,
      status: 'InProgress'
    })
  }
  if (!ctx.store.draft.sites.some((s) => s.siteId === target.siteId)) {
    ctx.store.draft.sites.push(newSiteItem({ siteId: target.siteId }))
  }
  return currentRequest(ctx)
}

function removeSite(ctx, siteId) {
  draftSite(ctx, siteId)
  ctx.store.draft.sites = ctx.store.draft.sites.filter(
    (s) => s.siteId !== Number(siteId)
  )
  if (ctx.store.draft.sites.length === 0) {
    ctx.store.draft = null
  }
  return currentRequest(ctx)
}

function patchSite(ctx, siteId) {
  const entry = draftSite(ctx, siteId)
  const site = siteOf(ctx, entry.siteId)
  const locked = new Set(LOCKABLE.filter((field) => hasValue(site[field])))
  const answers = Object.entries(ctx.body ?? {}).filter(
    ([field, value]) => LOCKABLE.includes(field) && value != null
  )
  const errors = Object.fromEntries(
    answers
      .filter(([field]) => locked.has(field))
      .map(([field]) => [field, [`${field} is already recorded on the ORS`]])
  )
  if (Object.keys(errors).length > 0) {
    throw stubError(statusCodes.badRequest, 'Validation failed', { errors })
  }
  Object.assign(entry.answers, Object.fromEntries(answers))
  return currentRequest(ctx)
}

async function addBesEvidenceFile(ctx, siteId) {
  const entry = draftSite(ctx, siteId)
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
  return currentRequest(ctx)
}

function deleteBesEvidenceFile(ctx, siteId, fileId) {
  const entry = draftSite(ctx, siteId)
  const remaining = entry.besEvidenceUploads.filter(
    (file) => file.fileId !== fileId
  )
  if (remaining.length === entry.besEvidenceUploads.length) {
    throw stubError(statusCodes.notFound, 'File not found')
  }
  entry.besEvidenceUploads = remaining
  return currentRequest(ctx)
}

function submit(ctx) {
  const { store } = ctx
  if (!store.draft) {
    throw stubError(statusCodes.notFound, 'No draft')
  }
  if (!currentRequest(ctx).isComplete) {
    throw stubError(statusCodes.unprocessableEntity, 'Incomplete')
  }
  store.draft.status = 'Submitted'
  setItemStatuses(store.draft, 'Submitted')
  store.draft.submittedAt = new Date().toISOString()
  store.draft.submittedBy = {
    fullName: ctx.body.fullName,
    jobTitle: ctx.body.jobTitle,
    email: ctx.body.email ?? null
  }
  store.draft.paymentReference = ctx.body.paymentReference ?? null
  store.submitted.push(store.draft)
  store.draft = null
  return ctx.view().requests[0]
}

const SITE_PATH = String.raw`/requests/current/sites/(\d+)`

const ROUTES = [
  ['get', '', (ctx) => ctx.view()],
  ['post', '/requests/current/sites', addSite],
  ['delete', SITE_PATH, removeSite],
  ['patch', SITE_PATH, patchSite],
  [
    'post',
    '/requests/current/bes-evidence/initiate',
    (ctx) => ctx.deps.initiateUpload(ctx.orgId, ctx.appId, ctx.body)
  ],
  ['post', `${SITE_PATH}/bes-evidence/files`, addBesEvidenceFile],
  ['delete', `${SITE_PATH}/bes-evidence/files/([^/]+)`, deleteBesEvidenceFile],
  ['post', '/requests/current/submit', submit]
].map(([method, path, handle]) => ({
  method,
  pattern: new RegExp(`^${path}$`),
  handle
}))

async function grantedApplication(deps, orgId, appId, method) {
  const application = await deps.getApplication(orgId, appId)
  if (!application) {
    throw stubError(statusCodes.notFound, 'Application not found')
  }
  if (application.applicationStatus !== 'Approved') {
    throw stubError(
      statusCodes.conflict,
      'Application is not a granted accreditation'
    )
  }
  if (method !== 'get' && !application.isExporter) {
    throw stubError(
      statusCodes.conflict,
      'Application is not a granted exporter accreditation'
    )
  }
  return application
}

async function registrationChanges(method, endpoint, deps) {
  const [, orgId, registrationId, material, rest = ''] =
    REGISTRATION_RE.exec(endpoint)
  if (method !== 'get' || rest !== '') {
    throw stubError(
      statusCodes.notFound,
      `No stub for ${method.toUpperCase()} ${endpoint}`
    )
  }
  const registration = await deps.getRegistration(orgId, registrationId)
  if (
    !registration ||
    registration.materialType.toLowerCase() !== material.toLowerCase()
  ) {
    throw stubError(statusCodes.notFound, 'Registration not found')
  }
  if (registration.status !== 'Approved') {
    throw stubError(statusCodes.conflict, 'Registration is not Approved')
  }
  const year = currentYear()
  const sites = registration.isExporter ? registration.sites : []
  const store = stateFor(
    `${orgId}/registrations/${registrationId}/${registration.materialType}/${year}`,
    () =>
      seededStubRegistrationChangeRequests(orgId, registrationId, sites, year)
  )
  return buildView(
    orgId,
    null,
    {
      isExporter: registration.isExporter,
      overseasSites: { sites },
      organisationName: registration.organisationName,
      registrationId,
      registrationReference: registration.registrationNumber,
      materialType: registration.materialType,
      year
    },
    store
  )
}

/**
 * Handles one accreditation-changes call.
 *
 * @param {object} deps - { getApplication(orgId, appId) -> application or
 *   null, initiateUpload(orgId, appId, body), getUploadStatus(orgId, appId,
 *   fileUploadId), getRegistration(orgId, registrationId) -> the
 *   registration status with its registered ORSs (`sites`), or null }
 */
export async function stubAccreditationChanges(method, endpoint, body, deps) {
  if (REGISTRATION_RE.test(endpoint)) {
    return registrationChanges(method, endpoint, deps)
  }
  const [, orgId, appId, rest = ''] = CHANGES_RE.exec(endpoint)
  const application = await grantedApplication(deps, orgId, appId, method)
  const key = `${orgId}/${appId}`
  const store = stateFor(key, () =>
    seededStubChangeRequests(orgId, appId, application)
  )
  const ctx = {
    orgId,
    appId,
    key,
    application,
    store,
    body,
    deps,
    view: () => buildView(orgId, appId, application, store)
  }
  for (const route of ROUTES) {
    const match = route.method === method ? route.pattern.exec(rest) : null
    if (match) {
      return route.handle(ctx, ...match.slice(1))
    }
  }
  throw stubError(
    statusCodes.notFound,
    `No stub for ${method.toUpperCase()} ${endpoint}`
  )
}
