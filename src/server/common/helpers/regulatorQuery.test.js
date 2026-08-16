import { describe, test, expect, vi } from 'vitest'
import { config } from '../../../config/config.js'
import {
  REGULATOR_QUERY_SECTION_LABEL_KEYS,
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from './regulatorQuery.js'

const t = (key) => {
  const map = {
    'common.regulatorQuery.summaryPrefix':
      'The regulator has identified an issue with your',
    'common.regulatorQuery.sectionLabels.prns':
      'tonnage and authority to issue PRNs',
    'common.regulatorQuery.sectionLabels.samplingPlan':
      'sampling and inspection plan'
  }
  return map[key] ?? key
}

describe('buildRegulatorQuerySummary', () => {
  test('builds the templated summary sentence for a known section key', () => {
    expect(buildRegulatorQuerySummary('samplingPlan', t)).toBe(
      'The regulator has identified an issue with your sampling and inspection plan.'
    )
  })

  test('builds a different sentence for a different section key', () => {
    expect(buildRegulatorQuerySummary('prns', t)).toBe(
      'The regulator has identified an issue with your tonnage and authority to issue PRNs.'
    )
  })

  test('returns null for an unrecognised section key', () => {
    expect(buildRegulatorQuerySummary('notASection', t)).toBeNull()
  })

  test('exposes every accreditation section used across the query flow', () => {
    expect(Object.keys(REGULATOR_QUERY_SECTION_LABEL_KEYS).sort()).toEqual(
      [
        'besEvidence',
        'businessPlan',
        'overseasSites',
        'perns',
        'prns',
        'samplingPlan'
      ].sort()
    )
  })
})

describe('resolveRegulatorQueryNote', () => {
  function makeApplication(overrides = {}) {
    return {
      applicationStatus: 'Queried',
      query: { queryNote: 'Please confirm the planned tonnage band.' },
      ...overrides
    }
  }

  function mockFlag(disabled) {
    const originalConfigGet = config.get.bind(config)
    return vi
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'regulatorQuery.textDisabled'
          ? disabled
          : originalConfigGet(key)
      )
  }

  test('returns the queryNote when Queried, not read-only, and the flag is off', () => {
    const spy = mockFlag(false)
    try {
      expect(resolveRegulatorQueryNote(makeApplication())).toBe(
        'Please confirm the planned tonnage band.'
      )
    } finally {
      spy.mockRestore()
    }
  })

  test('defaults readOnly to false when no options are passed', () => {
    const spy = mockFlag(false)
    try {
      expect(resolveRegulatorQueryNote(makeApplication())).toBe(
        'Please confirm the planned tonnage band.'
      )
    } finally {
      spy.mockRestore()
    }
  })

  test('returns null when the section is read-only', () => {
    const spy = mockFlag(false)
    try {
      expect(
        resolveRegulatorQueryNote(makeApplication(), { readOnly: true })
      ).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  test('returns null when applicationStatus is not Queried', () => {
    const spy = mockFlag(false)
    try {
      expect(
        resolveRegulatorQueryNote(
          makeApplication({ applicationStatus: 'Submitted' })
        )
      ).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  test('returns null when application.query is absent', () => {
    const spy = mockFlag(false)
    try {
      expect(
        resolveRegulatorQueryNote(makeApplication({ query: null }))
      ).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  test('returns null when REGULATOR_QUERY_TEXT_DISABLED is true, even for a Queried, editable section', () => {
    const spy = mockFlag(true)
    try {
      expect(resolveRegulatorQueryNote(makeApplication())).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
})
