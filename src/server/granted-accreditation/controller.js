import Boom from '@hapi/boom'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import {
  grantedAccreditationUrl,
  isAccreditationChangeSpikeEnabled,
  readFixedAccreditation,
  submitPreparedProposal,
  withdrawSubmittedRequest
} from './service.js'

async function checkAccess(request) {
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
}

async function render(request, h, proposal) {
  await checkAccess(request)
  const target = await readFixedAccreditation(request.params)
  const { t } = getLocaleAndTranslator(request)
  const summaryUrl = grantedAccreditationUrl(target)
  return h.view('granted-accreditation/index', {
    pageTitle: t(
      `pages.grantedAccreditation.${proposal ? 'proposalTitle' : 'title'}`
    ),
    target,
    proposal,
    requestStatusKey:
      target.activeRequest?.status === 'submission-pending'
        ? 'submissionPending'
        : target.activeRequest?.status,
    caseStateKey:
      target.activeRequest?.caseState === 'assessment-in-progress'
        ? 'assessment'
        : target.activeRequest?.caseState || 'unavailable',
    backLink: proposal ? summaryUrl : '/operator',
    changeUrl: `${summaryUrl}/change`,
    submitUrl: `${summaryUrl}/submit`,
    withdrawUrl: `${summaryUrl}/requests/${encodeURIComponent(target.activeRequest?.requestId || '')}/withdraw`
  })
}

export const grantedAccreditationController = {
  handler: (request, h) => render(request, h, false)
}

export const preparedProposalController = {
  handler: (request, h) => render(request, h, true)
}

export const submitPreparedProposalController = {
  async handler(request, h) {
    await checkAccess(request)
    await submitPreparedProposal(request.params)
    const { currentLocale } = getLocaleAndTranslator(request)
    return h.redirect(
      `${currentLocale === 'cy' ? '/cy' : ''}${grantedAccreditationUrl(request.params)}`
    )
  }
}

export const withdrawSubmittedRequestController = {
  async handler(request, h) {
    await checkAccess(request)
    await withdrawSubmittedRequest(request.params)
    const { currentLocale } = getLocaleAndTranslator(request)
    return h.redirect(
      `${currentLocale === 'cy' ? '/cy' : ''}${grantedAccreditationUrl(request.params)}`
    )
  }
}
