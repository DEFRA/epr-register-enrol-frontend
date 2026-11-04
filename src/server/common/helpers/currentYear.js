// RA-425: UTC and read on every call, so a long-running process rolls over at
// midnight on 1 January wherever it runs.
export function currentYear() {
  return new Date().getUTCFullYear()
}

export function yearSuffix(year) {
  return String(year).slice(-2)
}
