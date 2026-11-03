// RA-492: API_STUB_ENABLED stand-in for the backend's accreditation-changes
// API (in-year requests to add registered ORSs to a granted accreditation),
// following the backend contract: one InProgress draft per approved
// application holding many sites, Submitted on declaration, £328 per site.
// Sites come from the stub application itself, so any Approved exporter in
// STUB_ORG_DOCS (org 50018 is seeded for it) can be used locally.

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

/**
 * Handles an accreditation-changes call, or returns undefined when the
 * endpoint is not one.
 *
 * @param {object} deps - { getApplication(orgId, appId), getUploadStatus(path), initiateUpload(orgId, appId, body) }
 */
export async function stubAccreditationChanges(method, endpoint, body, deps) {
  const match = CHANGES_RE.exec(endpoint)
  if (!match) {
    return undefined
  }
  const [, orgId, appId, rest = ''] = match
  const application = await deps.getApplication(orgId, appId)
  if (!application?.applicationStatus) {
    throw stubError(404, 'Application not found')
  }
  if (application.applicationStatus !== 'Approved' || !application.isExporter) {
    throw stubError(409, 'Application is not a granted exporter accreditation')
  }
  const store = stateFor(`${orgId}/${appId}`)
  const view = () => buildView(orgId, appId, application, store)
  const site = (siteId) =>
    (application.overseasSites?.sites ?? []).find(
      (s) => s.siteId === Number(siteId)
    )
  const draftSite = (siteId) => {
    const entry = store.draft?.sites.find((s) => s.siteId === Number(siteId))
    if (!entry) {
      throw stubError(404, 'Site not in the draft')
    }
    return entry
  }
  const current = () => view().activeRequest

  if (method === 'get' && rest === '') {
    return view()
  }
  if (method === 'post' && rest === '/requests/current/sites') {
    const target = site(body?.siteId)
    if (!target) {
      throw stubError(404, 'Site not found')
    }
    const pending = view().sites.find((s) => s.siteId === target.siteId)
    if (
      pending.accreditationStatus === 'Accredited' ||
      pending.pendingRequestStatus === 'Submitted'
    ) {
      throw stubError(409, 'Site cannot be added')
    }
    store.draft ??= {
      requestId: `stub-request-${Date.now()}`,
      status: 'InProgress',
      sites: []
    }
    if (!store.draft.sites.some((s) => s.siteId === target.siteId)) {
      store.draft.sites.push({
        siteId: target.siteId,
        answers: {},
        besEvidenceUploads: []
      })
    }
    return current()
  }
  const siteMatch = rest.match(/^\/requests\/current\/sites\/(\d+)$/)
  if (siteMatch && method === 'delete') {
    draftSite(siteMatch[1])
    store.draft.sites = store.draft.sites.filter(
      (s) => s.siteId !== Number(siteMatch[1])
    )
    if (store.draft.sites.length === 0) {
      store.draft = null
    }
    return current()
  }
  if (siteMatch && method === 'patch') {
    const entry = draftSite(siteMatch[1])
    const locked = LOCKABLE.filter((field) =>
      hasValue(site(entry.siteId)[field])
    )
    const errors = Object.fromEntries(
      Object.keys(body ?? {})
        .filter((field) => body[field] != null && locked.includes(field))
        .map((field) => [field, [`${field} is already recorded on the ORS`]])
    )
    if (Object.keys(errors).length > 0) {
      throw stubError(400, 'Validation failed', { errors })
    }
    for (const field of LOCKABLE) {
      if (body?.[field] != null) {
        entry.answers[field] = body[field]
      }
    }
    return current()
  }
  if (method === 'post' && rest === '/requests/current/bes-evidence/initiate') {
    return deps.initiateUpload(orgId, appId, body)
  }
  const besMatch = rest.match(
    /^\/requests\/current\/sites\/(\d+)\/bes-evidence\/files$/
  )
  if (besMatch && method === 'post') {
    const entry = draftSite(besMatch[1])
    const status = await deps.getUploadStatus(orgId, appId, body?.fileUploadId)
    entry.besEvidenceUploads.push({
      fileId: body?.fileUploadId,
      filename: status?.form?.file?.filename ?? 'evidence',
      scanStatus: 'Clean',
      besEvidenceValidFromDate: body?.besEvidenceValidFromDate ?? null,
      besEvidenceExpiryDate: body?.besEvidenceExpiryDate ?? null
    })
    return current()
  }
  if (method === 'post' && rest === '/requests/current/submit') {
    if (!store.draft) {
      throw stubError(404, 'No draft')
    }
    if (!current().isComplete) {
      throw stubError(422, 'Incomplete')
    }
    store.draft.status = 'Submitted'
    store.draft.submittedBy = {
      fullName: body?.fullName ?? '',
      jobTitle: body?.jobTitle ?? '',
      email: body?.email ?? null
    }
    store.submitted.push(store.draft)
    store.draft = null
    return view().requests[0]
  }
  throw stubError(404, `No stub for ${method.toUpperCase()} ${endpoint}`)
}
