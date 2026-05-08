const STUB_APPLICATIONS = [
  {
    OrganisationId: 'org001',
    ApplicationId: 'app001',
    ApplicationReference: 'REF-STUB-001',
    ApplicationStatus: 'Started',
    MaterialType: 'Plastic',
    SiteId: 'site001',
    SiteAddress: 'Site Lane 001, Siteville, SIT3 OO1',
    OrganisationName: 'Stub Organisation Ltd',
    Year: 2026,
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted' }
  },
  {
    OrganisationId: 'org002',
    ApplicationId: 'app002',
    ApplicationReference: 'REF-STUB-002',
    ApplicationStatus: 'Sent',
    MaterialType: 'Glass',
    SiteId: 'site002',
    OrganisationName: 'Beta Recycling Co',
    Year: 2025,
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted' }
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
      const organisationId = parts[parts.length - 2]
      return Promise.resolve({
        ...STUB_APPLICATIONS[0],
        OrganisationId: organisationId,
        Year: body?.year ?? new Date().getFullYear(),
        ApplicationStatus: 'Saved'
      })
    }
    if (/\/files$/.test(endpoint)) {
      return Promise.resolve({ FileId: 'stub-file-1' })
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

  delete() {
    return Promise.resolve(undefined)
  }
}
