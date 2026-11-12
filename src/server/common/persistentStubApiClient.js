import { config } from '../../config/config.js'
import { stubApiClient, stubOrgDocs } from './stub-api-client.js'
import { STUB_DEFRA_LINKS } from './stub-operator-orgs.js'
import { stubAccreditationChanges } from './stub-accreditation-changes.js'
import { manageStubRegistrationStatuses } from './stub-manage-accreditations.js'
import { registeredOverseasSites } from './stub-registered-ors.js'

function overlayOrgName(items) {
  const docs = stubOrgDocs()
  return items.map((item) => {
    const doc = docs.find((d) => String(d.orgId) === String(item.orgId))
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

function authHeaders() {
  const sharedSecret = config.get('api.sharedSecret')
  return sharedSecret ? { Authorization: `Bearer ${sharedSecret}` } : {}
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

// RA-492: the in-year accreditation-changes API is stub-only here, read
// from the stub application (shaped the way accreditationApiService
// normalises it) so it never reaches the /submit or /files handlers below.
const ACCREDITATION_CHANGES_PREFIX = '/api/v1/accreditation-changes/'

const accreditationChangesDeps = {
  async getApplication(orgId, appId) {
    const raw = await stubApiClient.get(`${BASE}/${orgId}/${appId}`)
    // The application stub falls back to another application rather than
    // failing for an unknown id; this journey needs that one exactly. Stub
    // applications are looked up, and listed, by id.
    if (String(raw?.id) !== appId) {
      return null
    }
    return {
      ...raw,
      isExporter: raw.wasteProcessingType === 'exporter',
      materialType:
        raw.material.charAt(0).toUpperCase() + raw.material.slice(1),
      year: Number.parseInt(raw.yearlyMetrics.year, 10)
    }
  },
  initiateUpload(orgId, appId, body) {
    return stubApiClient.post(
      `${BASE}/${orgId}/${appId}/files/bes-evidence/initiate`,
      body
    )
  },
  getUploadStatus(orgId, appId, fileUploadId) {
    return stubApiClient.get(
      `${BASE}/${orgId}/${appId}/files/${fileUploadId}/status`
    )
  },
  // RA-697: as the registration-status stub, which does not check the
  // organisation either.
  getRegistration(_orgId, registrationId) {
    const registration = manageStubRegistrationStatuses()[registrationId]
    return registration
      ? { ...registration, sites: registeredOverseasSites(registrationId) }
      : null
  }
}

function parseAppSegment(endpoint) {
  const m = endpoint.match(APP_SEGMENT_RE)
  return m ? { orgId: m[1], appId: m[2] } : null
}

const persistentStubClient = {
  async get(endpoint) {
    // CDP upload status — always use the stub. /files/initiate (see post() below)
    // never calls the real backend, so every fileUploadId this client hands out is
    // stub-only; the real backend has no record of it and would answer 404.
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
          { headers: authHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) }
        )
        if (res.ok) {
          return res.json()
        }
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
        if (res.ok) {
          return res.json()
        }
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

// Every method first offers the call to the accreditation-changes stub.
export const persistentStubApiClient = Object.fromEntries(
  Object.entries(persistentStubClient).map(([method, call]) => [
    method,
    (endpoint, body) =>
      endpoint.startsWith(ACCREDITATION_CHANGES_PREFIX)
        ? stubAccreditationChanges(
            method,
            endpoint,
            body,
            accreditationChangesDeps
          )
        : call(endpoint, body)
  ])
)
