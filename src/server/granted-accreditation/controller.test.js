import { vi } from 'vitest'
import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { realApiClient } from '../common/api-client.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'

vi.mock('../common/helpers/reex-organisation-service.js')

const summary =
  '/granted-accreditation/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026'
const target = {
  organisationId: '50006',
  registrationId: 'aaa000000000000000050006',
  accreditationId: 'reex-acc-50006-Glass-2026',
  organisationName: 'Global Glass Exports',
  registrationReference: 'EXP-50006',
  materialType: 'Glass',
  year: 2026,
  status: 'Granted',
  overseasSites: [
    {
      siteName: 'Overseas Site 1 (Germany)',
      siteAddress: 'Address 900001',
      country: 'Germany'
    }
  ],
  proposal: {
    siteName: 'Spike Glass Recycling',
    siteAddress: '25 Example Road, Hamburg',
    country: 'Germany'
  }
}

describe('Fixed granted accreditation', () => {
  let server
  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })
  beforeEach(() => {
    config.set('accreditationChangeSpike.enabled', true)
    config.set('api.stubEnabled', false)
    vi.mocked(operatorCanAccessOrganisation).mockResolvedValue(true)
    vi.spyOn(realApiClient, 'get').mockResolvedValue(target)
  })
  afterEach(() => {
    config.reset('accreditationChangeSpike.enabled')
    config.reset('api.stubEnabled')
    vi.restoreAllMocks()
  })

  test('landing links to exactly one fixed granted accreditation', async () => {
    const response = await server.inject('/operator')
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain(`href="${summary}"`)
    expect(
      response.result.match(/data-testid="spike-accreditation-link"/g)
    ).toHaveLength(1)
    expect(response.result).toContain('/operator-accreditation/50002/')
  })

  test('refresh reads identity and baseline without sending a mutation', async () => {
    const post = vi.spyOn(realApiClient, 'post')
    for (let refresh = 0; refresh < 2; refresh++) {
      const response = await server.inject(summary)
      expect(response.statusCode).toBe(200)
      for (const text of [
        'Global Glass Exports',
        'EXP-50006',
        'reex-acc-50006-Glass-2026',
        'Glass',
        '2026',
        'Granted',
        'Overseas Site 1 (Germany)'
      ]) {
        expect(response.result).toContain(text)
      }
      expect(response.result).toContain(`href="${summary}/change"`)
    }
    expect(post).not.toHaveBeenCalled()
  })

  test('Change displays a protected submission form without creating a request on GET', async () => {
    const post = vi.spyOn(realApiClient, 'post')
    const response = await server.inject(`${summary}/change`)
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('Spike Glass Recycling')
    expect(response.result).toContain('25 Example Road, Hamburg')
    expect(response.result).toContain('data-testid="submit-ors-example"')
    expect(response.result).toContain('name="crumb"')
    expect(post).not.toHaveBeenCalled()
  })

  test('submission redirects to the persisted summary', async () => {
    vi.spyOn(realApiClient, 'post').mockResolvedValue({
      requestId: 'request-1'
    })
    const response = await server.inject({
      method: 'POST',
      url: `${summary}/submit`
    })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(summary)
    expect(realApiClient.post).toHaveBeenCalledWith(
      '/api/v1/accreditation-changes/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026/submit',
      {}
    )
  })

  test('an active request hides Change and retains Granted and the approved sites', async () => {
    vi.mocked(realApiClient.get).mockResolvedValue({
      ...target,
      activeRequest: {
        requestId: 'request-1',
        proposedSiteId: 'site-1',
        status: 'submitted',
        caseId: 'case-1',
        caseReference: 'AP26EXAMPLE'
      }
    })
    for (const path of [summary, `${summary}/change`]) {
      const response = await server.inject(path)
      expect(response.result).toContain('request-1')
      expect(response.result).toContain('case-1')
      expect(response.result).toContain('AP26EXAMPLE')
      expect(response.result).toContain('Granted')
      expect(response.result).not.toContain(
        'data-testid="accreditation-change"'
      )
      expect(response.result).not.toContain('data-testid="submit-ors-example"')
    }
  })

  test('unconfirmed submission offers retry of the reserved request', async () => {
    vi.spyOn(realApiClient, 'post').mockRejectedValue(
      Object.assign(new Error('Unconfirmed'), { status: 503 })
    )
    const response = await server.inject({
      method: 'POST',
      url: `${summary}/submit`
    })
    expect(response.statusCode).toBe(302)
    vi.mocked(realApiClient.get).mockResolvedValue({
      ...target,
      activeRequest: {
        requestId: 'pending-request',
        status: 'submission-pending',
        caseId: null
      }
    })
    const summaryResponse = await server.inject(summary)
    expect(summaryResponse.result).toContain('pending-request')
    expect(summaryResponse.result).toContain('Submission unconfirmed')
    expect(summaryResponse.result).toContain(
      'data-testid="retry-ors-submission"'
    )
  })

  test('refused history retains correlation and restores Change alongside the unchanged accreditation', async () => {
    vi.mocked(realApiClient.get).mockResolvedValue({
      ...target,
      activeRequest: null,
      history: [
        {
          requestId: 'old-request',
          caseId: 'old-case',
          proposedSiteId: 'old-site',
          caseReference: 'AP26OLD',
          status: 'rejected'
        }
      ]
    })
    const response = await server.inject(summary)
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('data-testid="change-request-history"')
    for (const text of [
      'old-request',
      'old-case',
      'AP26OLD',
      'Refused',
      'Granted',
      'Overseas Site 1 (Germany)'
    ]) {
      expect(response.result).toContain(text)
    }
    expect(response.result).toContain('data-testid="accreditation-change"')
    expect(response.result).not.toContain('data-testid="active-change-request"')
  })

  test.each([
    ['assessment-in-progress', 'Assessment in progress'],
    ['rejected', 'awaiting confirmation'],
    [null, 'Current case state unavailable']
  ])(
    'active request shows current management state %s without releasing Change',
    async (caseState, label) => {
      vi.mocked(realApiClient.get).mockResolvedValue({
        ...target,
        activeRequest: {
          requestId: 'request-1',
          caseId: 'case-1',
          status: 'submitted',
          caseState
        }
      })
      const response = await server.inject(summary)
      expect(response.result).toContain(label)
      expect(response.result).not.toContain(
        'data-testid="accreditation-change"'
      )
    }
  )

  test('submission checks organisation ownership before sending a mutation', async () => {
    vi.mocked(operatorCanAccessOrganisation).mockResolvedValue(false)
    const post = vi.spyOn(realApiClient, 'post')
    const response = await server.inject({
      method: 'POST',
      url: `${summary}/submit`
    })
    expect(response.statusCode).toBe(403)
    expect(post).not.toHaveBeenCalled()
  })

  test('submission rejects a missing CSRF token when protection is enabled', async () => {
    const post = vi.spyOn(realApiClient, 'post')
    config.set('isTest', false)
    try {
      const response = await server.inject({
        method: 'POST',
        url: `${summary}/submit`
      })
      expect(response.statusCode).toBe(403)
      expect(post).not.toHaveBeenCalled()
    } finally {
      config.reset('isTest')
    }
  })

  test('an unrelated operator cannot read the target or proposal', async () => {
    vi.mocked(operatorCanAccessOrganisation).mockResolvedValue(false)
    for (const path of [summary, `${summary}/change`]) {
      const response = await server.inject(path)
      expect(response.statusCode).toBe(403)
    }
    expect(realApiClient.get).not.toHaveBeenCalled()
  })

  test('landing hides the target from an unrelated operator', async () => {
    vi.mocked(operatorCanAccessOrganisation).mockResolvedValue(false)
    const response = await server.inject('/operator')
    expect(response.statusCode).toBe(200)
    expect(response.result).not.toContain(
      'data-testid="spike-accreditation-link"'
    )
  })

  test('an unavailable backend shows a service problem', async () => {
    vi.mocked(realApiClient.get).mockRejectedValue(
      new Error('Connection refused')
    )
    const response = await server.inject(summary)
    expect(response.statusCode).toBe(503)
  })

  test.each([404, 503])(
    'landing retains unrelated navigation when the demo read fails with %s',
    async (status) => {
      vi.mocked(realApiClient.get).mockRejectedValue(
        Object.assign(new Error('Demo unavailable'), { status })
      )
      const response = await server.inject('/operator')
      expect(response.statusCode).toBe(200)
      expect(response.result).toContain('/operator-accreditation/50002/')
      expect(response.result).not.toContain(
        'data-testid="spike-accreditation-link"'
      )
    }
  )

  test('landing retains unrelated navigation when organisation access cannot be resolved', async () => {
    vi.mocked(operatorCanAccessOrganisation).mockRejectedValue(
      new Error('Organisation service unavailable')
    )
    const response = await server.inject('/operator')
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('/operator-accreditation/50002/')
    expect(response.result).not.toContain(
      'data-testid="spike-accreditation-link"'
    )
  })

  test('Welsh routes use translated summary and proposal text', async () => {
    const response = await server.inject(`/cy${summary}/change`)
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('Safle tramor arfaethedig')
    expect(response.result).toContain('Gwydr')
  })

  test('unsupported targets are rejected through the backend read boundary', async () => {
    vi.mocked(realApiClient.get).mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    )
    const response = await server.inject(
      summary.replace('Glass/2026', 'Glass/2027')
    )
    expect(response.statusCode).toBe(404)
  })

  test.each(['disabled', 'production', 'stub'])(
    'spike pages are unavailable when %s',
    async (mode) => {
      if (mode === 'disabled') {
        config.set('accreditationChangeSpike.enabled', false)
      }
      if (mode === 'production') {
        config.set('environment', 'prod')
      }
      if (mode === 'stub') {
        config.set('api.stubEnabled', true)
      }
      try {
        const response = await server.inject(summary)
        expect(response.statusCode).toBe(404)
        const post = await server.inject({
          method: 'POST',
          url: `${summary}/submit`
        })
        expect(post.statusCode).toBe(404)
        const landing = await server.inject('/operator')
        expect(landing.result).not.toContain(
          'data-testid="spike-accreditation-link"'
        )
      } finally {
        config.reset('environment')
      }
    }
  )
})
