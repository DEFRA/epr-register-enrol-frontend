import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('./accreditationApiService.js', () => ({
  accreditationApiService: { getApplication: vi.fn() }
}))

import { accreditationApiService } from './accreditationApiService.js'
import { guardOverseasSiteWizardEntry } from './overseasSiteWizardGuard.js'

const APPLICATION_ID = 'app-001'
const FALLBACK_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function makeH() {
  return {
    redirect: vi.fn((url) => ({ __redirect: url }))
  }
}

beforeEach(() => {
  accreditationApiService.getApplication.mockReset()
})

describe('guardOverseasSiteWizardEntry', () => {
  test('returns null (lets the step proceed) when the application is not locked or queried-blocked', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Started',
      overseasSites: { sectionStatus: 'InProgress' }
    })
    const h = makeH()

    const result = await guardOverseasSiteWizardEntry({
      h,
      organisationId: '50001',
      applicationId: APPLICATION_ID,
      fallbackUrl: FALLBACK_URL
    })

    expect(result).toBeNull()
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('returns null (fails open) when the application fetch throws', async () => {
    accreditationApiService.getApplication.mockRejectedValue(
      new Error('backend down')
    )
    const h = makeH()

    const result = await guardOverseasSiteWizardEntry({
      h,
      organisationId: '50001',
      applicationId: APPLICATION_ID,
      fallbackUrl: FALLBACK_URL
    })

    expect(result).toBeNull()
  })

  test('redirects to the query task list when the application is Queried and overseasSites is not', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Queried',
      overseasSites: { sectionStatus: 'NotStarted' }
    })
    const h = makeH()

    const result = await guardOverseasSiteWizardEntry({
      h,
      organisationId: '50001',
      applicationId: APPLICATION_ID,
      fallbackUrl: FALLBACK_URL
    })

    expect(result).toEqual({
      __redirect: `/accreditation/query-task-list/${APPLICATION_ID}`
    })
  })

  test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
    'redirects to the fallback URL when the application is locked (%s) and overseasSites is not Queried',
    async (applicationStatus) => {
      accreditationApiService.getApplication.mockResolvedValue({
        applicationStatus,
        overseasSites: { sectionStatus: 'Completed' }
      })
      const h = makeH()

      const result = await guardOverseasSiteWizardEntry({
        h,
        organisationId: '50001',
        applicationId: APPLICATION_ID,
        fallbackUrl: FALLBACK_URL
      })

      expect(result).toEqual({ __redirect: FALLBACK_URL })
    }
  )

  test('returns null (lets the wizard proceed) when the application is locked but overseasSites itself is Queried', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Updated',
      overseasSites: { sectionStatus: 'Queried' }
    })
    const h = makeH()

    const result = await guardOverseasSiteWizardEntry({
      h,
      organisationId: '50001',
      applicationId: APPLICATION_ID,
      fallbackUrl: FALLBACK_URL
    })

    expect(result).toBeNull()
    expect(h.redirect).not.toHaveBeenCalled()
  })
})
