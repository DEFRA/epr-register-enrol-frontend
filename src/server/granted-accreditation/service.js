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
