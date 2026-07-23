import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

export function getAddOrsSession(request) {
  return request.yar.get(ACCREDITATION_SESSION_KEYS.addOverseasSite) ?? {}
}

export function setAddOrsSession(request, data) {
  const current = getAddOrsSession(request)
  request.yar.set(ACCREDITATION_SESSION_KEYS.addOverseasSite, {
    ...current,
    ...data
  })
}

export function clearAddOrsSession(request) {
  request.yar.clear(ACCREDITATION_SESSION_KEYS.addOverseasSite)
}

export function resetAddOrsSession(request) {
  request.yar.set(ACCREDITATION_SESSION_KEYS.addOverseasSite, {})
}
