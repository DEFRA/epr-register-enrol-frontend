import { describe, test, expect, vi } from 'vitest'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import {
  getSelection,
  setSelection,
  clearSelection
} from './tonnageAuthoritySelectionSession.js'

const APPLICATION_ID = 'app-1'
const OTHER_APPLICATION_ID = 'app-2'

function makeRequest(stored) {
  const store = new Map()
  if (stored !== undefined) {
    store.set(ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection, stored)
  }
  return {
    yar: {
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn((key) => store.delete(key))
    },
    store
  }
}

describe('getSelection', () => {
  test('returns null when nothing has been stored', () => {
    const request = makeRequest()
    expect(getSelection(request, APPLICATION_ID)).toBeNull()
  })

  test('returns the stored emails for the matching application', () => {
    const request = makeRequest({
      applicationId: APPLICATION_ID,
      emails: ['jane@example.com']
    })
    expect(getSelection(request, APPLICATION_ID)).toEqual(['jane@example.com'])
  })

  // RA-555. An empty selection is a real operator choice - every authoriser
  // unticked - and must NOT be confused with "no selection stored yet", which
  // is what makes the caller re-seed to all-selected.
  test('returns an empty array, not null, when every authoriser was unticked', () => {
    const request = makeRequest({ applicationId: APPLICATION_ID, emails: [] })
    expect(getSelection(request, APPLICATION_ID)).toEqual([])
  })

  // RA-555. One flat session key is shared by the whole browser session, so a
  // value stored against another application must be treated as absent rather
  // than applied here. Because saving is destructive (unticked authorisers are
  // dropped from the application), bleeding a selection across two tabs would
  // delete the wrong people.
  test('returns null when the stored selection belongs to another application', () => {
    const request = makeRequest({
      applicationId: OTHER_APPLICATION_ID,
      emails: ['jane@example.com']
    })
    expect(getSelection(request, APPLICATION_ID)).toBeNull()
  })

  test('returns null when the stored value is malformed', () => {
    expect(getSelection(makeRequest({}), APPLICATION_ID)).toBeNull()
    expect(
      getSelection(
        makeRequest({ applicationId: APPLICATION_ID, emails: 'not-an-array' }),
        APPLICATION_ID
      )
    ).toBeNull()
  })
})

describe('setSelection', () => {
  test('stores the emails against the application id', () => {
    const request = makeRequest()
    setSelection(request, APPLICATION_ID, ['jane@example.com'])
    expect(
      request.store.get(ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection)
    ).toEqual({
      applicationId: APPLICATION_ID,
      emails: ['jane@example.com']
    })
  })

  test('replaces rather than merges a previous selection', () => {
    const request = makeRequest({
      applicationId: APPLICATION_ID,
      emails: ['jane@example.com', 'bob@example.com']
    })
    setSelection(request, APPLICATION_ID, ['bob@example.com'])
    expect(getSelection(request, APPLICATION_ID)).toEqual(['bob@example.com'])
  })

  test('overwrites a selection held for another application', () => {
    const request = makeRequest({
      applicationId: OTHER_APPLICATION_ID,
      emails: ['jane@example.com']
    })
    setSelection(request, APPLICATION_ID, ['bob@example.com'])
    expect(getSelection(request, APPLICATION_ID)).toEqual(['bob@example.com'])
    expect(getSelection(request, OTHER_APPLICATION_ID)).toBeNull()
  })
})

describe('clearSelection', () => {
  test('removes the stored selection', () => {
    const request = makeRequest({
      applicationId: APPLICATION_ID,
      emails: ['jane@example.com']
    })
    clearSelection(request)
    expect(request.yar.clear).toHaveBeenCalledWith(
      ACCREDITATION_SESSION_KEYS.tonnageAuthoritySelection
    )
    expect(getSelection(request, APPLICATION_ID)).toBeNull()
  })

  test('is safe to call when nothing is stored', () => {
    const request = makeRequest()
    expect(() => clearSelection(request)).not.toThrow()
  })
})
