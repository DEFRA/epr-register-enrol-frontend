import { config } from '../../config/config.js'
import {
  stubApiClient,
  STUB_ORG_MODELS,
  STUB_ORG_DOCS
} from './stub-api-client.js'
import { STUB_DEFRA_LINKS } from './stub-operator-orgs.js'

function overlayOrgName(items) {
  return items.map((item) => {
    const doc = STUB_ORG_DOCS.find(
      (d) => String(d.orgId) === String(item.orgId)
    )
    return doc ? { ...item, companyName: doc.companyDetails?.name } : item
  })
}

const BASE = '/api/v1/accreditation-applications'
const STUB_BASE = '/api/v1/stub/accreditation-applications'
const TIMEOUT_MS = 3000

const LIST_RE = new RegExp(`^${BASE}/([^/]+)$`)
const SINGLE_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)$`)
const APP_SEGMENT_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)/`)
const DELETE_FILE_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)/files/[^/]+$`)
const DEFRA_LINK_RE = /^\/api\/v1\/organisations\/([^/]+)\/defra-link$/

function backendUrl() {
  return config.get('api.baseUrl')
}

async function tryBackendPut(orgId, appId, data) {
  try {
    await fetch(`${backendUrl()}${STUB_BASE}/${orgId}/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (err) {
    console.warn(`[persistentStubApiClient] backend PUT failed: ${err.message}`)
  }
}

async function ensureOrgInBackend(orgId) {
  try {
    const res = await fetch(`${backendUrl()}/organisation/${orgId}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (res.ok) return

    const model = STUB_ORG_MODELS[String(orgId)]
    if (!model) return

    await fetch(`${backendUrl()}/organisation/${orgId}/upsert`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (err) {
    console.warn(
      `[persistentStubApiClient] ensureOrgInBackend failed: ${err.message}`
    )
  }
}

function parseAppSegment(endpoint) {
  const m = endpoint.match(APP_SEGMENT_RE)
  return m ? { orgId: m[1], appId: m[2] } : null
}

export const persistentStubApiClient = {
  async get(endpoint) {
    // CDP upload status — always use the stub. /files/initiate (see post() below)
    // never calls the real backend, so every fileUploadId this client hands out is
    // stub-only; the real backend has no record of it and its status endpoint
    // returns 200 "pending" for any unrecognised id rather than an error, so
    // trying the backend here previously masked the stub's real "ready" result
    // behind a false-positive "pending" that the poll loop never recovered from.
    if (/\/files\/[^/]+\/status$/.test(endpoint)) {
      return stubApiClient.get(endpoint)
    }

    // ReEx linked-Defra-org lookup used by the operator accreditation
    // authorisation check. Try the real backend; fall back to the STUB_DEFRA_LINKS
    // map so pure-stub local dev authorises exactly the operator's orgs.
    const defraLinkMatch = endpoint.match(DEFRA_LINK_RE)
    if (defraLinkMatch) {
      const orgId = defraLinkMatch[1]
      try {
        const res = await fetch(
          `${backendUrl()}/api/v1/organisations/${orgId}/defra-link`,
          { signal: AbortSignal.timeout(TIMEOUT_MS) }
        )
        if (res.ok) return res.json()
      } catch (err) {
        console.warn(
          `[persistentStubApiClient] backend GET defra-link failed: ${err.message}`
        )
      }
      return {
        organisationId: orgId,
        linkedDefraOrganisationId: STUB_DEFRA_LINKS[orgId] ?? null
      }
    }

    if (endpoint === '/organisation') {
      try {
        const res = await fetch(`${backendUrl()}/organisation`, {
          signal: AbortSignal.timeout(TIMEOUT_MS)
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) return data
        }
      } catch (err) {
        console.warn(
          `[persistentStubApiClient] backend GET /organisation failed: ${err.message}`
        )
      }
      return stubApiClient.get(endpoint)
    }

    const listMatch = endpoint.match(LIST_RE)
    if (listMatch) {
      const orgId = listMatch[1]
      try {
        const res = await fetch(`${backendUrl()}${STUB_BASE}/${orgId}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS)
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            return overlayOrgName(data)
          }
        }
      } catch (err) {
        console.warn(
          `[persistentStubApiClient] backend GET list failed: ${err.message}`
        )
      }
      return stubApiClient.get(endpoint)
    }

    const singleMatch = endpoint.match(SINGLE_RE)
    if (singleMatch) {
      const [, orgId, appId] = singleMatch
      try {
        const res = await fetch(
          `${backendUrl()}${STUB_BASE}/${orgId}/${appId}`,
          {
            signal: AbortSignal.timeout(TIMEOUT_MS)
          }
        )
        if (res.ok) return res.json()
      } catch (err) {
        console.warn(
          `[persistentStubApiClient] backend GET single failed: ${err.message}`
        )
      }
      return stubApiClient.get(endpoint)
    }

    return stubApiClient.get(endpoint)
  },

  async post(endpoint, body) {
    if (/\/initiate$/.test(endpoint)) {
      return stubApiClient.post(endpoint, body)
    }

    if (/\/seed$/.test(endpoint)) {
      const parts = endpoint.split('/')
      const orgId = parts[parts.length - 4]
      await ensureOrgInBackend(orgId)
      const stubResult = await stubApiClient.post(endpoint, body)
      const appId = stubResult.id ?? stubResult.applicationId
      if (orgId && appId) {
        await tryBackendPut(orgId, appId, stubResult)
      }
      return stubResult
    }

    if (/\/submit$/.test(endpoint)) {
      const stubResult = await stubApiClient.post(endpoint, body)
      const parsed = parseAppSegment(endpoint)
      if (parsed) {
        const { orgId, appId } = parsed
        const updatedApp = await stubApiClient.get(`${BASE}/${orgId}/${appId}`)
        await tryBackendPut(orgId, appId, updatedApp)
      }
      return stubResult
    }

    if (/\/files$/.test(endpoint)) {
      const stubResult = await stubApiClient.post(endpoint, body)
      const parsed = parseAppSegment(endpoint)
      if (parsed) {
        const { orgId, appId } = parsed
        const updatedApp = await stubApiClient.get(`${BASE}/${orgId}/${appId}`)
        await tryBackendPut(orgId, appId, updatedApp)
      }
      return stubResult
    }

    return stubApiClient.post(endpoint, body)
  },

  async patch(endpoint, body) {
    const stubResult = await stubApiClient.patch(endpoint, body)
    const parsed = parseAppSegment(endpoint)
    if (parsed) {
      const { orgId, appId } = parsed
      await tryBackendPut(orgId, appId, stubResult)
    }
    return stubResult
  },

  put(endpoint, body) {
    return stubApiClient.put(endpoint, body)
  },

  async delete(endpoint) {
    const stubResult = await stubApiClient.delete(endpoint)
    const m = endpoint.match(DELETE_FILE_RE)
    if (m) {
      const [, orgId, appId] = m
      const updatedApp = await stubApiClient.get(`${BASE}/${orgId}/${appId}`)
      await tryBackendPut(orgId, appId, updatedApp)
    }
    return stubResult
  }
}
