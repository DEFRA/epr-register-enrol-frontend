/**
 * Operator organisation-ownership checks derived from the Defra ID token.
 *
 * Defra ID delivers an operator's organisation memberships in the `relationships`
 * claim: an array of colon-delimited strings shaped
 * `relationshipId:organisationId:organisationName`. The organisation id is the
 * second segment. `currentRelationshipId` names the relationship the user is
 * currently acting under.
 */

// Returns the set of organisation ids the user is related to (as strings).
export function getUserOrganisationIds(user) {
  const relationships = user?.relationships
  if (!Array.isArray(relationships)) {
    return []
  }
  return relationships
    .map((relationship) =>
      typeof relationship === 'string' ? relationship.split(':')[1] : undefined
    )
    .filter((id) => id !== undefined && id !== '')
}

// True when the user has a Defra ID relationship with the target organisation.
export function userCanAccessOrganisation(user, organisationId) {
  if (organisationId === undefined || organisationId === null) {
    return false
  }
  const target = String(organisationId)
  return getUserOrganisationIds(user).some((id) => String(id) === target)
}
