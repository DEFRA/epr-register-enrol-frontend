// RA-492: API_STUB_ENABLED stand-in for the backend's accreditation-changes
// API (in-year requests to add registered ORSs to a granted accreditation),
// following the backend contract: one InProgress draft per approved
// application holding many sites, Submitted on declaration, £328 per site.
// Sites come from the stub application itself, so any Approved exporter in
// STUB_ORG_DOCS (org 50018 is seeded for it) can be used locally.

import { statusCodes } from './constants/status-codes.js'

const CHANGES_RE = /^\/api\/v1\/accreditation-changes\/([^/]+)\/([^/]+)(\/.*)?$/
const LOCKABLE = [
  'country',
  'coordinates',
  'operationCodes',
  'conditionsOfExport'
]
const CHARGE_PER_SITE_PENCE = 32800

const state = new Map()

function stubError(status, message, response) {
  return Object.assign(new Error(message), { status, response })
}

const hasValue = (value) =>
  Array.isArray(value) ? value.length > 0 : value != null && value !== ''

function stateFor(key) {
  if (!state.has(key)) {
    state.set(key, { draft: null, submitted: [] })
  }
  return state.get(key)
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
    isComplete: missingFields.length === 0
  }
}

function requestView(request, sitesById) {
  const sites = request.sites.map((entry) =>
    requestSiteView(sitesById.get(entry.siteId), entry)
  )
  return {
    requestId: request.requestId,
    changeType: 'add-overseas-site',
    status: request.status,
    submittedBy: request.submittedBy ?? null,
    sites,
    isComplete: sites.every((site) => site.isComplete),
    charge: {
      chargeableSites: sites.length,
      chargePerSitePence: CHARGE_PER_SITE_PENCE,
      totalPence: sites.length * CHARGE_PER_SITE_PENCE
    }
  }
}

function buildView(orgId, appId, application, store) {
  const sites = application.overseasSites?.sites ?? []
  const sitesById = new Map(sites.map((site) => [site.siteId, site]))
  const requests = [store.draft, ...store.submitted].filter(Boolean)
  const pendingStatus = (siteId) =>
    requests.find((r) => r.sites.some((s) => s.siteId === siteId))?.status ??
    null
  return {
    organisationId: orgId,
    applicationId: appId,
    registrationId: application.registrationId,
    materialType: application.materialType,
    year: application.year,
    sites: sites.map((site) => ({
      siteId: site.siteId,
      orsId: site.orsId,
      accreditationStatus:
        site.selected === false ? 'Registered' : 'Accredited',
      pendingRequestStatus: pendingStatus(site.siteId),
      lockedFields: LOCKABLE.filter((field) => hasValue(site[field])),
      site
    })),
    activeRequest: store.draft ? requestView(store.draft, sitesById) : null,
    requests: requests
      .slice()
      .reverse()
      .map((r) => requestView(r, sitesById))
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
  if (
    listed.accreditationStatus === 'Accredited' ||
    listed.pendingRequestStatus === 'Submitted'
  ) {
    throw stubError(statusCodes.conflict, 'Site cannot be added')
  }
  ctx.store.draft ??= {
    requestId: `stub-request-${Date.now()}`,
    status: 'InProgress',
    sites: []
  }
  if (!ctx.store.draft.sites.some((s) => s.siteId === target.siteId)) {
    ctx.store.draft.sites.push({
      siteId: target.siteId,
      answers: {},
      besEvidenceUploads: []
    })
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

function submit(ctx) {
  const { store } = ctx
  if (!store.draft) {
    throw stubError(statusCodes.notFound, 'No draft')
  }
  if (!currentRequest(ctx).isComplete) {
    throw stubError(statusCodes.unprocessableEntity, 'Incomplete')
  }
  store.draft.status = 'Submitted'
  store.draft.submittedBy = {
    fullName: ctx.body.fullName,
    jobTitle: ctx.body.jobTitle,
    email: ctx.body.email ?? null
  }
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
  ['post', '/requests/current/submit', submit]
].map(([method, path, handle]) => ({
  method,
  pattern: new RegExp(`^${path}$`),
  handle
}))

async function grantedApplication(deps, orgId, appId) {
  const application = await deps.getApplication(orgId, appId)
  if (!application) {
    throw stubError(statusCodes.notFound, 'Application not found')
  }
  if (application.applicationStatus !== 'Approved' || !application.isExporter) {
    throw stubError(
      statusCodes.conflict,
      'Application is not a granted exporter accreditation'
    )
  }
  return application
}

/**
 * Handles one accreditation-changes call.
 *
 * @param {object} deps - { getApplication(orgId, appId) -> application or
 *   null, initiateUpload(orgId, appId, body), getUploadStatus(orgId, appId,
 *   fileUploadId) }
 */
export async function stubAccreditationChanges(method, endpoint, body, deps) {
  const [, orgId, appId, rest = ''] = CHANGES_RE.exec(endpoint)
  const application = await grantedApplication(deps, orgId, appId)
  const store = stateFor(`${orgId}/${appId}`)
  const ctx = {
    orgId,
    appId,
    application,
    store,
    body,
    deps,
    view: () => buildView(orgId, appId, application, store)
  }
  for (const route of ROUTES) {
    const match = route.method === method ? route.pattern.exec(rest) : null
    if (match) {
      return route.handle(ctx, match[1])
    }
  }
  throw stubError(
    statusCodes.notFound,
    `No stub for ${method.toUpperCase()} ${endpoint}`
  )
}
