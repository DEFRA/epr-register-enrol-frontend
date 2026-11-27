// ASP.NET may send a ValidationProblem's error keys in either case.
function errorKeyFor(errors, field) {
  return Object.keys(errors).find(
    (name) => name.toLowerCase() === field.toLowerCase()
  )
}

/**
 * A refused save's message against each field the backend named, or against
 * the first field when it named none.
 */
export function refusedFields(t, errors, fields) {
  const named = fields.filter((field) => errorKeyFor(errors, field))
  return Object.fromEntries(
    (named.length > 0 ? named : fields.slice(0, 1)).map((field) => [
      field,
      refusal(t, errors, field)
    ])
  )
}

/**
 * The message to show against one field after a PATCH: the backend's own
 * message for it, a general one when the answer was refused without naming
 * the field, or null when it saved.
 */
export function refusal(t, errors, field) {
  if (errors === null) {
    return null
  }
  const key = errorKeyFor(errors, field)
  return (
    [key ? errors[key] : null].flat().find(Boolean) ??
    t('pages.manageOverseasSites.saveRefused')
  )
}
