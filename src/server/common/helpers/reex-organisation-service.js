import { apiClient } from '../api-client.js'
import { config } from '../../../config/config.js'
import { userIsRelatedToDefraOrg } from './auth/organisation-access.js'

/**
 * Resolves the Defra organisation an operator must be related to in order to
 * access a given ReEx organisation, and authorises the operator against it.
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

// Cap the cache so an authenticated operator iterating org ids in the URL cannot
// grow it without bound. Real deployments have far fewer orgs than this; the cap
// is a safety net, not a working-set limit. Eviction is oldest-first (FIFO).
const MAX_CACHE_ENTRIES = 1000

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

  // Evict the oldest entry when full before inserting a new key.
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, {
    linkedDefraOrganisationId,
    expiresAt: currentTime + ttl()
  })

  return linkedDefraOrganisationId
}

/**
 * Fail-closed authorisation check for an operator against a URL organisation id.
 * Resolves the org's linked Defra organisation (cached) and returns whether the
 * operator is related to it. If resolution fails (ReEx/backend error) this DENIES
 * rather than throwing, so callers respond 403 instead of 500.
 *
 * `resolveLinkedId` is injectable for testing.
 */
export async function operatorCanAccessOrganisation(
  user,
  organisationId,
  { resolveLinkedId = getLinkedDefraOrganisationId, logger } = {}
) {
  let linkedDefraOrganisationId
  try {
    linkedDefraOrganisationId = await resolveLinkedId(organisationId)
  } catch (err) {
    ;(logger ?? console).error(
      `Denying access: could not resolve linked Defra organisation for org=${organisationId}: ${err.message}`
    )
    return false
  }
  return userIsRelatedToDefraOrg(user, linkedDefraOrganisationId)
}

// Test-only: clear the cache between tests.
export function _clearReExOrgCache() {
  cache.clear()
}
