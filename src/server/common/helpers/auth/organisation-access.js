/**
 * Operator organisation-ownership checks derived from the Defra ID token.
 *
 * Defra ID delivers an operator's organisation memberships in the `relationships`
 * claim: an array of colon-delimited strings shaped
 * `relationshipId:organisationId:organisationName`. The organisation id is the
 * second segment. `currentRelationshipId` names the relationship the user is
 * currently acting under.
 *
 * NOTE: the organisation id in accreditation URLs is a ReEx-internal id and does
 * NOT match these Defra organisation ids. Callers must first resolve the URL org's
 * linked Defra organisation id (via the ReEx `defra-link` lookup) and pass THAT
 * here — never the raw URL id.
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

// True when the user has a Defra ID relationship with the given Defra organisation.
// linkedDefraOrganisationId is the id resolved from ReEx for the URL organisation;
// a null/undefined value (ReEx recorded no link) always denies — fail closed.
export function userIsRelatedToDefraOrg(user, linkedDefraOrganisationId) {
  if (
    linkedDefraOrganisationId === undefined ||
    linkedDefraOrganisationId === null
  ) {
    return false
  }
  const target = String(linkedDefraOrganisationId)
  return getUserOrganisationIds(user).some((id) => String(id) === target)
}
