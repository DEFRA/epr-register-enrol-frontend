import { describe, test, expect, beforeEach } from 'vitest'
import {
  seedStubChangeRequest,
  stubAccreditationChanges
} from './stub-accreditation-changes.js'
import { currentYear } from './helpers/currentYear.js'

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

// RA-697: mirrors the backend so the journey behaves the same in stub mode.
describe('stubAccreditationChanges items (RA-697)', () => {
  let base
  let d

  beforeEach(() => {
    appSeq += 1
    base = `${BASE}/app-${appSeq}`
    d = deps(application())
  })

  const call = (method, rest, body) =>
    stubAccreditationChanges(method, `${base}${rest}`, body, d)

  const completeSite2 = async () => {
    await call('post', '/requests/current/sites', { siteId: 2 })
    await call('patch', '/requests/current/sites/2', {
      coordinates: '1.000000, 2.000000',
      operationCodes: ['R3'],
      conditionsOfExport: true
    })
  }

  test('adding a site creates an In progress add-overseas-site item', async () => {
    const draft = await call('post', '/requests/current/sites', { siteId: 2 })

    expect(draft.sites[0]).toMatchObject({
      itemId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      changeType: 'add-overseas-site',
      status: 'InProgress',
      validFrom: null,
      withdrawnAt: null
    })
    expect(draft.tonnageBandUpgrade).toBeNull()
    const view = await call('get', '')
    expect(view.sites[1]).toMatchObject({
      pendingRequestId: draft.requestId,
      pendingRequestStatus: 'InProgress'
    })
    expect(view.pendingOrsIds).toEqual(['002'])
  })

  test('submit sets every item to Submitted, keeping its id', async () => {
    await completeSite2()
    const { itemId } = (await call('get', '')).activeRequest.sites[0]

    const submitted = await call('post', '/requests/current/submit', {
      fullName: 'Jane'
    })

    expect(submitted.sites[0]).toMatchObject({ itemId, status: 'Submitted' })
    expect(submitted.submittedAt).toEqual(expect.any(String))
  })

  const seedSubmitted = (requestId, sites, extra = {}) =>
    seedStubChangeRequest(`50018/app-${appSeq}`, {
      requestId,
      status: 'Submitted',
      createdAt: '2026-03-01T00:00:00.000Z',
      submittedAt: '2026-03-01T00:00:00.000Z',
      sites,
      ...extra
    })

  const seededSite = (status, extra = {}) => ({
    siteId: 2,
    itemId: `item-${status}`,
    status,
    ...extra
  })

  test('a seeded request shows its items, validity and tonnage item', async () => {
    seedSubmitted('granted', [
      seededSite('Approved', { validFrom: '2026-03-01T00:00:00.000Z' })
    ])
    seedSubmitted('tonnage', [], {
      changeType: 'upgrade-tonnage-band',
      caseManagementReference: 'CHG-1',
      tonnageBandUpgrade: {
        itemId: 'item-tonnage',
        status: 'Queried',
        requestedBand: 'UpTo10000'
      }
    })

    const { requests } = await call('get', '')

    const granted = requests.find((r) => r.requestId === 'granted')
    expect(granted.sites[0]).toMatchObject({
      itemId: 'item-Approved',
      changeType: 'add-overseas-site',
      status: 'Approved',
      validFrom: '2026-03-01T00:00:00.000Z',
      withdrawnAt: null
    })
    const tonnage = requests.find((r) => r.requestId === 'tonnage')
    expect(tonnage).toMatchObject({
      changeType: 'upgrade-tonnage-band',
      caseManagementReference: 'CHG-1',
      sites: [],
      tonnageBandUpgrade: {
        itemId: 'item-tonnage',
        changeType: 'upgrade-tonnage-band',
        status: 'Queried',
        requestedBand: 'UpTo10000',
        validFrom: null,
        withdrawnAt: null
      }
    })
  })

  test('a site whose items are all final is not pending and can be added again', async () => {
    seedSubmitted('granted', [seededSite('Approved')])
    seedSubmitted('withdrawn', [seededSite('Withdrawn')])

    const view = await call('get', '')

    expect(view.sites[1]).toMatchObject({
      pendingRequestId: null,
      pendingRequestStatus: null
    })
    expect(view.pendingOrsIds).toEqual([])
    const draft = await call('post', '/requests/current/sites', { siteId: 2 })
    expect(draft.sites[0].status).toBe('InProgress')
  })

  test('a site with an active item in a submitted request is pending and cannot be added', async () => {
    seedSubmitted('queried', [seededSite('Queried')])
    seedSubmitted('refused', [seededSite('Rejected')])

    const view = await call('get', '')

    expect(view.sites[1]).toMatchObject({
      pendingRequestId: 'queried',
      pendingRequestStatus: 'Submitted'
    })
    expect(view.pendingOrsIds).toEqual(['002'])
    await expect(
      call('post', '/requests/current/sites', { siteId: 2 })
    ).rejects.toMatchObject({ status: 409 })
  })

  test('add-site is 409 while any submitted request has an active item for the site, even under a newer draft', async () => {
    seedSubmitted('queried', [seededSite('Queried')])
    seedStubChangeRequest(`50018/app-${appSeq}`, {
      requestId: 'draft',
      status: 'InProgress',
      createdAt: '2026-06-01T00:00:00.000Z',
      sites: [{ siteId: 2 }]
    })

    await expect(
      call('post', '/requests/current/sites', { siteId: 2 })
    ).rejects.toMatchObject({ status: 409 })
  })

  test('a granted reprocessor is listed with no sites, but every write is 409', async () => {
    d = deps(application({ isExporter: false }))

    const view = await call('get', '')

    expect(view.sites).toEqual([])
    expect(view.pendingOrsIds).toEqual([])
    expect(view.requests).toEqual([])
    await expect(
      call('post', '/requests/current/sites', { siteId: 2 })
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      call('post', '/requests/current/submit', {})
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('persistentStubApiClient accreditation-changes routing (RA-492)', () => {
  test('serves the org 50019 stub from the stub without reaching the backend', async () => {
    const { persistentStubApiClient: client } =
      await import('./persistentStubApiClient.js')
    const base = `/api/v1/accreditation-changes/50019/a${currentYear()}0000000000000050019`
    const view = await client.get(base)
    expect(view.sites.map((s) => s.orsId)).toEqual(['001', '005', '006', '007'])
    expect(view.sites[1].lockedFields).toEqual([
      'country',
      'coordinates',
      'operationCodes',
      'conditionsOfExport'
    ])
    await client.post(`${base}/requests/current/sites`, { siteId: 901912 })
    const patched = await client.patch(
      `${base}/requests/current/sites/901912`,
      { conditionsOfExport: true }
    )
    expect(patched.sites[0].missingFields).toEqual(['operationCodes'])
    const initiated = await client.post(
      `${base}/requests/current/bes-evidence/initiate`,
      {}
    )
    expect(initiated.statusUrl).toMatch(/\/files\/[^/]+\/status$/)
    expect(
      await client.delete(`${base}/requests/current/sites/901912`)
    ).toBeNull()
    await expect(
      client.get('/api/v1/accreditation-changes/50018/no-such-app')
    ).rejects.toMatchObject({ status: 404 })
  })
})

// RA-697: the stub starts with the backend dev seed's change requests
// (DevChangeRequestSeedService) on org 50018's accreditations, so the change
// request pages show every status and type in stub mode too.
describe('seeded stub change requests (RA-697)', () => {
  const year = currentYear()
  const yy = String(year).slice(-2)
  const changesFor = async (orgId, appId) => {
    const { persistentStubApiClient: client } =
      await import('./persistentStubApiClient.js')
    return client.get(`/api/v1/accreditation-changes/${orgId}/${appId}`)
  }
  const exporterApp = `a${year}0000000000000050018`
  const reprocessorApp = `b${year}0000000000000050018`
  const itemsOf = (requests) =>
    requests.flatMap((r) => [...r.sites, r.tonnageBandUpgrade].filter(Boolean))

  test("the exporter's requests cover every status and type, in more than a page", async () => {
    const view = await changesFor(50018, exporterApp)

    const items = itemsOf(view.requests)
    expect(items.length).toBeGreaterThan(10)
    expect(new Set(items.map((i) => i.status))).toEqual(
      new Set([
        'Queried',
        'InProgress',
        'Submitted',
        'Updated',
        'DulyMade',
        'Approved',
        'Rejected',
        'Withdrawn'
      ])
    )
    expect(new Set(items.map((i) => i.changeType))).toEqual(
      new Set([
        'add-overseas-site',
        'update-overseas-site',
        'upgrade-tonnage-band'
      ])
    )
  })

  test("the exporter's ids, references and dates match the backend seed", async () => {
    const { requests } = await changesFor(50018, exporterApp)

    expect(requests).toHaveLength(11)
    const first = requests.at(-1)
    expect(first).toMatchObject({
      requestId: `0000${year}-0000-0000-a000-050018000001`,
      changeType: 'update-overseas-site',
      status: 'Submitted',
      createdAt: `${year}-02-03T09:00:00.000Z`,
      submittedAt: `${year}-02-03T11:00:00.000Z`,
      submittedBy: { fullName: 'Sam Patel', jobTitle: 'Director' },
      caseManagementReference: `CR${yy}050018A001`
    })
    expect(first.sites.map((s) => [s.itemId, s.orsId, s.status])).toEqual([
      [`0000${year}-0000-0001-a000-050018000001`, '001', 'Approved'],
      [`0000${year}-0000-0002-a000-050018000001`, '002', 'Approved']
    ])
    expect(first.sites[0].validFrom).toBe(`${year}-03-02T09:00:00.000Z`)
    const withdrawn = itemsOf(requests).find(
      (i) => i.status === 'Withdrawn' && i.orsId === '004'
    )
    // RA-697: Dragon's site is registered only, so this was never granted.
    expect(withdrawn).toMatchObject({
      changeType: 'add-overseas-site',
      validFrom: null,
      withdrawnAt: `${year}-06-15T09:00:00.000Z`
    })
    const tonnage = requests.find(
      (r) => r.tonnageBandUpgrade?.status === 'DulyMade'
    )
    expect(tonnage).toMatchObject({
      changeType: 'upgrade-tonnage-band',
      sites: [],
      tonnageBandUpgrade: { requestedBand: 'UpTo10000' }
    })
  })

  test("Dragon's new ORS accreditation is the one draft, and every ORS is pending once", async () => {
    const view = await changesFor(50018, exporterApp)

    expect(view.activeRequest.sites).toMatchObject([
      { orsId: '004', changeType: 'add-overseas-site', status: 'InProgress' }
    ])
    expect(view.activeRequest.caseManagementReference).toBeNull()
    expect(view.requests.filter((r) => r.status === 'InProgress')).toHaveLength(
      1
    )
    expect(
      view.sites.map((s) => [
        s.orsId,
        s.accreditationStatus,
        s.pendingRequestStatus
      ])
    ).toEqual([
      ['001', 'Accredited', 'Submitted'],
      ['002', 'Accredited', 'Submitted'],
      ['003', 'Accredited', 'Submitted'],
      ['004', 'Registered', 'InProgress']
    ])
    expect([...view.pendingOrsIds].sort()).toEqual(['001', '002', '003', '004'])
    const active = itemsOf(view.requests).filter((i) =>
      ['Queried', 'InProgress', 'Submitted', 'Updated', 'DulyMade'].includes(
        i.status
      )
    )
    expect(
      active
        .filter((i) => i.orsId)
        .map((i) => i.orsId)
        .sort()
    ).toEqual(['001', '002', '003', '004'])
  })

  test('the reprocessor has tonnage band upgrades only', async () => {
    const view = await changesFor(50018, reprocessorApp)

    expect(view.sites).toEqual([])
    expect(view.requests).toHaveLength(3)
    expect(view.requests).toEqual(
      view.requests.map(() =>
        expect.objectContaining({
          changeType: 'upgrade-tonnage-band',
          sites: [],
          tonnageBandUpgrade: expect.objectContaining({
            changeType: 'upgrade-tonnage-band'
          })
        })
      )
    )
    expect(view.requests[0].caseManagementReference).toBe(`CR${yy}050018B003`)
  })

  test('the empty org has its sites and no requests', async () => {
    const view = await changesFor(50020, `a${year}0000000000000050020`)

    expect(view.sites.map((s) => [s.orsId, s.accreditationStatus])).toEqual([
      ['001', 'Accredited'],
      ['002', 'Registered']
    ])
    expect(view.requests).toEqual([])
    expect(view.activeRequest).toBeNull()
  })
})

// RA-697 task 011: a registration-only operator's change requests, read by
// organisation, registration and material, with the registration's ORSs as
// Registered sites. Org 50021 starts with the backend dev seed's.
describe('registration-only stub change requests (RA-697)', () => {
  const year = currentYear()
  const yy = String(year).slice(-2)
  const registrationUrl = (
    orgId = 50021,
    registrationId = 'aaa000000000000000050021',
    material = 'plastic'
  ) =>
    `/api/v1/accreditation-changes/${orgId}/registrations/${registrationId}/${material}`
  const getView = async (url = registrationUrl()) => {
    const { persistentStubApiClient: client } =
      await import('./persistentStubApiClient.js')
    return client.get(url)
  }

  test('lists org 50021’s four ORSs as Registered sites, with their interim sites', async () => {
    const view = await getView()

    expect(view).toMatchObject({
      organisationId: '50021',
      applicationId: null,
      accreditationReference: null,
      registrationId: 'aaa000000000000000050021',
      materialType: 'Plastic',
      year
    })
    expect(
      view.sites.map((s) => [
        s.siteId,
        s.orsId,
        s.accreditationStatus,
        s.site.siteName,
        s.site.interimSites.length
      ])
    ).toEqual([
      [1, '001', 'Registered', 'Porto Plasticos Lda', 2],
      [2, '002', 'Registered', 'Milano Riciclo SpA', 1],
      [3, '003', 'Registered', 'Penang Polymers Sdn Bhd', 0],
      [4, '004', 'Registered', 'Jakarta Daur Ulang PT', 0]
    ])
    expect(view.sites[0].site).toMatchObject({
      siteAddress: 'Rua do Porto 21, Porto, Portugal',
      country: 'Portugal',
      selected: false
    })
  })

  test('has the backend seed’s five ORS updates, one item each, none In progress', async () => {
    const view = await getView()

    expect(view.requests).toHaveLength(5)
    expect(view.activeRequest).toBeNull()
    expect(
      view.requests.map((r) => [
        r.changeType,
        r.status,
        r.sites.map((s) => [s.orsId, s.status])
      ])
    ).toEqual([
      ['update-overseas-site', 'Submitted', [['001', 'Submitted']]],
      ['update-overseas-site', 'Submitted', [['002', 'Queried']]],
      ['update-overseas-site', 'Submitted', [['003', 'DulyMade']]],
      ['update-overseas-site', 'Submitted', [['004', 'Approved']]],
      ['update-overseas-site', 'Submitted', [['001', 'Rejected']]]
    ])
    const first = view.requests.at(-1)
    expect(first).toMatchObject({
      requestId: `0000${year}-0000-0000-a000-050021000001`,
      createdAt: `${year}-02-10T09:00:00.000Z`,
      caseManagementReference: `CR${yy}050021A001`
    })
    expect(first.sites[0].itemId).toBe(
      `0000${year}-0000-0001-a000-050021000001`
    )
    expect(view.requests[3].sites[0].validFrom).toBe(
      `${year}-04-20T09:00:00.000Z`
    )
  })

  test('marks the sites with an active item pending', async () => {
    const view = await getView()

    expect(view.sites.map((s) => [s.orsId, s.pendingRequestStatus])).toEqual([
      ['001', 'Submitted'],
      ['002', 'Submitted'],
      ['003', 'Submitted'],
      ['004', null]
    ])
    expect([...view.pendingOrsIds].sort()).toEqual(['001', '002', '003'])
  })

  test('404 for an unknown registration or another material, 409 for one not Approved', async () => {
    await expect(
      getView(registrationUrl(50021, 'no-such-registration'))
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      getView(registrationUrl(50021, undefined, 'glass'))
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      getView(registrationUrl(50018, 'ccc000000000000000050018', 'wood'))
    ).rejects.toMatchObject({ status: 409 })
  })

  test('an accredited exporter’s registration has no registration-only requests or ORS records', async () => {
    const view = await getView(
      registrationUrl(50020, 'aaa000000000000000050020')
    )

    expect(view.sites).toEqual([])
    expect(view.requests).toEqual([])
  })

  test('writes are not served', async () => {
    const { persistentStubApiClient: client } =
      await import('./persistentStubApiClient.js')
    await expect(
      client.post(`${registrationUrl()}/requests/current/sites`, {
        siteId: 1
      })
    ).rejects.toMatchObject({ status: 404 })
  })
})
