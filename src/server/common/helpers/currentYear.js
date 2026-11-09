// RA-425: UTC and read on every call, so a long-running process rolls over at
// midnight on 1 January wherever it runs.
export function currentYear() {
  return new Date().getUTCFullYear()
}

const YEAR_SUFFIX_LENGTH = 2

export function yearSuffix(year) {
  return String(year).slice(-YEAR_SUFFIX_LENGTH)
}

const DECEMBER = 11 // Date months count from 0
const LAST_DAY_OF_DECEMBER = 31

// An accreditation runs to the end of the calendar year it is for. Local time,
// because the formatDate filter formats in local time.
export function endOfYear(year) {
  return new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER)
}
