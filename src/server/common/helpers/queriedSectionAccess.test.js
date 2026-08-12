import { describe, expect, test } from 'vitest'
import { resolveQueriedSectionAccess } from './queriedSectionAccess.js'

describe('resolveQueriedSectionAccess', () => {
  test('allows full access when the application is not Queried', () => {
    expect(
      resolveQueriedSectionAccess(
        { applicationStatus: 'Started' },
        'NotStarted'
      )
    ).toEqual({ blocked: false, readOnly: false })
  })

  test('allows full (editable) access to the section the regulator queried', () => {
    expect(
      resolveQueriedSectionAccess({ applicationStatus: 'Queried' }, 'Queried')
    ).toEqual({ blocked: false, readOnly: false })
  })

  test.each(['Completed', 'Submitted'])(
    'allows read-only access to a %s section that is not the queried one',
    (sectionStatus) => {
      expect(
        resolveQueriedSectionAccess(
          { applicationStatus: 'Queried' },
          sectionStatus
        )
      ).toEqual({ blocked: false, readOnly: true })
    }
  )

  test.each(['NotStarted', 'InProgress', undefined])(
    'blocks a %s section that is not the queried one',
    (sectionStatus) => {
      expect(
        resolveQueriedSectionAccess(
          { applicationStatus: 'Queried' },
          sectionStatus
        )
      ).toEqual({ blocked: true, readOnly: false })
    }
  )
})
