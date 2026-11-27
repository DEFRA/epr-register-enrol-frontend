// RA-492/RA-697/RA-682: the stub accreditation-changes API's views, built as
// the backend's AccreditationChangesView is. See stub-accreditation-changes.js.

import {
  ACTIVE_ITEM_STATUSES,
  CHANGE_TYPES,
  MISSING_CHANGES,
  ORS_ANSWER_FIELDS,
  ORS_UPDATE_DETAIL_FIELDS,
  SITE_ACCREDITATION_STATUSES,
  isOrsUpdate,
  orsUpdateDetailsOf
} from './constants/changeRequests.js'
import { isItemForSite } from './helpers/changeRequestSite.js'
import { hasValue } from './helpers/hasValue.js'
import { ORS_FEE, PENCE_PER_POUND } from './helpers/paymentDetails.js'
import { isQueried, queriedEffective, queryView } from './stub-queried-items.js'

export const LOCKABLE = ORS_ANSWER_FIELDS

const CHARGE_PER_SITE_PENCE = ORS_FEE * PENCE_PER_POUND

function besRequired(site, effective) {
  return !site.isEu && !site.isOecd && effective.conditionsOfExport !== true
}

export const isUpdate = isOrsUpdate

// Blank and missing are treated as the same answer. The backend stores a blank
// optional line as missing, so for what the forms send this matches it.
export function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return [a ?? []].flat().join() === [b ?? []].flat().join()
  }
  return (a ?? '') === (b ?? '')
}

// RA-682: an update's details as well as RA-697's fields. As the backend, an
// update that changes nothing yet is missing its changes; a seeded one has no
// proposed details or interim changes. New BES evidence is a change too.
function updateFields(site, entry) {
  const previous = orsUpdateDetailsOf(site)
  const proposed = entry.proposed ?? previous
  const interimSiteChanges = entry.interimSiteChanges ?? []
  const changed =
    interimSiteChanges.length > 0 ||
    entry.besEvidenceUploads.length > 0 ||
    ORS_UPDATE_DETAIL_FIELDS.some(
      (field) => !sameValue(proposed[field], previous[field])
    )
  return {
    siteName: proposed.siteName ?? entry.siteName ?? site.siteName,
    previous,
    proposed,
    interimSiteChanges,
    missingFields: changed ? [] : [MISSING_CHANGES],
    isComplete: changed
  }
}

// site is empty for an item whose site the view doesn't list.
function requestSiteView(site, entry) {
  const effective = Object.fromEntries(
    LOCKABLE.map((field) => [
      field,
      entry.answers[field] ?? site[field] ?? null
    ])
  )
  const required = besRequired(site, effective)
  const missingFields = LOCKABLE.filter((field) => !hasValue(effective[field]))
  if (required && entry.besEvidenceUploads.length === 0) {
    missingFields.push('besEvidence')
  }
  const view = {
    siteId: entry.siteId,
    orsId: entry.orsId ?? site.orsId ?? null,
    siteName: entry.siteName ?? site.siteName,
    answers: entry.answers,
    effective: { ...effective, ...queriedEffective(site, entry) },
    besEvidenceRequired: required,
    besEvidence: { besEvidenceUploads: entry.besEvidenceUploads },
    missingFields,
    isComplete: missingFields.length === 0,
    itemId: entry.itemId,
    changeType: entry.changeType,
    status: entry.status,
    validFrom: entry.validFrom,
    withdrawnAt: entry.withdrawnAt,
    caseManagementReference: entry.caseManagementReference ?? null,
    query: queryView(site, entry)
  }
  return isUpdate(entry) ? { ...view, ...updateFields(site, entry) } : view
}

const siteFor = (sites, item) => sites.find((site) => isItemForSite(item, site))

function requestView(request, siteList) {
  const sites = request.sites.map((entry) =>
    requestSiteView(siteFor(siteList, entry) ?? {}, entry)
  )
  const chargeableSites = request.sites.filter(
    (entry) => entry.changeType === CHANGE_TYPES.addOverseasSite
  ).length
  const updatesOnly = request.sites.length > 0 && request.sites.every(isUpdate)
  return {
    requestId: request.requestId,
    changeType: updatesOnly
      ? CHANGE_TYPES.updateOverseasSite
      : request.changeType,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    submittedAt: request.submittedAt ?? null,
    submittedBy: request.submittedBy ?? null,
    sites,
    isComplete: sites.length > 0 && sites.every((site) => site.isComplete),
    charge: {
      chargeableSites,
      chargePerSitePence: CHARGE_PER_SITE_PENCE,
      totalPence: chargeableSites * CHARGE_PER_SITE_PENCE
    },
    tonnageBandUpgrade: request.tonnageBandUpgrade ?? null
  }
}

export const isActive = (item) => ACTIVE_ITEM_STATUSES.has(item.status)

export function buildView(
  orgId,
  appId,
  application,
  store,
  registrationOnly = null
) {
  const sites = application.isExporter
    ? (application.overseasSites?.sites ?? [])
    : []
  const requests = [
    store.draft,
    ...store.submitted,
    registrationOnly?.draft,
    ...(registrationOnly?.submitted ?? [])
  ]
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const activeSiteItems = requests.flatMap((request) =>
    request.sites.filter(isActive).map((item) => ({ request, item }))
  )
  const siteView = (site) => {
    const pending = activeSiteItems.find(({ item }) =>
      isItemForSite(item, site)
    )?.request
    return {
      siteId: site.siteId,
      orsId: site.orsId,
      accreditationStatus:
        site.selected === false
          ? SITE_ACCREDITATION_STATUSES.registered
          : SITE_ACCREDITATION_STATUSES.accredited,
      pendingRequestId: pending?.requestId ?? null,
      pendingRequestStatus: pending?.status ?? null,
      lockedFields: LOCKABLE.filter((field) => hasValue(site[field])),
      site
    }
  }
  return {
    organisationId: orgId,
    applicationId: appId,
    organisationName: application.organisationName ?? null,
    registrationId: application.registrationId,
    materialType: application.materialType,
    year: application.year,
    accreditationReference: application.accreditationReference ?? null,
    registrationReference: application.registrationReference ?? null,
    sites: sites.map(siteView),
    activeRequest: store.draft ? requestView(store.draft, sites) : null,
    requests: requests.map((r) => requestView(r, sites)),
    hasOpenQuery: requests.some((request) => request.sites.some(isQueried)),
    pendingOrsIds: [
      ...new Set(
        activeSiteItems
          .map(({ item }) => item.orsId ?? siteFor(sites, item)?.orsId)
          .filter(Boolean)
      )
    ]
  }
}
