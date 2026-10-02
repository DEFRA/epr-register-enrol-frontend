import { describe, test, expect } from 'vitest'
import {
  describeSiteSaveValidationError,
  summarisePayloadShape
} from './describe-site-save-validation-error.js'

function apiError(status, response) {
  const err = new Error(`API request failed: ${status}`)
  err.status = status
  err.response = response
  return err
}

const PAYLOAD = {
  siteName: 'Hafen Recycling GmbH',
  contactEmail: 'person@example.com',
  contactPhone: '+49 40 555 0142',
  addressLine2: '',
  code2: null,
  operationCodes: ['R3', 'R4']
}

describe('#summarisePayloadShape', () => {
  test('records each field as a length, empty, null or item count - never its value', () => {
    const summary = summarisePayloadShape(PAYLOAD)

    expect(summary).toBe(
      'siteName: 20 chars, contactEmail: 18 chars, contactPhone: 15 chars, addressLine2: empty, code2: null, operationCodes: 2 items'
    )
    expect(summary).not.toContain('person@example.com')
    expect(summary).not.toContain('555')
  })

  test('copes with a missing payload', () => {
    expect(summarisePayloadShape(undefined)).toBe('')
  })

  test('names the type of anything that is not a string, array or null', () => {
    expect(summarisePayloadShape({ selected: true })).toBe('selected: boolean')
  })
})

describe('#describeSiteSaveValidationError', () => {
  test('returns nothing for an error that is not a 400', () => {
    expect(describeSiteSaveValidationError(apiError(500, '[]'), PAYLOAD)).toBe(
      ''
    )
    expect(describeSiteSaveValidationError(new Error('timeout'), PAYLOAD)).toBe(
      ''
    )
  })

  test('lists every failing field with its code and message, dropping attemptedValue', () => {
    const err = apiError(
      400,
      JSON.stringify([
        {
          propertyName: 'ContactPhone',
          errorMessage:
            "The length of 'Contact Phone' must be 30 characters or fewer.",
          attemptedValue: '+49 40 555 0142 extension 12345',
          errorCode: 'MaximumLengthValidator'
        },
        {
          propertyName: 'Code1',
          errorMessage: 'Code1 must be a valid Basel Convention or OECD code.',
          attemptedValue: 'XX999',
          errorCode: 'PredicateValidator'
        }
      ])
    )

    const description = describeSiteSaveValidationError(err, PAYLOAD)

    expect(description).toBe(
      " - validation failed: ContactPhone (MaximumLengthValidator: The length of 'Contact Phone' must be 30 characters or fewer.); Code1 (PredicateValidator: Code1 must be a valid Basel Convention or OECD code.) - payload: " +
        summarisePayloadShape(PAYLOAD)
    )
    expect(description).not.toContain('extension 12345')
    expect(description).not.toContain('XX999')
  })

  test('still logs the payload shape when the body is not a failure list', () => {
    for (const body of ['Bad Request', '{"title":"Bad Request"}', undefined]) {
      expect(
        describeSiteSaveValidationError(apiError(400, body), PAYLOAD)
      ).toBe(
        ' - validation failed: response body was not a validation failure list - payload: ' +
          summarisePayloadShape(PAYLOAD)
      )
    }
  })
})
