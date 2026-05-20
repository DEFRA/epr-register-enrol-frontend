const STUB_APPLICATIONS = [
  {
    organisationId: 50001,
    applicationId: 'app001',
    registrationReference: 'APP2027ER5000390PL',
    accreditationReference: 'R26ER5000390068PL',
    applicationStatus: 'Started',
    materialType: 'Plastic',
    siteId: 'site001',
    siteAddress: 'UNIT 5, BL4 7AQ, UK',
    organisationName: 'NEWDEV RECYCLING LIMITED',
    year: 2027,
    dateSent: null,
    submittedBy: null,
    prns: {
      sectionStatus: 'NotStarted',
      plannedTonnageBand: null,
      authorisers: []
    },
    businessPlan: {
      sectionStatus: 'NotStarted',
      newInfrastructurePercent: 0,
      priceSupportPercent: 0,
      businessCollectionsPercent: 0,
      communicationsPercent: 0,
      newMarketsPercent: 0,
      newUsesPercent: 0
    },
    samplingPlan: { sectionStatus: 'NotStarted', files: [] }
  },
  {
    organisationId: 50001,
    applicationId: 'app002',
    registrationReference: 'R26ER5000390068PL',
    accreditationReference: 'APP2027ER5000390GL',
    applicationStatus: 'Started',
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
    accreditationReference: 'R26ER5000390068PL',
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
  },

  {
    organisationId: 50003,
    applicationId: 'app004exp',
    accreditationReference: 'APP2027ER5000390SL',
    applicationStatus: 'Started',
    materialType: 'Steel',
    siteId: null,
    siteAddress: null,
    organisationName: 'Export Steel Ltd.',
    year: 2027,
    dateSent: '2026-12-01T10:00:00Z',
    submittedBy: 'Jane Doe',
    tonnage: {
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
    },
    overseasSites: [
      {
        siteName: 'Site 1',
        siteAddress: 'Address 123',
        country: 'Germany',
        isEu: true,
        isOECD: true,
        bESEvidence: {
          bESEvidenceUploads: [
            {
              bESEvidenceValidFromDate: '2026-11-01T12:00:00Z',
              bESEvidenceExpiryDate: '2027-11-30T12:00:00Z',
              fileId: 'file003',
              filename: 'code-nightmare-green.pdf',
              uploadedAt: '2026-11-01T12:00:00Z',
              uploadedBy: 'Jane Doe',
              scanStatus: 'Clean'
            }
          ],
          doYouWantToUploadMoreEvidence: false
          //No (it’s always no, as answering no to this question is the trigger for the check your answers page appearing)
          //we loop until they say No/false to this question, when they say no we stop uplaoding more files and take them to the check answers page
        }
      },
      {
        siteName: 'Site 2',
        siteAddress: 'Address 456',
        country: 'Chad',
        isEu: false
      }
    ]
  }
]

const STUB_ORGANISATIONS = [
  { id: 50001, name: 'NEWDEV RECYCLING LIMITED' },
  { id: 50002, name: 'Delta Green Recycling Co' }
]

export const STUB_ORG_MODELS = {
  50001: {
    orgId: 50001,
    schemaVersion: 1,
    version: 1,
    companyDetails: { name: 'NEWDEV RECYCLING LIMITED' },
    registrations: [
      {
        siteId: 'site001',
        material: 'Plastic',
        wasteProcessingType: 'reprocessor',
        siteAddress: {
          line1: 'UNIT 5, BL4 7AQ, UK',
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
    companyDetails: { name: 'Delta Green Recycling Co' },
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
        organisationId,
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
        accreditationReference: app?.accreditationReference ?? 'REF-STUB-001'
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
