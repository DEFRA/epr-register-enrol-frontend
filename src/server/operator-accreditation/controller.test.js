import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import Boom from '@hapi/boom'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import { apiClient } from '../common/api-client.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { buildLandingViewModel } from './controller.js'

// The controller delegates the access decision to operatorCanAccessOrganisation
// (resolve-linked-id + relationship check + fail-closed), which is unit-tested in
// reex-organisation-service. Here we stub it to allow the URL org (org-123) and
// deny any other org (not-my-org).
vi.mock('../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const ORG_ID = 'org-123'
const REGISTRATION_ID = 'REG001'
const MATERIAL = 'Steel'
const YEAR = 2026

const makeApp = (overrides = {}) => ({
  applicationId: 'app-id-001',
  applicationStatus: 'Saved',
  materialType: MATERIAL,
  registrationId: REGISTRATION_ID,
  year: YEAR,
  ...overrides
})

// RA-415: resolveLandingApplication issues a second GET (getApplication) to
// refresh the picked application with live CM fields (e.g. dueDate) after
// listApplications. Both calls go through apiClient.get, so route by URL
// shape: a request whose last path segment is one of the given apps'
// applicationId is the single-application fetch, anything else is the list.
function mockAccreditationGet(apps) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    const lastSegment = url.split('/').pop()
    const single = apps.find((app) => app.applicationId === lastSegment)
    return single ?? apps
  })
}

