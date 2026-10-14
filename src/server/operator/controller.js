import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import {
  grantedAccreditationUrl,
  isAccreditationChangeSpikeEnabled,
  readFixedAccreditation
} from '../granted-accreditation/service.js'

async function readOptionalSpikeTarget(request) {
  if (!isAccreditationChangeSpikeEnabled()) {
    return null
  }
  try {
    const target = await readFixedAccreditation()
    const canAccess = await operatorCanAccessOrganisation(
      getUser(request),
      target.organisationId,
      { logger: request.logger }
    )
    return canAccess ? target : null
  } catch (error) {
    request.logger.warn(
      { err: error },
      'Could not load accreditation change demo'
    )
    return null
  }
}

export const operatorController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const notification = request.yar.flash('notification')[0] ?? null
    const target = await readOptionalSpikeTarget(request)
    return h.view('operator/index', {
      pageTitle: t('pages.operator.title'),
      heading: t('pages.operator.heading'),
      notification,
      grantedAccreditationLink: target ? grantedAccreditationUrl(target) : null,
      grantedAccreditationName: target?.organisationName
    })
  }
}
