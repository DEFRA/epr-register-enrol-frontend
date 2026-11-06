import { describe, test, expect } from 'vitest'
import { validationErrors } from './service.js'

describe('validationErrors (RA-492)', () => {
  test.each([
    [
      'a ValidationProblem body as text',
      '{"errors":{"coordinates":["Bad"]}}',
      { coordinates: ['Bad'] }
    ],
    [
      'an already-parsed body',
      { errors: { country: ['Locked'] } },
      { country: ['Locked'] }
    ],
    ['a body without errors', '{"title":"Bad request"}', {}],
    ['a body that is not JSON', 'Bad request', {}],
    ['no body', undefined, {}]
  ])('%s', (_name, response, expected) => {
    expect(validationErrors({ response })).toEqual(expected)
  })
})
