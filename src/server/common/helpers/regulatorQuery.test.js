import { describe, test, expect } from 'vitest'
import {
  REGULATOR_QUERY_SECTION_LABEL_KEYS,
  buildRegulatorQuerySummary
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
