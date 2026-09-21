// Digits, "+" and the spacing/grouping punctuation real international numbers
// are written with (e.g. "+49 40 12345678") — no letters or other text. The
// lookahead requires at least one digit so punctuation-only input like "----"
// isn't accepted.
const PHONE_REGEX = /^(?=.*\d)[0-9+()\-\s]*$/

export function isValidPhoneNumber(phone) {
  return PHONE_REGEX.test(phone)
}
