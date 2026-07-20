const SCOTLAND_POSTCODE_PREFIXES = [
  'AB',
  'DD',
  'DG',
  'EH',
  'FK',
  'G',
  'HS',
  'IV',
  'KA',
  'KW',
  'KY',
  'ML',
  'PA',
  'PH',
  'TD',
  'ZE'
]
const WALES_POSTCODE_PREFIXES = ['CF', 'CH', 'LD', 'LL', 'NP', 'SA', 'SY']
const NI_POSTCODE_PREFIX = 'BT'

export const NATIONS = {
  ENGLAND: 'England',
  SCOTLAND: 'Scotland',
  WALES: 'Wales',
  NORTHERN_IRELAND: 'NorthernIreland'
}

function extractPostcodeAreaCode(postcode) {
  const match = postcode?.trim().match(/^[A-Za-z]+/)
  return match ? match[0].toUpperCase() : null
}

/**
 * Resolves a UK nation from a postcode's area code (e.g. "EH1 1AA" -> Scotland).
 * Defaults to England when the postcode is missing or unrecognised.
 */
export function resolveNationFromPostcode(postcode) {
  const area = extractPostcodeAreaCode(postcode)
  if (!area) return NATIONS.ENGLAND
  if (area === NI_POSTCODE_PREFIX) return NATIONS.NORTHERN_IRELAND
  if (SCOTLAND_POSTCODE_PREFIXES.includes(area)) return NATIONS.SCOTLAND
  if (WALES_POSTCODE_PREFIXES.includes(area)) return NATIONS.WALES
  return NATIONS.ENGLAND
}
