import { describe, expect, test, vi } from 'vitest'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from './queriedSectionAccess.js'

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

// RA-481: guardSectionWrite is the extracted POST-handler guard every
// section's write route now calls instead of inlining the blocked/readOnly
// decision-and-redirect. These tests pin its three branches directly so the
// extraction can't silently drift from the inlined behaviour it replaced.
describe('guardSectionWrite', () => {
  function fakeH() {
    return { redirect: vi.fn((url) => ({ redirectedTo: url })) }
  }

  test('redirects to the query task list when blocked', () => {
    const h = fakeH()
    const result = guardSectionWrite({
      h,
      application: { applicationStatus: 'Queried' },
      sectionStatus: 'NotStarted',
      applicationId: 'app-1',
      ownPageUrl: '/accreditation/tonnage/app-1'
    })
    expect(h.redirect).toHaveBeenCalledWith(
      '/accreditation/query-task-list/app-1'
    )
    expect(result).toEqual({
      redirectedTo: '/accreditation/query-task-list/app-1'
    })
  })

  test('redirects to the query task list when read-only because the application is Queried and this section is not', () => {
    const h = fakeH()
    guardSectionWrite({
      h,
      application: { applicationStatus: 'Queried' },
      sectionStatus: 'Completed',
      applicationId: 'app-2',
      ownPageUrl: '/accreditation/tonnage/app-2'
    })
    expect(h.redirect).toHaveBeenCalledWith(
      '/accreditation/query-task-list/app-2'
    )
  })

  test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
    'redirects to ownPageUrl when read-only because the application is locked (%s) but not Queried',
    (applicationStatus) => {
      const h = fakeH()
      guardSectionWrite({
        h,
        application: { applicationStatus },
        sectionStatus: 'Completed',
        applicationId: 'app-3',
        ownPageUrl: '/accreditation/tonnage/app-3'
      })
      expect(h.redirect).toHaveBeenCalledWith('/accreditation/tonnage/app-3')
    }
  )

  test('returns null (letting the write proceed) when fully editable', () => {
    const h = fakeH()
    const result = guardSectionWrite({
      h,
      application: { applicationStatus: 'Started' },
      sectionStatus: 'NotStarted',
      applicationId: 'app-4',
      ownPageUrl: '/accreditation/tonnage/app-4'
    })
    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  test('returns null when the section itself is Queried, even though the application is locked', () => {
    const h = fakeH()
    const result = guardSectionWrite({
      h,
      application: { applicationStatus: 'Submitted' },
      sectionStatus: 'Queried',
      applicationId: 'app-5',
      ownPageUrl: '/accreditation/tonnage/app-5'
    })
    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
