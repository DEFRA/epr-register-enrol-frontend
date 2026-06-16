const BP_CATEGORIES = [
  'newInfrastructure',
  'priceSupport',
  'businessCollections',
  'communications',
  'newMarkets',
  'newUses'
]

function makeBpItems(percents = {}, details = {}) {
  return BP_CATEGORIES.map((category) => ({
    category,
    percentSpent: percents[category] ?? 0,
    detailedDescription: details[category] ?? ''
  }))
}

const STUB_ORG_DOCS = [
  {
    orgId: 50001,
    companyDetails: { name: 'NEWDEV RECYCLING LIMITED' },
    accreditations: [
      {
        id: 'app001',
        applicationId: 'APP2027ER5000390PL',
        applicationStatus: 'NotStarted',
        material: 'plastic',
        wasteProcessingType: 'reprocessor',
        registrationId: 'REG001',
        siteAddress: { line1: 'UNIT 5', town: 'Bolton', postcode: 'BL4 7AQ' },
        wasteRegistrationNumber: 'R26ER5000390068PL',
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: null,
        submitterContactDetails: null,
        prnIssuance: {
          sectionStatus: 'NotStarted',
          plannedIssuance: null,
          signatories: []
        },
        businessPlan: {
          sectionStatus: 'NotStarted',
          items: makeBpItems()
        },
        samplingPlan: { sectionStatus: 'NotStarted', files: [] }
      }
    ]
  },
  {
    orgId: 50002,
    companyDetails: { name: 'Beta Recycling Co' },
    accreditations: [
      {
        id: 'app002',
        applicationId: 'APP2027ER5000390GL',
        applicationStatus: 'Started',
        material: 'glass',
        wasteProcessingType: 'reprocessor',
        registrationId: 'REG002',
        siteAddress: {
          line1: 'Site Lane 002',
          town: 'Siteville',
          postcode: 'SIT3 OO2'
        },
        wasteRegistrationNumber: 'R26ER5000390068PL',
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: null,
        submitterContactDetails: null,
        prnIssuance: {
          sectionStatus: 'NotStarted',
          plannedIssuance: null,
          signatories: []
        },
        businessPlan: { sectionStatus: 'NotStarted', items: [] },
        samplingPlan: { sectionStatus: 'NotStarted', files: [] }
      }
    ]
  },
  {
    orgId: 50003,
    companyDetails: { name: 'Delta Green Recycling Co' },
    accreditations: [
      {
        id: 'app003',
        applicationId: 'APP2027ER5000390GL',
        applicationStatus: 'Started',
        material: 'glass',
        wasteProcessingType: 'reprocessor',
        registrationId: 'REG003',
        siteAddress: {
          line1: 'The Laundry',
          town: 'Siteville',
          postcode: 'SIT3 OO2'
        },
        wasteRegistrationNumber: null,
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: '2026-12-01T10:00:00Z',
        submitterContactDetails: {
          fullName: 'Jane Doe',
          email: 'jane@deltagreen.co.uk',
          role: 'Manager'
        },
        prnIssuance: {
          sectionStatus: 'Completed',
          plannedIssuance: 'UpTo1000',
          signatories: [
            { fullName: 'Jane Doe', email: 'jane@deltagreen.co.uk' }
          ]
        },
        businessPlan: {
          sectionStatus: 'Completed',
          items: makeBpItems(
            {
              newInfrastructure: 30,
              priceSupport: 20,
              businessCollections: 15,
              communications: 10,
              newMarkets: 15,
              newUses: 10
            },
            {
              newInfrastructure:
                'Investment in new sorting and processing equipment at the Delta Green Recycling site.',
              priceSupport:
                'Price support payments to collectors to maintain viability of glass collection routes.',
              businessCollections:
                'Expansion of commercial and industrial glass collection services across the region.',
              communications:
                'Public awareness campaign promoting glass recycling and correct bin usage.',
              newMarkets:
                'Development of relationships with construction sector to use recycled glass aggregate.',
              newUses:
                'Trials of cullet use in road surfacing and insulation manufacturing.'
            }
          )
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
        overseasSites: {
          sectionStatus: 'InProgress',
          sites: [
            {
              siteId: 900001,
              siteName: 'Site 1',
              siteAddress: 'Address 123',
              country: 'Germany',
              isEu: true,
              isOecd: true,
              besEvidence: {
                besEvidenceUploads: [
                  {
                    besEvidenceValidFromDate: '2026-11-01T12:00:00Z',
                    besEvidenceExpiryDate: '2027-11-30T12:00:00Z',
                    fileId: 'file003',
                    filename: 'code-nightmare-green.pdf',
                    uploadedAt: '2026-11-01T12:00:00Z',
                    uploadedBy: 'Jane Doe',
                    scanStatus: 'Clean'
                  }
                ],
                doYouWantToUploadMoreEvidence: false
              }
            },
            {
              siteId: 900002,
              siteName: 'Site 2',
              siteAddress: 'Address 456',
              country: 'Chad',
              isEu: false
            }
          ]
        },
        besEvidence: { sectionStatus: 'NotStarted' }
      }
    ]
  },
  {
    orgId: 50004,
    companyDetails: { name: 'Export Steel Ltd.' },
    accreditations: [
      {
        id: 'app004exp',
        applicationId: 'APP2027ER5000390SL',
        applicationStatus: 'Started',
        material: 'steel',
        wasteProcessingType: 'exporter',
        siteId: null,
        siteAddress: null,
        wasteRegistrationNumber: null,
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: '2026-12-01T10:00:00Z',
        submitterContactDetails: {
          fullName: 'Jane Doe',
          email: 'jane@deltagreen.co.uk',
          role: 'Manager'
        },
        prnIssuance: {
          sectionStatus: 'Completed',
          plannedIssuance: 'UpTo1000',
          signatories: [
            { fullName: 'Jane Doe', email: 'jane@deltagreen.co.uk' }
          ]
        },
        businessPlan: {
          sectionStatus: 'Completed',
          items: makeBpItems(
            {
              newInfrastructure: 30,
              priceSupport: 20,
              businessCollections: 15,
              communications: 10,
              newMarkets: 15,
              newUses: 10
            },
            {
              newInfrastructure:
                'Investment in new sorting and processing equipment at the Delta Green Recycling site.',
              priceSupport:
                'Price support payments to collectors to maintain viability of glass collection routes.',
              businessCollections:
                'Expansion of commercial and industrial glass collection services across the region.',
              communications:
                'Public awareness campaign promoting glass recycling and correct bin usage.',
              newMarkets:
                'Development of relationships with construction sector to use recycled glass aggregate.',
              newUses:
                'Trials of cullet use in road surfacing and insulation manufacturing.'
            }
          )
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
        overseasSites: {
          sectionStatus: 'InProgress',
          sites: [
            {
              siteId: 900001,
              siteName: 'Site 1',
              siteAddress: 'Address 123',
              country: 'Germany',
              isEu: true,
              isOecd: true,
              besEvidence: {
                besEvidenceUploads: [
                  {
                    besEvidenceValidFromDate: '2026-11-01T12:00:00Z',
                    besEvidenceExpiryDate: '2027-11-30T12:00:00Z',
                    fileId: 'file003',
                    filename: 'code-nightmare-green.pdf',
                    uploadedAt: '2026-11-01T12:00:00Z',
                    uploadedBy: 'Jane Doe',
                    scanStatus: 'Clean'
                  }
                ],
                doYouWantToUploadMoreEvidence: false
              }
            },
            {
              siteId: 900002,
              siteName: 'Site 2',
              siteAddress: 'Address 456',
              country: 'Chad',
              isEu: false
            }
          ]
        },
        besEvidence: { sectionStatus: 'InProgress' }
      }
    ]
  },
  {
    orgId: 50005,
    companyDetails: { name: 'Plastic Exports Ltd.' },
    accreditations: [
      {
        id: 'app005exp',
        applicationId: 'APP2027ER5000391PL',
        applicationStatus: 'Started',
        material: 'plastic',
        wasteProcessingType: 'exporter',
        siteId: null,
        siteAddress: null,
        wasteRegistrationNumber: 'R26ER5000390068PL',
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: null,
        submitterContactDetails: null,
        prnIssuance: {
          sectionStatus: 'NotStarted',
          plannedIssuance: null,
          signatories: []
        },
        businessPlan: { sectionStatus: 'NotStarted', items: [] },
        samplingPlan: {
          sectionStatus: 'Started',
          files: [
            {
              fileId: 'file005',
              filename: 'code5-nightmare-green.pdf',
              uploadedAt: '2026-11-01T12:00:00Z',
              uploadedBy: 'Jane Doe',
              scanStatus: 'Clean'
            }
          ]
        },
        overseasSites: {
          sectionStatus: 'NotStarted',
          sites: [
            {
              siteId: 900001,
              siteName: 'Rotterdam Recycling BV',
              siteAddress: 'Industrieweg 44, Rotterdam',
              country: 'Netherlands',
              isEu: true,
              isOecd: true,
              selected: true,
              besEvidence: {
                besEvidenceUploads: [],
                doYouWantToUploadMoreEvidence: false
              }
            }
          ]
        },
        besEvidence: { sectionStatus: 'NotStarted' }
      }
    ]
  },
  {
    orgId: 50006,
    companyDetails: { name: 'Global Glass Exports Co.' },
    accreditations: [
      {
        id: 'app006exp',
        applicationId: 'APP2027ER5000392GL',
        applicationStatus: 'Started',
        material: 'glass',
        wasteProcessingType: 'exporter',
        siteId: null,
        siteAddress: null,
        wasteRegistrationNumber: null,
        yearlyMetrics: { year: '2027' },
        formSubmissionTime: null,
        submitterContactDetails: null,
        prnIssuance: {
          sectionStatus: 'Completed',
          plannedIssuance: 'UpTo10000',
          signatories: [
            { fullName: 'Alice Green', email: 'alice@globalglassexp.co.uk' }
          ]
        },
        businessPlan: {
          sectionStatus: 'Completed',
          items: makeBpItems({
            newInfrastructure: 20,
            priceSupport: 20,
            businessCollections: 20,
            communications: 20,
            newMarkets: 10,
            newUses: 10
          })
        },
        samplingPlan: {
          sectionStatus: 'Completed',
          files: [
            {
              fileId: 'file006',
              filename: 'sampling-plan-glass.pdf',
              uploadedAt: '2026-12-01T10:00:00Z',
              uploadedBy: 'Alice Green',
              scanStatus: 'Clean'
            }
          ]
        },
        overseasSites: {
          sectionStatus: 'InProgress',
          sites: [
            {
              siteId: 900003,
              siteName: 'Rotterdam Recycling BV',
              siteAddress: 'Industrieweg 44, Rotterdam',
              country: 'Netherlands',
              isEu: true,
              isOecd: true,
              selected: true,
              besEvidence: {
                besEvidenceUploads: [],
                doYouWantToUploadMoreEvidence: false
              }
            },
            {
              siteId: 900004,
              siteName: 'Berlin Glass GmbH',
              siteAddress: 'Recyclingstraße 12, Berlin',
              country: 'Germany',
              isEu: true,
              isOecd: true,
              selected: true,
              besEvidence: {
                besEvidenceUploads: [],
                doYouWantToUploadMoreEvidence: false
              }
            },
            {
              siteId: 900005,
              siteName: 'Paris Verre SAS',
              siteAddress: '8 Rue du Recyclage, Paris',
              country: 'France',
              isEu: true,
              isOecd: true,
              selected: false,
              besEvidence: {
                besEvidenceUploads: [],
                doYouWantToUploadMoreEvidence: false
              }
            }
          ]
        },
        besEvidence: { sectionStatus: 'NotStarted' }
      }
    ]
  }
]

const STUB_ORGANISATIONS = [
  { id: 50001, name: 'NEWDEV RECYCLING LIMITED' },
  { id: 50002, name: 'Beta Recycling Co' }
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
        material: 'plastic',
        wasteProcessingType: 'reprocessor',
        siteAddress: {
          line1: 'UNIT 5',
          town: 'Bolton',
          postcode: 'BL4 7AQ',
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
        material: 'glass',
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

// Matches /{orgId}/{itemId}[/{section}] at end of path
// Does NOT match BES evidence paths (too many segments)
const APP_PATH_RE =
  /\/api\/v1\/accreditation-applications\/([^/]+)\/([^/]+?)(?:\/([^/]+))?$/

const SECTION_KEY_MAP = {
  prns: 'prnIssuance',
  tonnage: 'prnIssuance',
  'sampling-plan': 'samplingPlan',
  'overseas-sites': 'overseasSites',
  'bes-evidence': 'besEvidence'
}

function findOrgDoc(orgId) {
  return STUB_ORG_DOCS.find((d) => String(d.orgId) === String(orgId)) ?? null
}

function findAccreditation(orgId, itemId) {
  const doc = findOrgDoc(orgId)
  if (!doc) return null
  return doc.accreditations.find((a) => a.id === itemId) ?? null
}

function withOrgData(doc, item) {
  return { orgId: doc.orgId, companyName: doc.companyDetails?.name, ...item }
}

function parseEndpoint(endpoint) {
  const match = endpoint.match(APP_PATH_RE)
  if (!match) return null
  return { orgId: match[1], itemId: match[2], section: match[3] ?? null }
}

function mergeBpItems(existing, incoming) {
  const merged = [...existing]
  for (const incomingItem of incoming) {
    const idx = merged.findIndex((i) => i.category === incomingItem.category)
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...incomingItem }
    } else {
      merged.push({ ...incomingItem })
    }
  }
  return merged
}

// In-memory store for stub CDP upload sessions (fileUploadId → scan result)
const stubPendingUploads = new Map()

export function stubCompleteUpload(fileUploadId, fileData) {
  stubPendingUploads.set(fileUploadId, fileData)
}

export const stubApiClient = {
  get(endpoint) {
    // CDP upload status — returns ready once stubCompleteUpload has been called
    const statusMatch = endpoint.match(/\/files\/([^/]+)\/status$/)
    if (statusMatch) {
      const fileUploadId = statusMatch[1]
      const fileData = stubPendingUploads.get(fileUploadId)
      if (!fileData) {
        return Promise.resolve({
          uploadStatus: 'pending',
          processingStatus: 'preprocessing'
        })
      }
      return Promise.resolve({
        uploadStatus: 'ready',
        processingStatus: 'validated',
        form: {
          file: {
            filename: fileData.filename ?? 'unknown',
            contentType: fileData.contentType ?? 'application/octet-stream',
            fileStatus: 'complete',
            fileId: `stub-file-${fileUploadId}`
          }
        }
      })
    }

    if (endpoint === '/organisation') {
      return Promise.resolve(STUB_ORGANISATIONS)
    }

    if (/\/api\/v1\/accreditation-applications\/[^/]+$/.test(endpoint)) {
      const m = endpoint.match(
        /\/api\/v1\/accreditation-applications\/([^/]+)$/
      )
      const doc = findOrgDoc(m[1])
      if (!doc) return Promise.resolve([])
      return Promise.resolve(
        doc.accreditations.map((item) => withOrgData(doc, item))
      )
    }

    const parsed = parseEndpoint(endpoint)
    if (!parsed) return Promise.resolve({})
    const { orgId, itemId } = parsed
    const doc = findOrgDoc(orgId)
    if (!doc) return Promise.resolve({})
    const item =
      doc.accreditations.find((a) => a.id === itemId) ?? doc.accreditations[0]
    if (!item) return Promise.resolve({})
    return Promise.resolve(withOrgData(doc, item))
  },

  post(endpoint, body) {
    // CDP upload initiation — returns stub uploadUrl/statusUrl for local dev
    if (/\/files\/initiate$/.test(endpoint)) {
      const fileUploadId = `stub-upload-${Date.now()}`
      // Derive a status path from the endpoint (swap /initiate for /status)
      const statusPath = endpoint.replace(
        /\/files\/initiate$/,
        `/files/${fileUploadId}/status`
      )
      return Promise.resolve({
        fileUploadId,
        uploadUrl: `http://localhost:3000/api/stub/upload/${fileUploadId}`,
        statusUrl: `http://localhost:3000${statusPath}`
      })
    }

    if (/\/seed$/.test(endpoint)) {
      const parts = endpoint.split('/')
      const isExporterSeed = parts.length === 7
      const orgId = isExporterSeed
        ? parts[parts.length - 3]
        : parts[parts.length - 4]
      const doc = findOrgDoc(orgId)
      const base = doc?.accreditations[0] ?? {}
      const seeded = {
        ...base,
        yearlyMetrics: { year: String(body?.year ?? new Date().getFullYear()) },
        applicationStatus: 'Saved',
        wasteProcessingType: isExporterSeed ? 'exporter' : 'reprocessor'
      }
      return Promise.resolve(
        withOrgData(doc ?? { orgId, companyDetails: {} }, seeded)
      )
    }

    if (/\/submit$/.test(endpoint)) {
      const parsed = parseEndpoint(endpoint)
      if (parsed) {
        const doc = findOrgDoc(parsed.orgId)
        const item = doc?.accreditations.find((a) => a.id === parsed.itemId)
        if (item) {
          item.applicationStatus = 'Sent'
          item.formSubmissionTime = new Date().toISOString()
          if (body) {
            item.submitterContactDetails = {
              fullName: body.name ?? body.fullName ?? '',
              email: body.email ?? '',
              role: body.jobTitle ?? body.role ?? ''
            }
          }
          return Promise.resolve({
            accreditationReference: item.applicationId
          })
        }
      }
      return Promise.resolve({ accreditationReference: 'REF-STUB-001' })
    }

    if (/\/overseas-sites\/\d+\/bes-evidence\/files$/.test(endpoint)) {
      const appMatch = endpoint.match(
        /\/api\/v1\/accreditation-applications\/([^/]+)\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence\/files/
      )
      if (appMatch) {
        const item = findAccreditation(appMatch[1], appMatch[2])
        const siteId = parseInt(appMatch[3], 10)
        const site = item?.overseasSites?.sites?.find(
          (s) => s.siteId === siteId
        )
        const newFile = {
          fileId: body?.fileId ?? `stub-bes-${Date.now()}`,
          filename: body?.filename ?? 'unknown',
          besEvidenceValidFromDate: body?.besEvidenceValidFromDate ?? null,
          besEvidenceExpiryDate: body?.besEvidenceExpiryDate ?? null,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Stub User',
          scanStatus: body?.scanStatus ?? 'Clean'
        }
        if (site) {
          if (!site.besEvidence) site.besEvidence = { besEvidenceUploads: [] }
          if (!site.besEvidence.besEvidenceUploads) {
            site.besEvidence.besEvidenceUploads = []
          }
          site.besEvidence.besEvidenceUploads.push(newFile)
        }
        return Promise.resolve({ fileId: newFile.fileId })
      }
    }

    if (/\/files$/.test(endpoint)) {
      const parsed = parseEndpoint(endpoint)
      const item = parsed
        ? findAccreditation(parsed.orgId, parsed.itemId)
        : null
      const newFile = {
        fileId: body?.fileId ?? `stub-file-${Date.now()}`,
        filename: body?.filename ?? 'unknown',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Stub User',
        scanStatus: body?.scanStatus ?? 'Clean'
      }
      if (item) {
        if (!item.samplingPlan.files) item.samplingPlan.files = []
        item.samplingPlan.files.push(newFile)
      }
      return Promise.resolve({ fileId: newFile.fileId })
    }

    return Promise.resolve({})
  },

  patch(endpoint, body) {
    if (/\/overseas-sites\/\d+\/bes-evidence$/.test(endpoint)) {
      const appMatch = endpoint.match(
        /\/api\/v1\/accreditation-applications\/([^/]+)\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence/
      )
      if (appMatch) {
        const item = findAccreditation(appMatch[1], appMatch[2])
        const siteId = parseInt(appMatch[3], 10)
        const site = item?.overseasSites?.sites?.find(
          (s) => s.siteId === siteId
        )
        if (site) {
          if (!site.besEvidence) site.besEvidence = {}
          Object.assign(site.besEvidence, body)
        }
      }
      return Promise.resolve({})
    }

    const parsed = parseEndpoint(endpoint)
    if (!parsed) return Promise.resolve({})
    const { orgId, itemId, section } = parsed
    const doc = findOrgDoc(orgId)
    if (!doc) return Promise.resolve({})
    const item = doc.accreditations.find((a) => a.id === itemId)
    if (!item || !section) return Promise.resolve({})

    if (section === 'business-plan') {
      if (body.items) {
        if (!item.businessPlan.items) item.businessPlan.items = []
        item.businessPlan.items = mergeBpItems(
          item.businessPlan.items,
          body.items
        )
      }
      if (body.sectionStatus !== undefined) {
        item.businessPlan.sectionStatus = body.sectionStatus
      }
    } else {
      const key = SECTION_KEY_MAP[section]
      if (key) Object.assign(item[key], body)
    }

    return Promise.resolve(withOrgData(doc, item))
  },

  put() {
    return Promise.resolve({})
  },

  delete(endpoint) {
    const besMatch = endpoint.match(
      /\/api\/v1\/accreditation-applications\/([^/]+)\/([^/]+)\/overseas-sites\/(\d+)\/bes-evidence\/files\/([^/]+)$/
    )
    if (besMatch) {
      const item = findAccreditation(besMatch[1], besMatch[2])
      const siteId = parseInt(besMatch[3], 10)
      const site = item?.overseasSites?.sites?.find((s) => s.siteId === siteId)
      if (site?.besEvidence?.besEvidenceUploads) {
        site.besEvidence.besEvidenceUploads =
          site.besEvidence.besEvidenceUploads.filter(
            (f) => f.fileId !== besMatch[4]
          )
      }
      return Promise.resolve(undefined)
    }

    const fileMatch = endpoint.match(
      /\/api\/v1\/accreditation-applications\/([^/]+)\/([^/]+)\/files\/([^/]+)$/
    )
    if (fileMatch) {
      const item =
        findAccreditation(fileMatch[1], fileMatch[2]) ??
        STUB_ORG_DOCS[0].accreditations[0]
      if (item.samplingPlan?.files) {
        item.samplingPlan.files = item.samplingPlan.files.filter(
          (f) => f.fileId !== fileMatch[3]
        )
      }
    }
    return Promise.resolve(undefined)
  }
}
