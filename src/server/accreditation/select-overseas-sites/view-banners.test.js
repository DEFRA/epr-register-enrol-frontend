import { describe, test, expect } from 'vitest'

import { queriedBannerData } from './view-banners.js'

const t = (key) => key

describe('queriedBannerData (RA-698)', () => {
  test('names the sites alone when only they are queried', () => {
    const data = queriedBannerData(t, true)

    expect(data.querySummary).toContain(
      'common.regulatorQuery.sectionLabels.overseasSites'
    )
    expect(data.regulatorQueryFields[0].label).toBe(
      'pages.taskList.tasks.overseasSites'
    )
  })

  test('names the sites and BES evidence together when both are queried', () => {
    const data = queriedBannerData(t, true, true)

    expect(data.querySummary).toContain(
      'sectionLabels.overseasSitesAndBesEvidence'
    )
    expect(data.regulatorQueryFields[0].label).toBe(
      'pages.taskList.tasks.overseasSitesAndBesEvidence'
    )
  })

  test('has nothing when not queried', () => {
    expect(queriedBannerData(t, false, true)).toEqual({
      querySummary: null,
      regulatorQueryFields: null
    })
  })
})
