import { isValid, parseISO } from 'date-fns'

import { apiClient } from '../api-client.js'
import { retryWithBackoff } from './retryWithBackoff.js'

const BASE = '/api/v1/accreditation-applications'

function appBase(organisationId, applicationId) {
  return `${BASE}/${organisationId}/${applicationId}`
}

function normaliseError(err) {
  const status = err.status ?? 500
  const message = err.message ?? 'Unknown error'
  const normalised = new Error(message)
  normalised.status = status
  normalised.response = err.response
  normalised.isApiError = true
  return normalised
}

async function call(fn) {
  try {
    return await fn()
  } catch (err) {
    throw normaliseError(err)
  }
}

// ---------------------------------------------------------------------------
// Schema normalisation
// ---------------------------------------------------------------------------

const BP_CATEGORIES = [
  {
    category: 'newInfrastructure',
    percent: 'newInfrastructurePercent',
    detail: 'newInfrastructureDetail'
  },
  {
    category: 'priceSupport',
    percent: 'priceSupportPercent',
    detail: 'priceSupportDetail'
  },
  {
    category: 'businessCollections',
    percent: 'businessCollectionsPercent',
    detail: 'businessCollectionsDetail'
  },
  {
    category: 'communications',
    percent: 'communicationsPercent',
    detail: 'communicationsDetail'
  },
  {
    category: 'newMarkets',
    percent: 'newMarketsPercent',
    detail: 'newMarketsDetail'
  },
  {
    category: 'newUses',
    percent: 'newUsesPercent',
    detail: 'newUsesDetail'
  }
]

function normalizeBp(bp) {
  if (!bp) return { sectionStatus: 'NotStarted', items: [] }
  if (bp.items !== undefined) return bp
  // Legacy flat format → convert to { sectionStatus, items }
  const { sectionStatus = 'NotStarted' } = bp
  const items = BP_CATEGORIES.map(({ category, percent, detail }) => ({
    category,
    percentSpent: bp[percent] ?? 0,
    detailedDescription: bp[detail] ?? ''
  }))
  return { sectionStatus, items }
}

const UK_POSTCODE_REGEX = /[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}/i

function extractPostcodeFromAddressString(address) {
  const match = address?.match(UK_POSTCODE_REGEX)
  return match ? match[0].toUpperCase().replace(/\s+/, ' ') : null
}

// The registered address is a UK CompanyDetails.Address (Line1/Line2/Town/
// County/Postcode) rather than the overseas/reprocessing-site address, so it
// gets its own formatter distinct from siteAddress above.
function formatRegisteredAddress(addr) {
  if (!addr) return null
  if (typeof addr === 'string') return addr
  return (
    [addr.line1, addr.line2, addr.town, addr.county, addr.postcode]
      .filter(Boolean)
      .join(', ') || null
  )
}

// The backend may return a dueDate that isn't a parseable ISO string; the
// formatDate nunjucks filter throws on an Invalid Date, so treat anything
// unparseable as absent rather than crashing the page.
function normalizeDueDate(dueDate) {
  if (typeof dueDate !== 'string' || !dueDate) return null
  return isValid(parseISO(dueDate)) ? dueDate : null
}

