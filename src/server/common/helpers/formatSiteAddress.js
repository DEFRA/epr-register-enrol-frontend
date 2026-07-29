export function formatSiteAddress(session) {
  return [
    session.addressLine1,
    session.addressLine2,
    session.townOrCity,
    session.stateOrRegion,
    session.postcode,
    session.country
  ]
    .filter(Boolean)
    .join(', ')
}
