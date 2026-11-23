import { describe, test, expect } from 'vitest'
import { uploadRejectionReason } from './uploadRejection.js'

function apiError(status, body) {
  return { status, response: JSON.stringify(body) }
}

describe('#uploadRejectionReason', () => {
  test.each([
    ['MaxFilesExceeded', 'maxFiles'],
    ['DuplicateFilename', 'duplicateFilename']
  ])('a 422 with code %s is %s', (code, reason) => {
    expect(uploadRejectionReason(apiError(422, { code }))).toBe(reason)
  })

  test('a 422 with any other code is null', () => {
    expect(
      uploadRejectionReason(apiError(422, { code: 'DisallowedContentType' }))
    ).toBeNull()
  })

  test('the same code on another status is null', () => {
    expect(
      uploadRejectionReason(apiError(400, { code: 'MaxFilesExceeded' }))
    ).toBeNull()
  })

  test('a body that is not JSON is null', () => {
    expect(
      uploadRejectionReason({ status: 422, response: 'not json' })
    ).toBeNull()
  })
})
