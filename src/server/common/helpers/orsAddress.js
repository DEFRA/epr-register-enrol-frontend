// Older ORS records carry only the flattened siteAddress, whose first part is
// address line 1.
function addressLine1(site) {
  return site.addressLine1 || site.siteAddress?.split(',')[0].trim() || null
}

/** RA-425: an ORS's one-line address, as the /manage pages list it. */
export function orsAddressLine(site) {
  return [addressLine1(site), site.country].filter(Boolean).join(', ')
}
