import { apiClient } from '../api-client.js'
import { config } from '../../../config/config.js'

/**
 * Resolves the Defra organisation an operator must be related to in order to
 * access a given ReEx organisation.
 *
 * The organisation id in accreditation URLs is a ReEx-internal id — it does NOT
 * match the Defra organisation ids in an operator's Defra ID `relationships`
 * claim. The backend `defra-link` endpoint calls ReEx and returns the linked
 * Defra organisation id, which the authorisation check compares against the
 * operator's relationships.
 *
 * The result is cached per organisation id (configurable TTL, default 1 hour)
 * so repeated requests across an accreditation journey do not re-hit ReEx.
 */

// organisationId -> { linkedDefraOrganisationId: string|null, expiresAt: number }
const cache = new Map()

function ttl() {
  return config.get('reex.orgDefraLinkCacheTtl')
}

export async function getLinkedDefraOrganisationId(
  organisationId,
  { now = Date.now } = {}
) {
  if (organisationId === undefined || organisationId === null) {
    return null
  }

  const key = String(organisationId)
  const currentTime = now()

  const cached = cache.get(key)
  if (cached && cached.expiresAt > currentTime) {
    return cached.linkedDefraOrganisationId
  }

  // A failed ReEx lookup throws — callers fail closed (deny). We deliberately do
  // not cache failures so a transient ReEx blip does not lock a user out for the
  // full TTL.
  const payload = await apiClient.get(
    `/api/v1/organisations/${encodeURIComponent(key)}/defra-link`
  )
  const linkedDefraOrganisationId = payload?.linkedDefraOrganisationId ?? null

  cache.set(key, {
    linkedDefraOrganisationId,
    expiresAt: currentTime + ttl()
  })

  return linkedDefraOrganisationId
}

// Test-only: clear the cache between tests.
export function _clearReExOrgCache() {
  cache.clear()
}
