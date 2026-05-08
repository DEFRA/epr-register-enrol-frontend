const STUB_APPLICATIONS = [
  {
    OrganisationId: 'org001',
    ApplicationId: 'app001',
    ApplicationReference: 'REF-STUB-001',
    ApplicationStatus: 'Started',
    MaterialType: 'Plastic',
    SiteId: 'site001',
    SiteAddress: 'Stub Organisation House, Site Lane 001, Siteville, SIT3 OO1',
    OrganisationName: 'Stub Organisation Ltd',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted', Files: [] }
  },
  {
    OrganisationId: 'org002',
    ApplicationId: 'app002',
    ApplicationReference: 'REF-STUB-002',
    ApplicationStatus: 'NotStarted',
    MaterialType: 'Glass',
    SiteId: 'site002',
    SiteAddress: 'Site Lane 002, Siteville, SIT3 OO2',
    OrganisationName: 'Beta Recycling Co',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted', Files: [] }
  }
]

const STUB_ORGANISATIONS = [
  { id: 'org001', name: 'Stub Organisation Ltd' },
  { id: 'org002', name: 'Beta Recycling Co' }
]

const APP_PATH_RE =
  /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+?)(?:\/([^/]+))?$/

const SECTION_KEY_MAP = {
  prns: 'Prns',
  'business-plan': 'BusinessPlan',
  'sampling-plan': 'SamplingPlan'
}

function findApplication(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) {
    return null
  }
  return (
    STUB_APPLICATIONS.find((a) => a.ApplicationId === match[1]) ??
    STUB_APPLICATIONS[0]
  )
}

function findApplicationAndSection(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) return { app: null, section: null }
  const app =
    STUB_APPLICATIONS.find((a) => a.ApplicationId === match[1]) ??
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
        (x) => x.OrganisationId === organisationId
      )

      return Promise.resolve({
        ...STUB_APPLICATIONS[index],
        OrganisationId: organisationId,
        Year: body?.year ?? new Date().getFullYear(),
        ApplicationStatus: 'Saved'
      })
    }
    if (/\/submit$/.test(endpoint)) {
      const app = findApplication(endpoint)
      if (app) {
        app.ApplicationStatus = 'Sent'
        app.DateSent = new Date().toISOString()
        app.SubmittedBy = body ?? null
      }
      return Promise.resolve({
        ApplicationReference: app?.ApplicationReference ?? 'REF-STUB-001'
      })
    }
    if (/\/files$/.test(endpoint)) {
      const app = findApplication(endpoint)
      const newFile = {
        FileId: `stub-file-${Date.now()}`,
        Filename: body?.Filename ?? 'unknown',
        UploadedAt: new Date().toISOString(),
        UploadedBy: 'Stub User',
        ScanStatus: 'Clean'
      }
      if (app) {
        if (!app.SamplingPlan.Files) app.SamplingPlan.Files = []
        app.SamplingPlan.Files.push(newFile)
      }
      return Promise.resolve({ FileId: newFile.FileId })
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
        STUB_APPLICATIONS.find((a) => a.ApplicationId === match[1]) ??
        STUB_APPLICATIONS[0]
      if (app.SamplingPlan?.Files) {
        app.SamplingPlan.Files = app.SamplingPlan.Files.filter(
          (f) => f.FileId !== match[2]
        )
      }
    }
    return Promise.resolve(undefined)
  }
}
