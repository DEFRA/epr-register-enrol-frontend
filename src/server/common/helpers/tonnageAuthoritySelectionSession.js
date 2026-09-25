import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

// RA-555. The tonnage-authority page's authoriser tick state is held here
// between requests rather than written straight to the backend, so that adding
// an authoriser - or failing validation on the add form - no longer discards
// the operator's in-progress selection. It is flushed to the backend only when
// they save and continue, or save and come back later.
//
// The stored value carries its own applicationId. There is one flat session
// key (matching every other key in ACCREDITATION_SESSION_KEYS), but the
// session is shared across the whole browser session, so a selection stored
// while working on a different application must not be applied here - saving
// drops unticked authorisers from the application, so a bled selection would
// delete the wrong people. A mismatch is therefore treated as absent, and the
// caller re-seeds from the saved authorisers.

/**
 * @param {object} request - hapi request, for request.yar
 * @param {string} applicationId - the application currently being edited
 * @returns {string[]|null} the selected emails, or null when nothing usable is
 *   stored for this application. An empty array is a real selection - every
 *   authoriser unticked - and is deliberately distinct from null, which means
 *   "nothing chosen yet, seed the default".
 */
export function getSelection(request, applicationId) {
  const stored = request.yar.get(
    ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection
  )
  if (
    stored?.applicationId !== applicationId ||
    !Array.isArray(stored?.emails)
  ) {
    return null
  }
  return stored.emails
}

export function setSelection(request, applicationId, emails) {
  request.yar.set(ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection, {
    applicationId,
    emails
  })
}

export function clearSelection(request) {
  request.yar.clear(ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection)
}
