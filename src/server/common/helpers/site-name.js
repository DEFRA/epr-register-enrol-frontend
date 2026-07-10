export function siteNameFromAddress(siteAddress) {
  if (!siteAddress) return ''
  return siteAddress.split(',')[0].trim()
}
