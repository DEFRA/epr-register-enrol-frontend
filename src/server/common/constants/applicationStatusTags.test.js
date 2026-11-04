import { describe, test, expect } from 'vitest'

import { applicationStatusTag } from './applicationStatusTags.js'

const t = (key) => key

describe('#applicationStatusTag', () => {
  test('pairs the status label with its tag colour', () => {
    expect(applicationStatusTag('Approved', t)).toEqual({
      text: 'common.applicationStatuses.Approved',
      classes: 'govuk-tag--green'
    })
  })

  test('gives an unknown status no colour', () => {
    expect(applicationStatusTag('Unknown', t).classes).toBe('')
  })
})
