import { config } from '../../../config/config.js'

/**
 * RA-459: kill switch for the placeholder "/" home page and "/operator"
 * landing page — neither is wired to any real application context yet.
 */
export function isTestPagesDisabled() {
  return config.get('testPages.disabled')
}

// A couple of in-app flows link/redirect to /operator as a "go back to the
// start" fallback (accreditation session-expiry recovery, the task list's
// save-and-come-back-later link). /operator is a test-only page — send the
// operator to the real Re-Ex frontend instead, regardless of
// TEST_PAGES_DISABLED.
export function operatorHomeUrl() {
  return config.get('reex.frontendBaseUrl')
}
