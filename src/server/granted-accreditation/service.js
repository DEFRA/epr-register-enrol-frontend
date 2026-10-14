import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { realApiClient } from '../common/api-client.js'

export function isAccreditationChangeSpikeEnabled() {
  return (
    config.get('accreditationChangeSpike.enabled') &&
    ['local', 'dev'].includes(config.get('environment')) &&
    !config.get('api.stubEnabled')
  )
}

export function grantedAccreditationUrl(target) {
  return `/granted-accreditation/${targetPath(target)}`
}

function targetPath(target) {
  return [
    target.organisationId,
    target.registrationId,
    target.accreditationId,
    target.materialType,
    target.year
  ]
    .map(encodeURIComponent)
    .join('/')
}

export async function submitPreparedProposal(target) {
  try {
    await realApiClient.post(
      `/api/v1/accreditation-changes/${targetPath(target)}/submit`,
      {}
    )
  } catch (error) {
    if (error.status === 404) {
      throw Boom.notFound()
    }
    // The summary reads the reserved request and offers a retry after an unconfirmed receipt.
    if (error.status !== 503) {
      throw Boom.serverUnavailable(
        'Accreditation service temporarily unavailable'
      )
    }
  }
}

export async function readFixedAccreditation(target) {
  if (!isAccreditationChangeSpikeEnabled()) {
    throw Boom.notFound()
  }
  try {
    return await realApiClient.get(
      `/api/v1/accreditation-changes/${target ? targetPath(target) : 'target'}`
    )
  } catch (error) {
    if (error.status === 404) {
      throw Boom.notFound()
    }
    throw Boom.serverUnavailable(
      'Accreditation service temporarily unavailable'
    )
  }
}

export async function withdrawSubmittedRequest(target) {
  try {
    await realApiClient.post(
      `/api/v1/accreditation-changes/${targetPath(target)}/requests/${encodeURIComponent(target.requestId)}/withdraw`,
      {}
    )
  } catch (error) {
    if (error.status === 404) {
      throw Boom.notFound()
    }
    // Read the retained request after unconfirmed closure or a stale eligibility rejection.
    if (![409, 503].includes(error.status)) {
      throw Boom.serverUnavailable(
        'Accreditation service temporarily unavailable'
      )
    }
  }
}
