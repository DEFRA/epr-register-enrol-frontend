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
      PlannedTonnageBand: 'UpTo500',
      Authorisers: [{ FullName: 'Jane Smith', Email: 'jane.smith@example.com' }]
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
    OrganisationName: 'Stub Organisation Ltd',
    Year: 2025,
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
  if (!match) {
    return null
  }
  return (
    STUB_APPLICATIONS.find((a) => a.OrganisationId === match[1]) ??
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

  post(endpoint, body) {
    if (/\/seed$/.test(endpoint)) {
      const parts = endpoint.split('/')
      const materialType = parts[parts.length - 2]
      return Promise.resolve({
        ...STUB_APPLICATIONS[0],
        OrganisationId: 'org001',
        MaterialType: materialType,
        Year: body?.year ?? new Date().getFullYear(),
        ApplicationStatus: 'Saved'
      })
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
