import { config } from '../../config/config.js'
import { stubApiClient } from './stub-api-client.js'

const BASE = '/api/v1/accreditation-applications'
const STUB_BASE = '/api/v1/stub/accreditation-applications'
const TIMEOUT_MS = 3000

const LIST_RE = new RegExp(`^${BASE}/([^/]+)$`)
const SINGLE_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)$`)
const APP_SEGMENT_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)/`)
const DELETE_FILE_RE = new RegExp(`^${BASE}/([^/]+)/([^/]+)/files/[^/]+$`)

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

function parseAppSegment(endpoint) {
  const m = endpoint.match(APP_SEGMENT_RE)
  return m ? { orgId: m[1], appId: m[2] } : null
}

export const persistentStubApiClient = {
  async get(endpoint) {
    if (endpoint === '/organisation') {
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
          if (Array.isArray(data) && data.length > 0) return data
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
    if (/\/seed$/.test(endpoint)) {
      const stubResult = await stubApiClient.post(endpoint, body)
      const parts = endpoint.split('/')
      const orgId = parts[parts.length - 4]
      const appId = stubResult.ApplicationId
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
