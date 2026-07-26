import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

export function getAddInterimSiteSession(request) {
  return request.yar.get(ACCREDITATION_SESSION_KEYS.addInterimSite) ?? {}
}

export function setAddInterimSiteSession(request, data) {
  const current = getAddInterimSiteSession(request)
  request.yar.set(ACCREDITATION_SESSION_KEYS.addInterimSite, {
    ...current,
    ...data
  })
}

export function clearAddInterimSiteSession(request) {
  request.yar.clear(ACCREDITATION_SESSION_KEYS.addInterimSite)
}

export function resetAddInterimSiteSession(request) {
  request.yar.set(ACCREDITATION_SESSION_KEYS.addInterimSite, {})
}
