import { describe, test, expect, vi } from 'vitest'
import { apiClient } from '../api-client.js'
import {
  accreditationChangesService,
  validationErrors
} from './accreditationChangesService.js'

vi.mock('../api-client.js', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
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

describe('queried item calls (RA-698)', () => {
  const ITEM = '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b01'
  const BASE = `/api/v1/accreditation-changes/50019/app-1/items/${ITEM}`

  test("patchItem patches the item's answers", async () => {
    await accreditationChangesService.patchItem('50019', 'app-1', ITEM, {
      siteName: 'New name'
    })

    expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/answers`, {
      siteName: 'New name'
    })
  })

  test("patchItemInterimSite patches one interim site's answers", async () => {
    await accreditationChangesService.patchItemInterimSite(
      '50019',
      'app-1',
      ITEM,
      12,
      { contactName: 'Pat' }
    )

    expect(apiClient.patch).toHaveBeenCalledWith(
      `${BASE}/interim-sites/12/answers`,
      { contactName: 'Pat' }
    )
  })

  test('the BES calls are keyed by the item', async () => {
    expect(
      accreditationChangesService.itemBesEvidenceInitiateUrl(
        '50019',
        'app-1',
        ITEM
      )
    ).toBe(`${BASE}/bes-evidence/initiate`)

    await accreditationChangesService.addItemBesFile('50019', 'app-1', ITEM, {
      fileUploadId: 'u1'
    })
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/bes-evidence/files`, {
      fileUploadId: 'u1'
    })

    await accreditationChangesService.deleteItemBesFile(
      '50019',
      'app-1',
      ITEM,
      'f/1'
    )
    expect(apiClient.delete).toHaveBeenCalledWith(
      `${BASE}/bes-evidence/files/f%2F1`
    )
  })

  test('resubmitItem waits longer than the backend waits for Case Management', async () => {
    const body = { fullName: 'Sam', jobTitle: 'Director' }
    await accreditationChangesService.resubmitItem('50019', 'app-1', ITEM, body)

    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/resubmit`, body, {
      timeout: 20000
    })
  })
})
