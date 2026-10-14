import Boom from '@hapi/boom'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import {
  grantedAccreditationUrl,
  isAccreditationChangeSpikeEnabled,
  readFixedAccreditation
} from './service.js'

async function render(request, h, proposal) {
  if (!isAccreditationChangeSpikeEnabled()) {
    throw Boom.notFound()
  }
  const canAccess = await operatorCanAccessOrganisation(
    getUser(request),
    request.params.organisationId,
    { logger: request.logger }
  )
  if (!canAccess) {
    throw Boom.forbidden('You do not have access to this organisation')
  }
  const target = await readFixedAccreditation(request.params)
  const { t } = getLocaleAndTranslator(request)
  const summaryUrl = grantedAccreditationUrl(target)
  return h.view('granted-accreditation/index', {
    pageTitle: t(
      `pages.grantedAccreditation.${proposal ? 'proposalTitle' : 'title'}`
    ),
    target,
    proposal,
    backLink: proposal ? summaryUrl : '/operator',
    changeUrl: `${summaryUrl}/change`
  })
}

export const grantedAccreditationController = {
  handler: (request, h) => render(request, h, false)
}

export const preparedProposalController = {
  handler: (request, h) => render(request, h, true)
}
