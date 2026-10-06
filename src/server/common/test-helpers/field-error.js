import { load } from 'cheerio'
import { expect } from 'vitest'

const FIELD_ERROR_CLASSES = ['govuk-input--error', 'govuk-select--error']

/**
 * Asserts a form field's validation error shows everywhere GOV.UK Design
 * System expects it: the field's own error styling, the inline message in its
 * form group, and a link to the field in the error summary.
 *
 * Checking only that the message text is on the page is not enough: the same
 * text appears in the summary, so it passes even when the inline error (or
 * the red field styling) was never rendered for that field.
 *
 * @param {string} html - the rendered page
 * @param {string} fieldId - the input's id, which the summary link points at
 * @param {string} message - the expected error text
 */
export function expectFieldError(html, fieldId, message) {
  const $ = load(html)
  const field = $(`#${fieldId}`)
  expect(field, `an element with id "${fieldId}"`).toHaveLength(1)
  expect(
    FIELD_ERROR_CLASSES.some((errorClass) => field.hasClass(errorClass)),
    `#${fieldId} has error styling`
  ).toBe(true)

  const group = field.closest('.govuk-form-group')
  expect(
    group.hasClass('govuk-form-group--error'),
    `#${fieldId}'s form group is marked as an error`
  ).toBe(true)
  expect(group.find('.govuk-error-message').text()).toContain(message)

  expect(
    $(`.govuk-error-summary a[href="#${fieldId}"]`).text(),
    `the error summary links to #${fieldId}`
  ).toBe(message)
}
