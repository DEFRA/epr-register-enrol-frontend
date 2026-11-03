import { describe, test, expect, beforeEach } from 'vitest'
import { stubAccreditationChanges } from './stub-accreditation-changes.js'

const BASE = '/api/v1/accreditation-changes/50018'

function deps(application) {
  return {
    getApplication: async () => application,
    initiateUpload: async () => ({ fileUploadId: 'up-1' }),
    getUploadStatus: async () => ({ form: { file: { filename: 'bes.pdf' } } })
  }
}

function application(overrides = {}) {
  return {
    applicationStatus: 'Approved',
    isExporter: true,
    overseasSites: {
      sites: [
        { siteId: 1, orsId: '001', selected: true, country: 'Germany' },
        { siteId: 2, orsId: '002', selected: false, country: 'India' }
      ]
    },
    ...overrides
  }
}

let appSeq = 0

describe('stubAccreditationChanges (RA-492)', () => {
  let base
  let d

  beforeEach(() => {
    appSeq += 1
    base = `${BASE}/app-${appSeq}`
    d = deps(application())
  })

  const call = (method, rest, body) =>
    stubAccreditationChanges(method, `${base}${rest}`, body, d)

  test('404 for an unknown application, route, site, or a site not in the draft', async () => {
    d = deps(null)
    await expect(call('get', '')).rejects.toMatchObject({ status: 404 })
    d = deps(application())
    await expect(call('get', '/nope')).rejects.toMatchObject({ status: 404 })
    await expect(
      call('post', '/requests/current/sites', { siteId: 99 })
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      call('patch', '/requests/current/sites/2', {})
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      call('post', '/requests/current/submit', {})
    ).rejects.toMatchObject({ status: 404 })
  })

  test('adding a site already in the draft does not add it twice', async () => {
    await call('post', '/requests/current/sites', { siteId: 2 })
    const draft = await call('post', '/requests/current/sites', { siteId: 2 })
    expect(draft.sites).toHaveLength(1)
  })

  test('409 for an application that is not a granted exporter', async () => {
    d = deps(application({ applicationStatus: 'Submitted' }))
    await expect(call('get', '')).rejects.toMatchObject({ status: 409 })
  })

  test('add, fill in, submit: the site becomes pending and cannot be added again', async () => {
    const view = await call('get', '')
    expect(view.sites.map((s) => s.accreditationStatus)).toEqual([
      'Accredited',
      'Registered'
    ])
    await expect(
      call('post', '/requests/current/sites', { siteId: 1 })
    ).rejects.toMatchObject({ status: 409 })

    const draft = await call('post', '/requests/current/sites', { siteId: 2 })
    expect(draft.sites[0].missingFields).toEqual([
      'coordinates',
      'operationCodes',
      'conditionsOfExport',
      'besEvidence'
    ])
    await expect(
      call('patch', '/requests/current/sites/2', { country: 'France' })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      call('post', '/requests/current/submit', {})
    ).rejects.toMatchObject({
      status: 422
    })

    await call('patch', '/requests/current/sites/2', {
      coordinates: '1.000000, 2.000000',
      operationCodes: ['R3'],
      conditionsOfExport: false
    })
    const complete = await call(
      'post',
      '/requests/current/sites/2/bes-evidence/files',
      { fileUploadId: 'up-1' }
    )
    expect(complete.isComplete).toBe(true)
    await expect(
      call('delete', '/requests/current/sites/2/bes-evidence/files/nope')
    ).rejects.toMatchObject({ status: 404 })
    const removed = await call(
      'delete',
      '/requests/current/sites/2/bes-evidence/files/up-1'
    )
    expect(removed.sites[0].missingFields).toEqual(['besEvidence'])
    await call('post', '/requests/current/sites/2/bes-evidence/files', {
      fileUploadId: 'up-1'
    })
    expect(complete.charge.totalPence).toBe(32800)

    const submitted = await call('post', '/requests/current/submit', {
      fullName: 'Jane'
    })
    expect(submitted.status).toBe('Submitted')
    const after = await call('get', '')
    expect(after.activeRequest).toBeNull()
    expect(after.sites[1].pendingRequestStatus).toBe('Submitted')
    await expect(
      call('post', '/requests/current/sites', { siteId: 2 })
    ).rejects.toMatchObject({ status: 409 })
  })

  test('removing the last site deletes the draft', async () => {
    await call('post', '/requests/current/sites', { siteId: 2 })
    expect(await call('delete', '/requests/current/sites/2')).toBeNull()
  })
})

describe('persistentStubApiClient accreditation-changes routing (RA-492)', () => {
  test('serves the org 50018 seed from the stub without reaching the backend', async () => {
    const { persistentStubApiClient: client } =
      await import('./persistentStubApiClient.js')
    const base = '/api/v1/accreditation-changes/50018/a26000000000000000050018'
    const view = await client.get(base)
    expect(view.sites.map((s) => s.orsId)).toEqual(['001', '002', '003', '004'])
    expect(view.sites[1].lockedFields).toEqual([
      'country',
      'coordinates',
      'operationCodes',
      'conditionsOfExport'
    ])
    await client.post(`${base}/requests/current/sites`, { siteId: 900184 })
    const patched = await client.patch(
      `${base}/requests/current/sites/900184`,
      { conditionsOfExport: true }
    )
    expect(patched.sites[0].missingFields).toEqual(['operationCodes'])
    const initiated = await client.post(
      `${base}/requests/current/bes-evidence/initiate`,
      {}
    )
    expect(initiated.statusUrl).toMatch(/\/files\/[^/]+\/status$/)
    expect(
      await client.delete(`${base}/requests/current/sites/900184`)
    ).toBeNull()
    await expect(
      client.get('/api/v1/accreditation-changes/50018/no-such-app')
    ).rejects.toMatchObject({ status: 404 })
  })
})