describe('#buildLandingViewModel', () => {
  const t = (key) => key.split('.').pop()

  test('Saved maps to grey tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Saved' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--grey')
  })

  test('Started maps to blue tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Started' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--blue')
  })

  test('Submitted maps to green tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Submitted' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--green')
  })

  test('Queried maps to orange tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Queried' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--orange')
  })

  test('Updated maps to turquoise tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Updated' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--turquoise')
  })

  test('DulyMade maps to turquoise tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'DulyMade' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--turquoise')
  })

  test('AwaitingDecision maps to purple tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'AwaitingDecision' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--purple')
  })

  test('Approved maps to green tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Approved' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--green')
  })

  test('Rejected maps to red tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Rejected' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--red')
  })

  test('unknown status maps to empty tagClass', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('')
  })

  test('siteName uses SiteAddr when present', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.siteName).toBe('siteAddr')
  })

  test('siteName falls back to translation key when is null', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      null,
      2027,
      t
    )
    expect(vm.siteName).toBe('siteNotSet')
  })

  test('siteName is "Exporter" when isExporter is true, regardless of siteAddress', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      null,
      2027,
      t,
      true
    )
    expect(vm.siteName).toBe('exporterLabel')
  })

  test.each([
    ['Saved', false],
    ['Started', false],
    ['NotStarted', false],
    ['InProgress', true],
    ['Submitted', true],
    ['Queried', true],
    ['Updated', true],
    ['AwaitingDecision', true],
    ['Approved', false],
    ['Withdrawn', false],
    ['Cancelled', false],
    ['Refused', false],
    ['Rejected', false]
  ])(
    'status %s -> displayReapplyAccreditationText %s',
    (applicationStatus, expected) => {
      const vm = buildLandingViewModel(
        makeApp({ applicationStatus }),
        'Org Name',
        'siteAddr',
        2027,
        t
      )
      expect(vm.displayReapplyAccreditationText).toBe(expected)
    }
  )

  test('taskListUrl contains applicationId', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationId: 'app-xyz' }),
      'Org',
      null,
      2027,
      t
    )
    expect(vm.taskListUrl).toBe('/accreditation/task-list/app-xyz')
  })

  test('taskListUrl points to query-task-list when applicationStatus is Queried', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationId: 'app-xyz', applicationStatus: 'Queried' }),
      'Org',
      null,
      2027,
      t
    )
    expect(vm.taskListUrl).toBe('/accreditation/query-task-list/app-xyz')
  })

  test('materialDisplay comes from translation', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Steel')
  })

  test('glass with glass_re_melt process uses the remelt display name', () => {
    const vm = buildLandingViewModel(
      makeApp({
        materialType: 'Glass',
        glassRecyclingProcess: 'glass_re_melt'
      }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('glassRemelt')
  })

  test('glass with glass_other process uses the other display name', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Glass', glassRecyclingProcess: 'glass_other' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('glassOther')
  })

  test('glass with no recycling process falls back to the generic material name', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Glass' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Glass')
  })

  test('non-glass material ignores glassRecyclingProcess entirely', () => {
    const vm = buildLandingViewModel(
      makeApp({
        materialType: 'Steel',
        glassRecyclingProcess: 'glass_re_melt'
      }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Steel')
  })

  test('organisationName is passed through', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Organisation Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.organisationName).toBe('Organisation Name')
  })

  // Site, material and operator are shown once, in the persistent
  // application-header (see src/server/common/helpers/applicationHeader.js),
  // so pageHeading is just the static "reapply" prompt regardless of them.
  test('pageHeading is the reapply prompt, not tied to site or material', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Organisation Name',
      '2 North Road, Addingrove, AA3 1AB',
      2027,
      t
    )
    expect(vm.pageHeading).toBe('reapplyHeading')
  })

  test('pageHeading is unaffected by a null siteAddress', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Organisation Name',
      null,
      2027,
      t
    )
    expect(vm.pageHeading).toBe('reapplyHeading')
  })

  test('dueDate is sourced from application.dueDate (CM SLA due date)', () => {
    const vm = buildLandingViewModel(
      makeApp({ dueDate: '2026-09-30T00:00:00.000Z' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.dueDate).toBe('2026-09-30T00:00:00.000Z')
  })

  test('dueDate is null when the application has no linked CM work item', () => {
    const vm = buildLandingViewModel(makeApp(), 'Org Name', 'siteAddr', 2027, t)
    expect(vm.dueDate).toBeNull()
  })

  test('currentAccreditation is null when the application has no organisation.accreditation', () => {
    const vm = buildLandingViewModel(makeApp(), 'Org Name', 'siteAddr', 2027, t)
    expect(vm.currentAccreditation).toBeNull()
  })

  test('currentAccreditation is built from application.organisation.accreditation', () => {
    const vm = buildLandingViewModel(
      makeApp({
        organisation: {
          accreditation: {
            accreditationNumber: 'A26EX1234560001PA',
            regulator: 'Environment Agency',
            tonnage: 'Up to 500 tonnes',
            authorisedUsers: ['Harry Edge', 'Rosina Campbell'],
            overseasSites: []
          }
        }
      }),
      'Org Name',
      '2 North Road, Addingrove, AA3 1AB',
      2027,
      t
    )
    expect(vm.currentAccreditation).toEqual({
      accreditationNumber: 'A26EX1234560001PA',
      regulator: 'Environment Agency',
      status: 'Approved',
      statusTagClass: 'govuk-tag--green',
      expiryDate: '31 December 2026',
      siteAddress: '2 North Road, Addingrove, AA3 1AB',
      tonnage: 'Up to 500 tonnes',
      authorisedUsers: ['Harry Edge', 'Rosina Campbell'],
      overseasSites: []
    })
  })

  test('notificationFailedBanner is true when notificationStatus is failed', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: 'failed' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(true)
  })

  test('notificationFailedBanner is false when notificationStatus is sent', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: 'sent' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(false)
  })

  test('notificationFailedBanner is false when notificationStatus is null', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: null }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(false)
  })

  test('notificationFailedBanner is false when notificationStatus is absent', () => {
    const vm = buildLandingViewModel(makeApp(), 'Org Name', 'siteAddr', 2027, t)
    expect(vm.notificationFailedBanner).toBe(false)
  })

  // RA-357: restarting after a withdrawal creates a new application for the
  // SAME accreditation year. This used to link to accreditationYear + 1, which
  // made the landing controller seed against a prior year that has no approved
  // accreditation, so the seed always 404'd and the operator was stuck.
  test('startNewUrl targets the same accreditation year for a withdrawn application', () => {
    const vm = buildLandingViewModel(
      makeApp({
        applicationStatus: 'Withdrawn',
        organisationId: ORG_ID,
        year: 2027
      }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )

    expect(vm.startNewUrl).toBe(
      `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/2027/start-new`
    )
    expect(vm.startNewUrl).not.toContain('2028')
  })

  test('startNewUrl points at the exporter landing route when isExporter', () => {
    const vm = buildLandingViewModel(
      makeApp({
        applicationStatus: 'Withdrawn',
        organisationId: ORG_ID,
        year: 2027
      }),
      'Org Name',
      null,
      2027,
      t,
      true
    )

    expect(vm.startNewUrl).toBe(
      `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/2027/exporter/start-new`
    )
  })

  test('startNewUrl uses the accreditation year even when the record carries a different year', () => {
    const vm = buildLandingViewModel(
      makeApp({
        applicationStatus: 'Withdrawn',
        organisationId: ORG_ID,
        year: 1999
      }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )

    expect(vm.startNewUrl).toContain('/2027/start-new')
  })

  test.each([
    'Saved',
    'Started',
    'NotStarted',
    'InProgress',
    'Submitted',
    'DulyMade',
    'Queried',
    'Updated',
    'AwaitingDecision',
    'Approved',
    'Rejected'
  ])('startNewUrl is null when application status is %s', (status) => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: status, organisationId: ORG_ID }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )

    expect(vm.startNewUrl).toBeNull()
  })

  test('a withdrawn application offers neither a continue nor a withdraw action', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Withdrawn', organisationId: ORG_ID }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )

    expect(vm.showContinueLink).toBe(false)
    expect(vm.canWithdraw).toBe(false)
  })

  test.each(['Approved', 'Rejected'])(
    'a %s application offers no continue action (RA-415: application is terminal, so read-only)',
    (applicationStatus) => {
      const vm = buildLandingViewModel(
        makeApp({ applicationStatus, organisationId: ORG_ID }),
        'Org Name',
        'siteAddr',
        2027,
        t
      )

      expect(vm.showContinueLink).toBe(false)
    }
  )
})