function normalizeApplication(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const sa = item.siteAddress
  const siteAddress =
    sa && typeof sa === 'object'
      ? [sa.line1, sa.town, sa.postcode].filter(Boolean).join(', ')
      : typeof sa === 'string'
        ? sa
        : null
  const sitePostcode =
    sa && typeof sa === 'object'
      ? (sa.postcode ?? null)
      : typeof sa === 'string'
        ? extractPostcodeFromAddressString(sa)
        : null
  return {
    ...item,
    // item.id = internal UUID used in URLs; item.applicationId = human-readable ref (new schema)
    applicationId: item.id?.toString() ?? item.applicationId,
    // new schema: item.applicationReference holds the human-readable ref (APP2027...GL),
    // set by the backend once the application is submitted.
    // legacy/stub data: item.accreditationReference holds it instead.
    accreditationReference:
      item.applicationReference ?? item.accreditationReference ?? null,
    organisationId: item.orgId ?? item.organisationId,
    organisationName: item.companyName ?? item.organisationName ?? '',
    materialType: item.material
      ? item.material.charAt(0).toUpperCase() + item.material.slice(1)
      : (item.materialType ?? ''),
    isExporter:
      item.wasteProcessingType !== undefined
        ? item.wasteProcessingType === 'exporter'
        : (item.isExporter ?? false),
    siteAddress,
    sitePostcode,
    companyRegisteredAddress: formatRegisteredAddress(
      item.companyRegisteredAddress
    ),
    registrationId: item.registrationId ?? null,
    year: item.yearlyMetrics?.year
      ? parseInt(item.yearlyMetrics.year, 10)
      : typeof item.year === 'string'
        ? parseInt(item.year, 10)
        : (item.year ?? null),
    dateSent: item.formSubmissionTime ?? item.dateSent ?? null,
    applicationStatus: item.applicationStatus,
    registrationReference:
      item.registrationId ?? item.wasteRegistrationNumber ?? null,
    submittedBy: item.submitterContactDetails
      ? {
          name: item.submitterContactDetails.fullName ?? '',
          email: item.submitterContactDetails.email ?? '',
          jobTitle: item.submitterContactDetails.role ?? ''
        }
      : (item.submittedBy ?? null),
    prns: item.prnIssuance
      ? {
          sectionStatus: item.prnIssuance.sectionStatus ?? 'NotStarted',
          plannedTonnageBand: item.prnIssuance.plannedIssuance ?? null,
          authorisers: item.prnIssuance.signatories ?? []
        }
      : item.prns,
    businessPlan: normalizeBp(item.businessPlan),
    samplingPlan: item.samplingPlan,
    overseasSites: item.overseasSites,
    besEvidence: item.besEvidence,
    query: item.query ?? null,
    dueDate: normalizeDueDate(item.dueDate ?? null)
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const accreditationApiService = {
  seedApplication(organisationId, registrationId, materialType, year) {
    return call(async () => {
      const r = await apiClient.post(
        `${BASE}/${organisationId}/${registrationId}/${materialType}/seed`,
        { year }
      )
      return normalizeApplication(r)
    })
  },

  seedExporterApplication(organisationId, materialType, year) {
    return call(async () => {
      const r = await apiClient.post(
        `${BASE}/${organisationId}/${materialType}/seed`,
        { year }
      )
      return normalizeApplication(r)
    })
  },

  listApplications(organisationId) {
    return call(async () => {
      const r = await apiClient.get(`${BASE}/${organisationId}`)
      return Array.isArray(r) ? r.map(normalizeApplication) : r
    })
  },

  getApplication(organisationId, applicationId) {
    return call(async () => {
      const r = await apiClient.get(appBase(organisationId, applicationId))
      return normalizeApplication(r)
    })
  },

  patchTonnage(organisationId, applicationId, body) {
    return call(async () => {
      const r = await apiClient.patch(
        `${appBase(organisationId, applicationId)}/tonnage`,
        body
      )
      return normalizeApplication(r)
    })
  },

  patchBusinessPlan(organisationId, applicationId, body) {
    return call(async () => {
      const r = await apiClient.patch(
        `${appBase(organisationId, applicationId)}/business-plan`,
        body
      )
      return normalizeApplication(r)
    })
  },

  patchSamplingPlan(organisationId, applicationId, body) {
    return call(async () => {
      const r = await apiClient.patch(
        `${appBase(organisationId, applicationId)}/sampling-plan`,
        body
      )
      return normalizeApplication(r)
    })
  },

  patchOverseasSites(organisationId, applicationId, body) {
    return call(async () => {
      const r = await apiClient.patch(
        `${appBase(organisationId, applicationId)}/overseas-sites`,
        body
      )
      return normalizeApplication(r)
    })
  },

  addBesEvidenceFile(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence/files`,
        body
      )
    )
  },

  patchBesEvidence(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.patch(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence`,
        body
      )
    )
  },

  deleteBesEvidenceFile(organisationId, applicationId, siteId, fileId) {
    return call(() =>
      apiClient.delete(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/bes-evidence/files/${fileId}`
      )
    )
  },

  patchBesEvidenceSection(organisationId, applicationId, body) {
    return call(async () => {
      const r = await apiClient.patch(
        `${appBase(organisationId, applicationId)}/bes-evidence`,
        body
      )
      return normalizeApplication(r)
    })
  },

  createOverseasSite(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites`,
        body
      )
    )
  },

  promoteOverseasSite(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/promote`,
        body
      )
    )
  },

  revertOverseasSite(organisationId, applicationId, siteId) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/revert`
      )
    )
  },

  createInterimSite(organisationId, applicationId, siteId, body) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/overseas-sites/${siteId}/interim-site`,
        body
      )
    )
  },

  submitApplication(organisationId, applicationId, body, options) {
    return call(() =>
      apiClient.post(
        `${appBase(organisationId, applicationId)}/submit`,
        body,
        options
      )
    )
  },

  resubmitApplication(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(`${appBase(organisationId, applicationId)}/resubmit`, body)
    )
  },

  withdrawApplication(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(`${appBase(organisationId, applicationId)}/withdraw`, body)
    )
  },

  addFile(organisationId, applicationId, body) {
    return call(() =>
      apiClient.post(`${appBase(organisationId, applicationId)}/files`, body)
    )
  },

  deleteFile(organisationId, applicationId, fileId) {
    return call(async () => {
      try {
        return await retryWithBackoff(
          () =>
            apiClient.delete(
              `${appBase(organisationId, applicationId)}/files/${fileId}`
            ),
          // Don't burn the backoff window on a permanent failure (e.g. the
          // section is no longer editable) — only retry errors that could
          // plausibly be transient.
          { isRetryable: (err) => !err.status || err.status >= 500 }
        )
      } catch (err) {
        // A 404 means the file is already gone — including when an earlier
        // attempt's delete succeeded server-side but its response was lost,
        // which is the exact failure this retry was added to fix. Treat it
        // as success rather than retrying into (or surfacing) a false error.
        if (err.status === 404) return
        throw err
      }
    })
  }
}
