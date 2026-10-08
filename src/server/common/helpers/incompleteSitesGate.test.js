import { describe, test, expect, vi } from 'vitest'
import { redirectIfSitesIncomplete } from './incompleteSitesGate.js'
import { INCOMPLETE_SITES_FLASH } from './overseasSiteCompleteness.js'

const APPLICATION_ID = 'app-gate-001'
const LIST_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`
const t = (key) => key

const COMPLETE_SITE = {
  siteId: 1,
  siteName: 'Complete',
  country: 'Germany',
  addressLine1: '1 Hafenstrasse',
  townOrCity: 'Hamburg',
  coordinates: '53.5511, 9.9937',
  contactName: 'Greta Schmidt',
  contactEmail: 'greta@example.com',
  operationCodes: ['R3'],
  code1: 'A1181',
  repatriatedLoads: 'Returned within 30 days',
  selected: true
}
const BARE_SITE = {
  siteId: 2,
  siteName: 'Bare',
  country: 'France',
  selected: true
}

function run(application) {
  const request = { yar: { flash: vi.fn() } }
  const h = { redirect: vi.fn((url) => ({ redirectedTo: url })) }
  const result = redirectIfSitesIncomplete({
    request,
    h,
    t,
    application,
    applicationId: APPLICATION_ID
  })
  return { result, request, h }
}

const application = (overrides = {}) => ({
  applicationStatus: 'Started',
  materialType: 'Plastic',
  overseasSites: { sectionStatus: 'Completed', sites: [COMPLETE_SITE] },
  ...overrides
})

describe('#redirectIfSitesIncomplete', () => {
  test('lets the operator through when every site in the application is complete', () => {
    const { result, request } = run(application())

    expect(result).toBeNull()
    expect(request.yar.flash).not.toHaveBeenCalled()
  })

  test('turns the operator back to the site list when one is not, and leaves a note for the list', () => {
    const { result, request } = run(
      application({
        overseasSites: {
          sectionStatus: 'Completed',
          sites: [COMPLETE_SITE, BARE_SITE]
        }
      })
    )

    expect(result).toEqual({ redirectedTo: LIST_URL })
    expect(request.yar.flash).toHaveBeenCalledWith(INCOMPLETE_SITES_FLASH, true)
  })

  test('has nothing to check for an application with no overseas sites', () => {
    expect(run(application({ overseasSites: undefined })).result).toBeNull()
    expect(
      run(application({ overseasSites: { sites: undefined } })).result
    ).toBeNull()
  })

  test('uses the application material, so a Steel site must answer conditions of export', () => {
    const steelSite = { ...COMPLETE_SITE, operationCodes: ['R4'] }

    expect(
      run(
        application({
          materialType: 'Steel',
          overseasSites: { sectionStatus: 'Completed', sites: [steelSite] }
        })
      ).result
    ).toEqual({ redirectedTo: LIST_URL })
    expect(
      run(
        application({
          materialType: 'Steel',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ ...steelSite, conditionsOfExport: false }]
          }
        })
      ).result
    ).toBeNull()
  })

  describe('when the operator cannot edit the sites, so turning them back would strand them', () => {
    const withBareSite = (overrides) =>
      application({
        overseasSites: { sectionStatus: 'Completed', sites: [BARE_SITE] },
        ...overrides
      })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'a locked application (%s) is left alone',
      (applicationStatus) => {
        const { result, request } = run(withBareSite({ applicationStatus }))

        expect(result).toBeNull()
        expect(request.yar.flash).not.toHaveBeenCalled()
      }
    )

    test('a query about some other section leaves the sites read-only, so it is left alone', () => {
      expect(
        run(withBareSite({ applicationStatus: 'Queried' })).result
      ).toBeNull()
    })

    test('but a query about the sites themselves is checked', () => {
      expect(
        run(
          withBareSite({
            applicationStatus: 'Queried',
            overseasSites: { sectionStatus: 'Queried', sites: [BARE_SITE] }
          })
        ).result
      ).toEqual({ redirectedTo: LIST_URL })
    })

    test('and so is the section of a locked application that is still outstanding', () => {
      expect(
        run(
          withBareSite({
            applicationStatus: 'Updated',
            overseasSites: { sectionStatus: 'Queried', sites: [BARE_SITE] }
          })
        ).result
      ).toEqual({ redirectedTo: LIST_URL })
    })
  })
})
