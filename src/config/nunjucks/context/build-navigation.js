import { config } from '../../config.js'

// RA-487: the top nav is meant to match Re-Ex's own — Home and Manage
// account both leave this app entirely and land back on Re-Ex (this app has
// no equivalent pages of its own to deep-link to), and Sign out ends the
// session here. All three render as one flat, left-aligned list, same as
// Re-Ex's own service navigation.

function operatorNavigation(t) {
  return [
    {
      text: t('navigation.home'),
      href: config.get('reex.frontendBaseUrl'),
      attributes: { 'data-testid': 'nav-home-link' }
    },
    {
      text: t('navigation.manageAccount'),
      href: config.get('auth.defraId.manageAccountUrl'),
      attributes: { 'data-testid': 'nav-manage-account-link' }
    },
    {
      text: t('navigation.signOut'),
      href: '/auth/logout',
      attributes: { 'data-testid': 'nav-sign-out-link' }
    }
  ]
}

// Regulators aren't Re-Ex users — they sign in to this app directly via
// Entra ID, have no Defra ID account to manage, and their only page is the
// regulator landing page itself.
function regulatorNavigation(t) {
  return [
    {
      text: t('navigation.home'),
      href: '/regulator',
      attributes: { 'data-testid': 'nav-home-link' }
    },
    {
      text: t('navigation.signOut'),
      href: '/auth/logout',
      attributes: { 'data-testid': 'nav-sign-out-link' }
    }
  ]
}

export function buildNavigation(request, t) {
  const userType = request?.auth?.credentials?.userType

  if (userType === 'operator') {
    return operatorNavigation(t)
  }

  if (userType === 'regulator') {
    return regulatorNavigation(t)
  }

  // No session (pre-login pages, 404s, etc.) — nothing to navigate to or
  // sign out of.
  return []
}
