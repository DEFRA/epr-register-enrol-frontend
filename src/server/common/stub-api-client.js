const STUB_APP_ID_1 = 'stub-app-1'
const STUB_APP_ID_2 = 'stub-app-2'

const STUB_APPLICATIONS = [
  {
    ApplicationId: STUB_APP_ID_1,
    ApplicationReference: 'REF-STUB-001',
    ApplicationStatus: 'Started',
    MaterialType: 'Plastic',
    Year: 2025,
    SiteId: 'Stub Site Alpha',
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'Completed',
      PlannedTonnageBand: 'UpTo500',
      Authorisers: [{ FullName: 'Jane Smith', Email: 'jane.smith@example.com' }]
    },
    BusinessPlan: { SectionStatus: 'InProgress' },
    SamplingPlan: { SectionStatus: 'NotStarted' }
  },
  {
    ApplicationId: STUB_APP_ID_2,
    ApplicationReference: 'REF-STUB-002',
    ApplicationStatus: 'Sent',
    MaterialType: 'Glass',
    Year: 2025,
    SiteId: 'Stub Site Beta',
    DateSent: '2024-03-15T00:00:00Z',
    SubmittedBy: { FullName: 'John Doe' },
    Prns: {
      SectionStatus: 'Completed',
      PlannedTonnageBand: 'UpTo1000',
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'Completed' },
    SamplingPlan: { SectionStatus: 'Completed' }
  }
]

const STUB_ORGANISATIONS = [{ id: 'stub-org-1', name: 'Stub Organisation Ltd' }]

const APP_PATH_RE =
  /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+?)(?:\/|$)/

function findApplication(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) return null
  return (
    STUB_APPLICATIONS.find((a) => a.ApplicationId === match[1]) ??
    STUB_APPLICATIONS[0]
  )
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

  post(endpoint) {
    if (/\/seed$/.test(endpoint)) {
      return Promise.resolve({ ApplicationId: STUB_APP_ID_1 })
    }
    if (/\/files$/.test(endpoint)) {
      return Promise.resolve({ FileId: 'stub-file-1' })
    }
    return Promise.resolve({})
  },

  patch() {
    return Promise.resolve({})
  },

  put() {
    return Promise.resolve({})
  },

  delete() {
    return Promise.resolve(undefined)
  }
}
