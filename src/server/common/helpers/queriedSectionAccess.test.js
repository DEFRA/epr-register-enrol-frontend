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

  // RA-481: once submitted, every section is read-only unless it is itself
  // Queried — never fully blocked, since GET must still render the page.
  test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
    'renders a locked application (%s) read-only, not blocked, when the section is not queried',
    (applicationStatus) => {
      expect(
        resolveQueriedSectionAccess({ applicationStatus }, 'Completed')
      ).toEqual({ blocked: false, readOnly: true })
    }
  )

  test.each(['NotStarted', 'InProgress', undefined])(
    'renders a locked application read-only even when the section itself is %s',
    (sectionStatus) => {
      expect(
        resolveQueriedSectionAccess(
          { applicationStatus: 'Submitted' },
          sectionStatus
        )
      ).toEqual({ blocked: false, readOnly: true })
    }
  )

  test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
    'allows full (editable) access to the section that is Queried even though the application is locked (%s)',
    (applicationStatus) => {
      expect(
        resolveQueriedSectionAccess({ applicationStatus }, 'Queried')
      ).toEqual({ blocked: false, readOnly: false })
    }
  )

  test('a locked application status takes no effect when combined with a non-Queried, non-locked applicationStatus check order is irrelevant — sanity check for Approved (terminal, handled elsewhere)', () => {
    // TERMINAL_STATUSES (Withdrawn/Approved/Rejected) are handled by the
    // session guard and task-list redirects, not by this helper — it simply
    // falls through to fully editable here, matching pre-RA-481 behaviour.
    expect(
      resolveQueriedSectionAccess(
        { applicationStatus: 'Approved' },
        'Completed'
      )
    ).toEqual({ blocked: false, readOnly: false })
  })
})
