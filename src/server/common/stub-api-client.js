const STUB_APPLICATIONS = [
  {
    organisationId: 50001,
    applicationId: 'app001',
    applicationReference: 'REF-STUB-001',
    applicationStatus: 'Started',
    materialType: 'Plastic',
    siteId: 'site001',
    siteAddress: 'Stub Organisation House, Site Lane 001, Siteville, SIT3 OO1',
    organisationName: 'Stub Organisation Ltd',
    year: 2027,
    dateSent: null,
    submittedBy: null,
    prns: {
      sectionStatus: 'NotStarted',
      plannedTonnageBand: null,
      authorisers: []
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted', files: [] }
  },
  {
    organisationId: 50001,
    applicationId: 'app002',
    applicationReference: 'REF-STUB-002',
    applicationStatus: 'NotStarted',
    materialType: 'Glass',
    siteId: 'site002',
    siteAddress: 'Site Lane 002, Siteville, SIT3 OO2',
    organisationName: 'Beta Recycling Co',
    year: 2027,
    dateSent: null,
    submittedBy: null,
    prns: {
      sectionStatus: 'NotStarted',
      plannedTonnageBand: null,
      authorisers: []
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted', files: [] }
  },
  {
    organisationId: 50002,
    applicationId: 'app003',
    applicationReference: 'REF-STUB-003',
    applicationStatus: 'Started',
    materialType: 'Glass',
    siteId: 'site003',
    siteAddress: 'The Laundry, Siteville, SIT3 OO2',
    organisationName: 'Delta Green Recycling Co',
    year: 2027,
    dateSent: '2026-12-01T10:00:00Z',
    submittedBy: 'Jane Doe',
    prns: {
      sectionStatus: 'Completed',
      plannedTonnageBand: 'UpTo1000',
      authorisers: [{ fullName: 'Jane Doe', email: 'jane@deltagreen.co.uk' }]
    },
    businessPlan: {
      sectionStatus: 'Completed',
      newInfrastructurePercent: 30,
      priceSupportPercent: 20,
      businessCollectionsPercent: 15,
      communicationsPercent: 10,
      newMarketsPercent: 15,
      newUsesPercent: 10,
      newInfrastructureDetail:
        'Investment in new sorting and processing equipment at the Delta Green Recycling site.',
      priceSupportDetail:
        'Price support payments to collectors to maintain viability of glass collection routes.',
      businessCollectionsDetail:
        'Expansion of commercial and industrial glass collection services across the region.',
      communicationsDetail:
        'Public awareness campaign promoting glass recycling and correct bin usage.',
      newMarketsDetail:
        'Development of relationships with construction sector to use recycled glass aggregate.',
      newUsesDetail:
        'Trials of cullet use in road surfacing and insulation manufacturing.'
    },
    samplingPlan: {
      sectionStatus: 'Started',
      files: [
        {
          fileId: 'file003',
          filename: 'code-nightmare-green.pdf',
          uploadedAt: '2026-11-01T12:00:00Z',
          uploadedBy: 'Jane Doe',
          scanStatus: 'Clean'
        }
      ]
    }
  }
]

const STUB_ORGANISATIONS = [
  { id: 50001, name: 'Stub Organisation Ltd' },
  { id: 50002, name: 'Beta Recycling Co' }
]

export const STUB_ORG_MODELS = {
  50001: {
    orgId: 50001,
    schemaVersion: 1,
    version: 1,
    companyDetails: { name: 'Stub Organisation Ltd' },
    registrations: [
      {
        siteId: 'site001',
        material: 'Plastic',
        wasteProcessingType: 'reprocessor',
        siteAddress: {
          line1: 'Stub Organisation House, Site Lane 001',
          town: 'Siteville',
          postcode: 'SIT3 OO1',
          country: 'England'
        }
      }
    ]
  },
  50002: {
    orgId: 50002,
    schemaVersion: 1,
    version: 1,
    companyDetails: { name: 'Beta Recycling Co' },
    registrations: [
      {
        siteId: 'site002',
        material: 'Glass',
        wasteProcessingType: 'reprocessor',
        siteAddress: {
          line1: 'Site Lane 002',
          town: 'Siteville',
          postcode: 'SIT3 OO2',
          country: 'England'
        }
      }
    ]
  }
}

const APP_PATH_RE =
  /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+?)(?:\/([^/]+))?$/

const SECTION_KEY_MAP = {
  prns: 'prns',
  'business-plan': 'businessPlan',
  'sampling-plan': 'samplingPlan'
}

function findApplication(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) {
    return null
  }
  return (
    STUB_APPLICATIONS.find((a) => a.applicationId === match[1]) ??
    STUB_APPLICATIONS[0]
  )
}

function findApplicationAndSection(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) return { app: null, section: null }
  const app =
    STUB_APPLICATIONS.find((a) => a.applicationId === match[1]) ??
    STUB_APPLICATIONS[0]
  return { app, section: match[2] ?? null }
}

export const stubApiClient = {
  get(endpoint) {
    if (endpoint === '/organisation') {
      return Promise.resolve(STUB_ORGANISATIONS)
    }
    if (/\/api\/v1\/accreditation-applications\/[^/]+$/.test(endpoint)) {
      return Promise.resolve(STUB_APPLICATIONS)
    }
    const app = findApplication(endpoint)
    return Promise.resolve(app ?? {})
  },

  post(endpoint, body) {
    if (/\/seed$/.test(endpoint)) {
      const parts = endpoint.split('/')
      const organisationId = parts[parts.length - 4]
      const index = STUB_APPLICATIONS.findIndex(
        (x) => String(x.organisationId) === String(organisationId)
      )

      return Promise.resolve({
        ...STUB_APPLICATIONS[index],
        organisationId: organisationId,
        year: body?.year ?? new Date().getFullYear(),
        applicationStatus: 'Saved'
      })
    }
    if (/\/submit$/.test(endpoint)) {
      const app = findApplication(endpoint)
      if (app) {
        app.applicationStatus = 'Sent'
        app.dateSent = new Date().toISOString()
        app.submittedBy = body ?? null
      }
      return Promise.resolve({
        applicationReference: app?.applicationReference ?? 'REF-STUB-001'
      })
    }
    if (/\/files$/.test(endpoint)) {
      const app = findApplication(endpoint)
      const newFile = {
        fileId: `stub-file-${Date.now()}`,
        filename: body?.filename ?? 'unknown',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Stub User',
        scanStatus: 'Clean'
      }
      if (app) {
        if (!app.samplingPlan.files) app.samplingPlan.files = []
        app.samplingPlan.files.push(newFile)
      }
      return Promise.resolve({ fileId: newFile.fileId })
    }
    return Promise.resolve({})
  },

  patch(endpoint, body) {
    const { app, section } = findApplicationAndSection(endpoint)
    if (!app || !section) return Promise.resolve({})
    const key = SECTION_KEY_MAP[section]
    if (key) Object.assign(app[key], body)
    return Promise.resolve(app)
  },

  put() {
    return Promise.resolve({})
  },

  delete(endpoint) {
    const match = endpoint.match(
      /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+)\/files\/([^/]+)$/
    )
    if (match) {
      const app =
        STUB_APPLICATIONS.find((a) => a.applicationId === match[1]) ??
        STUB_APPLICATIONS[0]
      if (app.samplingPlan?.files) {
        app.samplingPlan.files = app.samplingPlan.files.filter(
          (f) => f.fileId !== match[2]
        )
      }
    }
    return Promise.resolve(undefined)
  }
}