describe('#operatorAccreditationController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    operatorCanAccessOrganisation.mockImplementation(
      async (_user, orgId) => orgId === ORG_ID
    )
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  const baseUrl = `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`

  test('returns 403 when operator is not related to the organisation', async () => {
    const getSpy = mockAccreditationGet([makeApp()])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/operator-accreditation/not-my-org/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(getSpy).not.toHaveBeenCalled()
    expect(postSpy).not.toHaveBeenCalled()
  })

  test('renders the service-unavailable page (503) when the access check is unavailable', async () => {
    operatorCanAccessOrganisation.mockRejectedValueOnce(
      Boom.serverUnavailable()
    )
    const getSpy = vi.spyOn(apiClient, 'get')

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.serviceUnavailable)
    expect(result).toContain('the service is unavailable')
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('returns 200 when existing application found for site/material/year', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Started' })])
    vi.spyOn(apiClient, 'post').mockResolvedValue({})

    const { statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('does not call seed when matching application already exists', async () => {
    mockAccreditationGet([makeApp()])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(postSpy).not.toHaveBeenCalled()
  })

  test('calls seedApplication when no matching application found for site/material/year', async () => {
    mockAccreditationGet([makeApp({ registrationId: 'other-ref' })])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(makeApp())

    await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/${REGISTRATION_ID}/${MATERIAL}/seed`),
      expect.objectContaining({ year: YEAR })
    )
  })

  test('returns 200 after successful seed when no application exists', async () => {
    mockAccreditationGet([])
    vi.spyOn(apiClient, 'post').mockResolvedValue(makeApp())

    const { statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders Not Set site address in current accreditation details when there is no site address', async () => {
    mockAccreditationGet([
      makeApp({
        organisation: {
          accreditation: {
            accreditationNumber: 'A26RE5000390068PL',
            regulator: 'Environment Agency',
            tonnage: 'Up to 500 tonnes',
            authorisedUsers: ['Harry Edge'],
            overseasSites: []
          }
        }
      })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="current-accreditation-site-address"')
    expect(result).toContain('Not set')
  })

  test('renders the reapply page heading', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="page-heading"')
    expect(result).toContain('Reapply for accreditation')
  })

  test('renders Application details table with period, due date, status and continue link', async () => {
    mockAccreditationGet([
      makeApp({
        applicationStatus: 'Started',
        dueDate: '2026-09-30T00:00:00.000Z'
      })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="application-details-table"')
    expect(result).toContain('data-testid="application-period"')
    expect(result).toContain('data-testid="application-due-date"')
    expect(result).toContain('30th September 2026')
    expect(result).toContain('data-testid="continue-button"')
    expect(result).toContain('/accreditation/task-list/app-id-001')
  })

  test('renders a fallback due date when the application has no linked CM work item', async () => {
    mockAccreditationGet([
      makeApp({ applicationStatus: 'Started', dueDate: null })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="application-due-date"')
    expect(result).toContain('Not yet available')
  })

  test('does not render Current accreditation details when there is no prior organisation accreditation', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="current-accreditation-summary"')
  })

  test('renders Current accreditation details when application.organisation.accreditation is present', async () => {
    mockAccreditationGet([
      makeApp({
        organisation: {
          accreditation: {
            accreditationNumber: 'A26RE5000390068PL',
            regulator: 'Environment Agency',
            tonnage: 'Up to 500 tonnes',
            authorisedUsers: ['Harry Edge', 'Rosina Campbell'],
            overseasSites: []
          }
        }
      })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="current-accreditation-summary"')
    expect(result).toContain('data-testid="current-accreditation-number"')
    expect(result).toContain('A26RE5000390068PL')
    expect(result).toContain('data-testid="current-accreditation-regulator"')
    expect(result).toContain('Environment Agency')
    expect(result).toContain('data-testid="current-accreditation-expiry-date"')
    expect(result).toContain('31 December 2025')
    expect(result).toContain('data-testid="current-accreditation-tonnage"')
    expect(result).toContain(
      'data-testid="current-accreditation-authorised-users"'
    )
    expect(result).toContain('Harry Edge')
    expect(result).toContain('Rosina Campbell')
    expect(result).not.toContain(
      'data-testid="current-accreditation-overseas-sites"'
    )
  })

  test('renders overseas reprocessing sites when present on the current accreditation', async () => {
    mockAccreditationGet([
      makeApp({
        organisation: {
          accreditation: {
            accreditationNumber: 'A26EX5000391PL',
            regulator: 'Environment Agency',
            tonnage: 'Up to 500 tonnes',
            authorisedUsers: ['Priya Sharma'],
            overseasSites: ['Bharat Recycling', 'Dragon Recyclers']
          }
        }
      })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain(
      'data-testid="current-accreditation-overseas-sites"'
    )
    expect(result).toContain('Bharat Recycling')
    expect(result).toContain('Dragon Recyclers')
  })

  test('page heading is unaffected by site address; the address appears in the application header instead', async () => {
    mockAccreditationGet([
      makeApp({ siteAddress: '2 North Road, Addingrove, AA3 1AB' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="page-heading"')
    expect(result).toContain('Reapply for accreditation')
    expect(result).toContain('data-testid="application-header-site-name"')
    expect(result).toContain('2 North Road, Addingrove, AA3 1AB')
  })

  test('renders status tag with correct class for Started', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Started' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('govuk-tag--blue')
    expect(result).toContain('IN PROGRESS')
  })

  test('reapply text is NOT shown when application status is Saved', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Saved' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is NOT shown when application status is Started', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Started' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is shown when application status is Submitted', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Submitted' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is shown when application status is Queried', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Queried' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test.each(['Withdrawn', 'Cancelled', 'Refused'])(
    'reapply text is NOT shown when application status is %s',
    async (applicationStatus) => {
      mockAccreditationGet([makeApp({ applicationStatus })])

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'You can now reapply for accreditation for this material.'
      )
    }
  )

  test('reapply text is NOT shown when application status is Approved', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Approved' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is NOT shown when application status is Rejected', async () => {
    mockAccreditationGet([makeApp({ applicationStatus: 'Rejected' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('Continue button links to task-list with applicationId', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="continue-button"')
    expect(result).toContain('/accreditation/task-list/app-id-001')
  })

  test('Re/Ex back link is present', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="back-link"')
  })

  test('persistent application header shows operator, material and site', async () => {
    mockAccreditationGet([
      makeApp({
        organisationName: 'Delta Green Ltd',
        siteAddress: '2 North Road, Addingrove, AA3 1AB'
      })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="application-header"')
    expect(result).toContain('data-testid="application-header-operator-name"')
    expect(result).toContain('Delta Green Ltd')
    expect(result).toContain('data-testid="application-header-material-type"')
    expect(result).toContain('data-testid="application-header-site-name"')
    expect(result).toContain('2 North Road, Addingrove, AA3 1AB')
  })

  test('application summary list is rendered', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="application-summary"')
  })

  test('multi-application list is not rendered', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="applications-list"')
  })

  test('renders notification status row when notificationStatus is failed', async () => {
    mockAccreditationGet([makeApp({ notificationStatus: 'failed' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="notification-status"')
    expect(result).toContain('Failed to send')
  })

  test('does not render notification status row when notificationStatus is sent', async () => {
    mockAccreditationGet([makeApp({ notificationStatus: 'sent' })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('does not render notification status row when notificationStatus is null', async () => {
    mockAccreditationGet([makeApp({ notificationStatus: null })])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('does not render notification status row when notificationStatus is absent', async () => {
    mockAccreditationGet([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('returns 500 error view when listApplications throws', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="error-message"')
    expect(result).toContain('We were unable to start your application')
  })

  test('error view renders back link with non-empty href', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="back-link"')
    expect(result).not.toContain('href=""')
  })

  test('returns 500 error view when seedApplication throws', async () => {
    mockAccreditationGet([])
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('seed failed'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="error-message"')
  })

  test('year URL param is compared as integer against app.year', async () => {
    const app2026 = makeApp({ year: 2026 })
    const app2025 = makeApp({ applicationId: 'app-2025', year: 2025 })
    mockAccreditationGet([app2025, app2026])

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/2026`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('returns 200 in Welsh locale', async () => {
    mockAccreditationGet([makeApp()])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/cy/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh]')
  })

  // RA-357: an operator who withdraws a reapplication must be able to start a
  // fresh one for the SAME accreditation year, with the withdrawn record kept
  // untouched for audit.
  describe('restarting after a withdrawal', () => {
    const withdrawnApp = (overrides = {}) =>
      makeApp({
        applicationId: 'app-withdrawn',
        applicationStatus: 'Withdrawn',
        organisationId: ORG_ID,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides
      })

    const restartedApp = (overrides = {}) =>
      makeApp({
        applicationId: 'app-restarted',
        applicationStatus: 'Saved',
        organisationId: ORG_ID,
        createdAt: '2026-02-01T00:00:00.000Z',
        ...overrides
      })

    test('withdrawn application links to start a new application for the SAME year', async () => {
      mockAccreditationGet([withdrawnApp()])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="start-new-link"')
      expect(result).toContain(
        `action="/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/start-new"`
      )
      expect(result).not.toContain(`${MATERIAL}/${YEAR + 1}`)
      // Simply viewing a withdrawn application must not create a replacement.
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('withdrawn application still renders as WITHDRAWN with no continue or withdraw action', async () => {
      mockAccreditationGet([withdrawnApp()])
      vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).toContain('WITHDRAWN')
      expect(result).not.toContain('data-testid="continue-button"')
      expect(result).not.toContain('data-testid="withdraw-link"')
    })

    test('renders the live application, not the withdrawn one, when the year holds both', async () => {
      mockAccreditationGet([withdrawnApp(), restartedApp()])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain('/accreditation/task-list/app-restarted')
      expect(result).not.toContain('/accreditation/task-list/app-withdrawn')
      expect(result).not.toContain('data-testid="start-new-link"')
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('the restart control is a crumb-carrying POST form, not a link', async () => {
      mockAccreditationGet([withdrawnApp()])
      vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="start-new-form"')
      expect(result).toContain('method="post"')
      expect(result).toContain('name="crumb"')
      // The mutation must never be reachable as an anchor — that is what made
      // it CSRF-able and replayable from history.
      expect(result).not.toContain(
        `<a href="/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/start-new"`
      )
    })

    // The GET is now purely an idempotent lazy seed: it must never restart,
    // however it is reached (back button, bookmark, restored tab, prefetch).
    test('GET on the start-new path is not routable', async () => {
      mockAccreditationGet([withdrawnApp()])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.notFound)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('POST seeds for the SAME year then redirects to the clean landing URL', async () => {
      mockAccreditationGet([withdrawnApp()])
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(restartedApp())

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(postSpy).toHaveBeenCalledWith(
        `/api/v1/accreditation-applications/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/seed`,
        { year: YEAR }
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(baseUrl)
      expect(headers.location).not.toContain('start-new')
    })

    test('the redirect target then renders the newly seeded application', async () => {
      mockAccreditationGet([withdrawnApp(), restartedApp()])

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain('/accreditation/task-list/app-restarted')
      expect(result).not.toContain('data-testid="start-new-link"')
    })

    test('POST does not seed when a live application already exists', async () => {
      mockAccreditationGet([withdrawnApp(), restartedApp()])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('POST returns 403 when the operator is not related to the organisation', async () => {
      const getSpy = mockAccreditationGet([])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/operator-accreditation/not-my-org/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(getSpy).not.toHaveBeenCalled()
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('POST returns 500 when listApplications throws', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-message"')
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('POST in Welsh locale redirects after seeding', async () => {
      mockAccreditationGet([withdrawnApp()])
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(restartedApp())

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/cy${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(postSpy).toHaveBeenCalledTimes(1)
    })

    test('renders the seed-error view (500) when the restart seed fails', async () => {
      mockAccreditationGet([withdrawnApp()])
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('seed failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${baseUrl}/start-new`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-message"')
      expect(result).toContain('We were unable to start your application')
    })

    test('a live application never offers the start-new link', async () => {
      mockAccreditationGet([
        makeApp({ applicationStatus: 'Submitted', organisationId: ORG_ID })
      ])
      vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="start-new-link"')
    })
  })

  const makeExporterApp = (overrides = {}) => ({
    applicationId: 'app-exp-001',
    applicationStatus: 'Saved',
    materialType: MATERIAL,
    registrationId: REGISTRATION_ID,
    isExporter: true,
    year: YEAR,
    organisationName: 'Exporter Co',
    ...overrides
  })

  describe('exporter applications on the main route (RA-374: isExporter comes from the record, not the URL)', () => {
    test('does NOT render current accreditation site address row for an exporter application', async () => {
      mockAccreditationGet([
        makeExporterApp({
          organisation: {
            accreditation: {
              accreditationNumber: 'A26EX5000391PL',
              regulator: 'Environment Agency',
              tonnage: 'Up to 500 tonnes',
              authorisedUsers: ['Priya Sharma'],
              overseasSites: ['Bharat Recycling']
            }
          }
        })
      ])

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'data-testid="current-accreditation-site-address"'
      )
    })

    test('reprocessor application still renders current accreditation site address row', async () => {
      mockAccreditationGet([
        makeApp({
          organisation: {
            accreditation: {
              accreditationNumber: 'A26RE5000390068PL',
              regulator: 'Environment Agency',
              tonnage: 'Up to 500 tonnes',
              authorisedUsers: ['Harry Edge'],
              overseasSites: []
            }
          }
        })
      ])

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).toContain(
        'data-testid="current-accreditation-site-address"'
      )
    })

    test('renders application summary and continue link for an exporter application', async () => {
      mockAccreditationGet([makeExporterApp()])

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="application-summary"')
      expect(result).toContain('data-testid="continue-button"')
    })

    test('renders "Exporter" as the site name in both the landing page and the application header', async () => {
      mockAccreditationGet([makeExporterApp()])

      const { result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Reapply for accreditation')
      expect(result).toContain('data-testid="application-header-site-name"')
      expect(result).toContain('Exporter')
    })

    test('returns 200 in Welsh locale for an exporter application', async () => {
      mockAccreditationGet([makeExporterApp()])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('seeds and renders a new exporter application reached via the plain URL for the first time', async () => {
      mockAccreditationGet([])
      vi.spyOn(apiClient, 'post').mockResolvedValue(makeExporterApp())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: baseUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="application-header-site-name"')
      expect(result).toContain('Exporter')
      expect(result).not.toContain(
        'data-testid="current-accreditation-site-address"'
      )
    })
  })
})
