// RA-425: UTC and read on every call, so a long-running process rolls over at
// midnight on 1 January wherever it runs.
export function currentYear() {
  return new Date().getUTCFullYear()
}

const YEAR_SUFFIX_LENGTH = 2

export function yearSuffix(year) {
  return String(year).slice(-YEAR_SUFFIX_LENGTH)
}
