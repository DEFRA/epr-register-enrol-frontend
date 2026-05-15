const STUB_APPLICATIONS = [
  {
    OrganisationId: 'org001',
    ApplicationId: 'app001',
    SiteId: 'site001',
    RegistrationReference: 'R26ER5000390068PL',
    AccreditationReference: 'APP2027ER5000390PL',
    ApplicationStatus: 'NotStarted',
    MaterialType: 'Plastic',
    SiteAddress: 'UNIT 5, BL4 7AQ, UK',
    OrganisationName: 'NEWDEV RECYCLING LIMITED',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Prns: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: {
      SectionStatus: 'NotStarted',
      NewInfrastructurePercent: 0,
      PriceSupportPercent: 0,
      BusinessCollectionsPercent: 0,
      CommunicationsPercent: 0,
      NewMarketsPercent: 0,
      NewUsesPercent: 0
    },
    SamplingPlan: { SectionStatus: 'NotStarted', Files: [] }
  },
  {
    OrganisationId: 'org002',
    ApplicationId: 'app002',
    RegistrationReference: 'R26ER5000390068PL',
    AccreditationReference: 'A27ER5000390052GL',
    ApplicationStatus: 'Started',
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
  },
  {
    OrganisationId: 'org004exp',
    ApplicationId: 'app004exp',
    AccreditationReference: 'A27ER5000390053SL',
    ApplicationStatus: 'Started',
    MaterialType: 'Steel',
    SiteId: null,
    SiteAddress: null,
    OrganisationName: 'Export Steel Ltd.',
    Year: 2027,
    DateSent: '2026-12-01T10:00:00Z',
    SubmittedBy: 'Jane Doe',
    Tonnage: {
      SectionStatus: 'Completed',
      PlannedTonnageBand: 'UpTo1000',
      Authorisers: [{ FullName: 'Jane Doe', Email: 'jane@deltagreen.co.uk' }]
    },
    BusinessPlan: {
      SectionStatus: 'Completed',
      NewInfrastructurePercent: 30,
      PriceSupportPercent: 20,
      BusinessCollectionsPercent: 15,
      CommunicationsPercent: 10,
      NewMarketsPercent: 15,
      NewUsesPercent: 10,
      NewInfrastructureDetail:
        'Investment in new sorting and processing equipment at the Delta Green Recycling site.',
      PriceSupportDetail:
        'Price support payments to collectors to maintain viability of glass collection routes.',
      BusinessCollectionsDetail:
        'Expansion of commercial and industrial glass collection services across the region.',
      CommunicationsDetail:
        'Public awareness campaign promoting glass recycling and correct bin usage.',
      NewMarketsDetail:
        'Development of relationships with construction sector to use recycled glass aggregate.',
      NewUsesDetail:
        'Trials of cullet use in road surfacing and insulation manufacturing.'
    },
    SamplingPlan: {
      SectionStatus: 'Started',
      Files: [
        {
          FileId: 'file003',
          Filename: 'code-nightmare-green.pdf',
          UploadedAt: '2026-11-01T12:00:00Z',
          UploadedBy: 'Jane Doe',
          ScanStatus: 'Clean'
        }
      ]
    },
    OverseasSites: [
      {
        SiteName: 'Site 1',
        SiteAddress: 'Address 123',
        Country: 'Germany',
        IsEu: true,
        IsOECD: true,
        BESEvidence: {
          BESEvidenceUploads: [
            {
              BESEvidenceValidFromDate: '2026-11-01T12:00:00Z',
              BESEvidenceExpiryDate: '2027-11-30T12:00:00Z',
              FileId: 'file003',
              Filename: 'code-nightmare-green.pdf',
              UploadedAt: '2026-11-01T12:00:00Z',
              UploadedBy: 'Jane Doe',
              ScanStatus: 'Clean'
            }
          ],
          DoYouWantToUploadMoreEvidence: false
          //No (it’s always no, as answering no to this question is the trigger for the check your answers page appearing)
          //we loop until they say No/false to this question, when they say no we stop uplaoding more files and take them to the check answers page
        }
      },
      {
        SiteName: 'Site 2',
        SiteAddress: 'Address 456',
        Country: 'Chad',
        IsEu: false
      }
    ]
  },
  {
    OrganisationId: 'org003',
    ApplicationId: 'app003',
    AccreditationReference: 'A27ER5000390054GL',
    ApplicationStatus: 'Started',
    MaterialType: 'Glass',
    SiteId: 'site003',
    SiteAddress: 'The Laundry, Siteville, SIT3 OO2',
    OrganisationName: 'Delta Green Recycling Co',
    Year: 2027,
    DateSent: '2026-12-01T10:00:00Z',
    SubmittedBy: 'Jane Doe',
    Prns: {
      SectionStatus: 'Completed',
      PlannedTonnageBand: 'UpTo1000',
      Authorisers: [{ FullName: 'Jane Doe', Email: 'jane@deltagreen.co.uk' }]
    },
    BusinessPlan: {
      SectionStatus: 'Completed',
      NewInfrastructurePercent: 30,
      PriceSupportPercent: 20,
      BusinessCollectionsPercent: 15,
      CommunicationsPercent: 10,
      NewMarketsPercent: 15,
      NewUsesPercent: 10,
      NewInfrastructureDetail:
        'Investment in new sorting and processing equipment at the Delta Green Recycling site.',
      PriceSupportDetail:
        'Price support payments to collectors to maintain viability of glass collection routes.',
      BusinessCollectionsDetail:
        'Expansion of commercial and industrial glass collection services across the region.',
      CommunicationsDetail:
        'Public awareness campaign promoting glass recycling and correct bin usage.',
      NewMarketsDetail:
        'Development of relationships with construction sector to use recycled glass aggregate.',
      NewUsesDetail:
        'Trials of cullet use in road surfacing and insulation manufacturing.'
    },
    SamplingPlan: {
      SectionStatus: 'Started',
      Files: [
        {
          FileId: 'file003',
          Filename: 'code-nightmare-green.pdf',
          UploadedAt: '2026-11-01T12:00:00Z',
          UploadedBy: 'Jane Doe',
          ScanStatus: 'Clean'
        }
      ]
    }
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
        AccreditationReference: app?.AccreditationReference ?? 'REF-STUB-001'
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
