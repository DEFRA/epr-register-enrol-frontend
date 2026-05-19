const STUB_APPLICATIONS = [
  {
    OrganisationId: 'org001',
    ApplicationId: 'app001',
    SiteId: 'site001',
    IsExporter: false,
    RegistrationReference: 'R26ER5000390068PL',
    AccreditationReference: 'APP2027ER5000390PL',
    ApplicationStatus: 'NotStarted',
    MaterialType: 'Plastic',
    SiteAddress: 'UNIT 5, BL4 7AQ, UK',
    OrganisationName: 'NEWDEV RECYCLING LIMITED',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Tonnage: {
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
    AccreditationReference: 'APP2027ER5000390GL',
    ApplicationStatus: 'Started',
    IsExporter: false,
    MaterialType: 'Glass',
    SiteId: 'site002',
    SiteAddress: 'Site Lane 002, Siteville, SIT3 OO2',
    OrganisationName: 'Beta Recycling Co',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Tonnage: {
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
    AccreditationReference: 'APP2027ER5000390SL',
    ApplicationStatus: 'Started',
    IsExporter: true,
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
    OverseasSites: {
      SectionStatus: 'InProgress',
      Sites: [
        {
          SiteId: 900001,
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
            // DoYouWantToUploadMoreEvidence: false triggers check-your-answers;
            // the loop continues while true
            DoYouWantToUploadMoreEvidence: false
          }
        },
        {
          SiteId: 900002,
          SiteName: 'Site 2',
          SiteAddress: 'Address 456',
          Country: 'Chad',
          IsEu: false
        }
      ]
    },
    BesEvidence: { SectionStatus: 'NotStarted' }
  },
  {
    OrganisationId: 'org003',
    ApplicationId: 'app003',
    AccreditationReference: 'APP2027ER5000390GL',
    ApplicationStatus: 'Started',
    IsExporter: false,
    MaterialType: 'Glass',
    SiteId: 'site003',
    SiteAddress: 'The Laundry, Siteville, SIT3 OO2',
    OrganisationName: 'Delta Green Recycling Co',
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
      SectionStatus: 'Completed',
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
  },
  {
    OrganisationId: 'org005exp',
    ApplicationId: 'app005exp',
    AccreditationReference: 'APP2027ER5000391PL',
    ApplicationStatus: 'Started',
    IsExporter: true,
    MaterialType: 'Plastic',
    SiteId: null,
    SiteAddress: null,
    OrganisationName: 'Plastic Exports Ltd.',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Tonnage: {
      SectionStatus: 'NotStarted',
      PlannedTonnageBand: null,
      Authorisers: []
    },
    BusinessPlan: { SectionStatus: 'NotStarted' },
    SamplingPlan: { SectionStatus: 'NotStarted', Files: [] },
    OverseasSites: {
      SectionStatus: 'NotStarted',
      Sites: []
    },
    BesEvidence: { SectionStatus: 'NotStarted' }
  },
  {
    OrganisationId: 'org006exp',
    ApplicationId: 'app006exp',
    AccreditationReference: 'APP2027ER5000392GL',
    ApplicationStatus: 'Started',
    IsExporter: true,
    MaterialType: 'Glass',
    SiteId: null,
    SiteAddress: null,
    OrganisationName: 'Global Glass Exports Co.',
    Year: 2027,
    DateSent: null,
    SubmittedBy: null,
    Tonnage: {
      SectionStatus: 'Completed',
      PlannedTonnageBand: 'UpTo10000',
      Authorisers: [
        { FullName: 'Alice Green', Email: 'alice@globalglassexp.co.uk' }
      ]
    },
    BusinessPlan: {
      SectionStatus: 'Completed',
      NewInfrastructurePercent: 20,
      PriceSupportPercent: 20,
      BusinessCollectionsPercent: 20,
      CommunicationsPercent: 20,
      NewMarketsPercent: 10,
      NewUsesPercent: 10
    },
    SamplingPlan: {
      SectionStatus: 'Completed',
      Files: [
        {
          FileId: 'file006',
          Filename: 'sampling-plan-glass.pdf',
          UploadedAt: '2026-12-01T10:00:00Z',
          UploadedBy: 'Alice Green',
          ScanStatus: 'Clean'
        }
      ]
    },
    OverseasSites: {
      SectionStatus: 'InProgress',
      Sites: [
        {
          SiteId: 900003,
          SiteName: 'Rotterdam Recycling BV',
          SiteAddress: 'Industrieweg 44, Rotterdam',
          Country: 'Netherlands',
          IsEu: true,
          IsOECD: true,
          BESEvidence: {
            BESEvidenceUploads: [],
            DoYouWantToUploadMoreEvidence: false
          }
        },
        {
          SiteId: 900004,
          SiteName: 'Berlin Glass GmbH',
          SiteAddress: 'Recyclingstraße 12, Berlin',
          Country: 'Germany',
          IsEu: true,
          IsOECD: true,
          BESEvidence: {
            BESEvidenceUploads: [],
            DoYouWantToUploadMoreEvidence: false
          }
        }
      ]
    },
    BesEvidence: { SectionStatus: 'NotStarted' }
  }
]

const STUB_ORGANISATIONS = [
  { id: 'org001', name: 'Stub Organisation Ltd' },
  { id: 'org002', name: 'Beta Recycling Co' }
]

const APP_PATH_RE =
  /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+?)(?:\/([^/]+))?$/

