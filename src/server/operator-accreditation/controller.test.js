import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import { apiClient } from '../common/api-client.js'
import { buildApplicationViewModel } from './controller.js'

const mockSavedApp = {
  ApplicationId: 'app-id-001',
  ApplicationStatus: 'Saved',
  MaterialType: 'Steel',
  ApplicationReference: null,
  DateSent: null,
  SubmittedBy: null
}

const mockStartedApp = {
  ApplicationId: 'app-id-002',
  ApplicationStatus: 'Started',
  MaterialType: 'Wood',
  ApplicationReference: null,
  DateSent: null,
  SubmittedBy: null
}

const mockSentApp = {
  ApplicationId: 'app-id-003',
  ApplicationStatus: 'Sent',
  MaterialType: 'Aluminium',
  ApplicationReference: 'EPR-ACC-2026-ABC1234',
  DateSent: '2026-04-01T10:00:00Z',
  SubmittedBy: {
    FullName: 'Jane Smith',
    JobTitle: 'Manager',
    Email: 'jane@example.com'
  }
}

describe('#buildApplicationViewModel', () => {
  const t = (key) => key.split('.').pop()

  test('Saved status maps to grey tag and isEditable true', () => {
    const vm = buildApplicationViewModel(mockSavedApp, t)
    expect(vm.statusTagClass).toBe('govuk-tag--grey')
    expect(vm.isEditable).toBe(true)
    expect(vm.applicationId).toBe('app-id-001')
    expect(vm.taskListUrl).toBe('/accreditation/task-list/app-id-001')
  })

  test('Started status maps to blue tag and isEditable true', () => {
    const vm = buildApplicationViewModel(mockStartedApp, t)
    expect(vm.statusTagClass).toBe('govuk-tag--blue')
    expect(vm.isEditable).toBe(true)
  })

  test('Sent status maps to turquoise tag and isEditable false', () => {
    const vm = buildApplicationViewModel(mockSentApp, t)
    expect(vm.statusTagClass).toBe('govuk-tag--turquoise')
    expect(vm.isEditable).toBe(false)
    expect(vm.applicationReference).toBe('EPR-ACC-2026-ABC1234')
    expect(vm.submittedBy).toBe('Jane Smith')
  })

  test('Approved status maps to green tag and isEditable false', () => {
    const vm = buildApplicationViewModel(
      { ...mockSentApp, ApplicationStatus: 'Approved' },
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--green')
    expect(vm.isEditable).toBe(false)
  })

  test('Rejected status maps to red tag and isEditable false', () => {
    const vm = buildApplicationViewModel(
      { ...mockSentApp, ApplicationStatus: 'Rejected' },
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--red')
    expect(vm.isEditable).toBe(false)
  })

  test('DateSent is formatted as readable date', () => {
    const vm = buildApplicationViewModel(mockSentApp, t)
    expect(vm.dateSent).toBe('1 April 2026')
  })

  test('Null DateSent returns null', () => {
    const vm = buildApplicationViewModel(mockSavedApp, t)
    expect(vm.dateSent).toBeNull()
  })

  test('Unknown ApplicationStatus returns empty tagClass and isEditable false', () => {
    const vm = buildApplicationViewModel(
      { ...mockSavedApp, ApplicationStatus: 'Unknown' },
      t
    )
    expect(vm.statusTagClass).toBe('')
    expect(vm.isEditable).toBe(false)
  })
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
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  test('Returns 200 with start-new CTA when operator has no applications', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Start new accreditation application')
    )
    expect(result).not.toEqual(
      expect.stringContaining('data-testid="applications-list"')
    )
  })

  test('Returns 200 with application card for in-progress application', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSavedApp])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Steel'))
    expect(result).toEqual(expect.stringContaining('NOT STARTED'))
    expect(result).toEqual(expect.stringContaining('govuk-tag--grey'))
    expect(result).toEqual(expect.stringContaining('Continue application'))
  })

  test('Shows View application link for submitted application', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSentApp])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Aluminium'))
    expect(result).toEqual(expect.stringContaining('SUBMITTED'))
    expect(result).toEqual(expect.stringContaining('govuk-tag--turquoise'))
    expect(result).toEqual(expect.stringContaining('View application'))
    expect(result).toEqual(expect.stringContaining('EPR-ACC-2026-ABC1234'))
    expect(result).toEqual(expect.stringContaining('Jane Smith'))
  })

  test('Shows apply-for-another link when at least one application is submitted', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSavedApp, mockSentApp])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Apply for accreditation for another material')
    )
  })

  test('Does not show apply-for-another link when no applications are submitted', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSavedApp, mockStartedApp])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toEqual(
      expect.stringContaining('Apply for accreditation for another material')
    )
  })

  test('Shows error message and empty list on API failure', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API unavailable'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        'Sorry, we are unable to load your accreditation applications'
      )
    )
  })

  test('Returns 200 in Welsh locale', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSavedApp])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('[Welsh] Accreditation applications')
    )
  })

  test('Returns 200 for default locale with application data', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation',
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Accreditation applications')
    )
  })
})
