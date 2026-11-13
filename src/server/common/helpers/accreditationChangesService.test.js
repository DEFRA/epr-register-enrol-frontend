import { describe, test, expect, vi } from 'vitest'
import { apiClient } from '../api-client.js'
import {
  accreditationChangesService,
  validationErrors
} from './accreditationChangesService.js'

vi.mock('../api-client.js', () => ({
  apiClient: { post: vi.fn() }
}))

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

describe('submit (RA-739)', () => {
  test('waits longer than the backend waits for Case Management', async () => {
    const body = { paymentReference: 'REF' }
    await accreditationChangesService.submit('50019', 'app-1', body)

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/accreditation-changes/50019/app-1/requests/current/submit',
      body,
      { timeout: 20000 }
    )
  })
})