const SECTION_KEY_MAP = {
  tonnage: 'Tonnage',
  'business-plan': 'BusinessPlan',
  'sampling-plan': 'SamplingPlan',
  'overseas-sites': 'OverseasSites',
  'bes-evidence': 'BesEvidence'
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
      // Exporter seed: /{orgId}/{material}/seed — 7 parts total
      // Reprocessor seed: /{orgId}/{siteId}/{material}/seed — 8 parts total
      const isExporterSeed = parts.length === 7
      const organisationId = isExporterSeed
        ? parts[parts.length - 3]
        : parts[parts.length - 4]
      const index = STUB_APPLICATIONS.findIndex(
        (x) => x.OrganisationId === organisationId
      )

      return Promise.resolve({
        ...STUB_APPLICATIONS[index],
        OrganisationId: organisationId,
        IsExporter: isExporterSeed,
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
    // BES evidence file upload: /overseas-sites/{siteId}/bes-evidence/files
    if (/\/overseas-sites\/\d+\/bes-evidence\/files$/.test(endpoint)) {
      const appMatch = endpoint.match(
        /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence\/files/
      )
      if (appMatch) {
        const app = STUB_APPLICATIONS.find(
          (a) => a.ApplicationId === appMatch[1]
        )
        const siteId = parseInt(appMatch[2], 10)
        const site = app?.OverseasSites?.Sites?.find((s) => s.SiteId === siteId)
        const newFile = {
          FileId: `stub-bes-${Date.now()}`,
          Filename: body?.Filename ?? 'unknown',
          BESEvidenceValidFromDate: body?.BESEvidenceValidFromDate ?? null,
          BESEvidenceExpiryDate: body?.BESEvidenceExpiryDate ?? null,
          UploadedAt: new Date().toISOString(),
          UploadedBy: 'Stub User',
          ScanStatus: 'Clean'
        }
        if (site) {
          if (!site.BESEvidence) {
            site.BESEvidence = { BESEvidenceUploads: [] }
          }
          if (!site.BESEvidence.BESEvidenceUploads) {
            site.BESEvidence.BESEvidenceUploads = []
          }
          site.BESEvidence.BESEvidenceUploads.push(newFile)
        }
        return Promise.resolve({ FileId: newFile.FileId })
      }
    }
    // Sampling plan file upload: /files
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
    // BES evidence patch: /overseas-sites/{siteId}/bes-evidence
    if (/\/overseas-sites\/\d+\/bes-evidence$/.test(endpoint)) {
      const appMatch = endpoint.match(
        /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence/
      )
      if (appMatch) {
        const app = STUB_APPLICATIONS.find(
          (a) => a.ApplicationId === appMatch[1]
        )
        const siteId = parseInt(appMatch[2], 10)
        const site = app?.OverseasSites?.Sites?.find((s) => s.SiteId === siteId)
        if (site) {
          if (!site.BESEvidence) site.BESEvidence = {}
          Object.assign(site.BESEvidence, body)
        }
      }
      return Promise.resolve({})
    }
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
    // BES evidence file delete: /overseas-sites/{siteId}/bes-evidence/files/{fileId}
    const besMatch = endpoint.match(
      /\/api\/v1\/accreditation-applications\/[^/]+\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence\/files\/([^/]+)$/
    )
    if (besMatch) {
      const app = STUB_APPLICATIONS.find((a) => a.ApplicationId === besMatch[1])
      const siteId = parseInt(besMatch[2], 10)
      const site = app?.OverseasSites?.Sites?.find((s) => s.SiteId === siteId)
      if (site?.BESEvidence?.BESEvidenceUploads) {
        site.BESEvidence.BESEvidenceUploads =
          site.BESEvidence.BESEvidenceUploads.filter(
            (f) => f.FileId !== besMatch[3]
          )
      }
      return Promise.resolve(undefined)
    }
    // Sampling plan file delete: /files/{fileId}
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
