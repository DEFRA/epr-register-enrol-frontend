import Boom from '@hapi/boom'

import { formatDate } from '../../../config/nunjucks/filters/format-date.js'
import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { activeInterimSites } from '../../common/helpers/interimSites.js'
import {
  buildSiteDetailRows,
  manageSitesText
} from '../../accreditation/manage-overseas-sites/view-model.js'
import {
  changeRequestsUrl,
  fetchChangeRequestsView,
  loadManagePage,
  manageCaption,
  serviceProblem
} from '../helpers/manage-page.js'
import { orsAddressLine } from '../helpers/ors-address.js'
import { TONNAGE_OPTIONS } from '../../accreditation/tonnage/controller.js'
import { changeTypeLabel, findItem } from './change-request-items.js'

const DATE_FORMAT = 'd MMM yyyy'
const DECEMBER = 11 // Date months count from 0
const LAST_DAY_OF_DECEMBER = 31

// Rows not shown on Figma 604:137479's site details.
const HIDDEN_ROWS = new Set(['coordinates'])

const text = (t, key, params) =>
  t(`pages.manageChangeRequests.detail.${key}`, params)

function dateOr(value, fallback, currentLocale) {
  return value ? formatDate(value, DATE_FORMAT, currentLocale) : fallback
}

/**
 * RA-697: a granted item applies from its approval date to the end of the
 * compliance year; a withdrawn one until its withdrawal. Anything else is
 * not in effect, whatever dates it carries.
 */
function validity(item, year, notApplicable, currentLocale) {
  const until = {
    Approved: new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER),
    Withdrawn: item.withdrawnAt
  }[item.status]
  if (!until) {
    return { validFrom: notApplicable, validTo: notApplicable }
  }
  return {
    validFrom: dateOr(item.validFrom, notApplicable, currentLocale),
    validTo: dateOr(until, notApplicable, currentLocale)
  }
}

function requestDetails({ request, item, year, t, currentLocale }) {
  const notApplicable = t('pages.manageChangeRequests.notApplicable')
  const notSubmitted = text(t, 'notSubmitted')
  return {
    type: changeTypeLabel(item.changeType, t),
    sent: dateOr(request.submittedAt, notSubmitted, currentLocale),
    submittedBy: request.submittedAt
      ? (request.submittedBy?.fullName ?? notSubmitted)
      : notSubmitted,
    ...validity(item, year, notApplicable, currentLocale),
    // Null while In progress, and whenever Case Management submission is off.
    reference: request.caseManagementReference ?? notApplicable
  }
}

// An ORS update may leave the ORS's evidence as it is, so the item's own
// uploads win but the ORS's stand in for them.
function besEvidenceFiles(site, item) {
  const itemFiles = item.besEvidence?.besEvidenceUploads ?? []
  return itemFiles.length > 0
    ? itemFiles
    : (site.besEvidence?.besEvidenceUploads ?? [])
}

function latestExpiry(files) {
  return (
    files
      .map((file) => file.besEvidenceExpiryDate)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  )
}

// The location is the header's one-line address: the add-to-accreditation
// row's would name the country twice for an ORS whose flattened siteAddress
// already ends with it.
function siteRows({ t, entry, site, item, files }) {
  const rows = buildSiteDetailRows({ t, entry, requestSite: item })
    .filter((row) => !HIDDEN_ROWS.has(row.id))
    .map((row) =>
      row.id === 'location' ? { ...row, value: orsAddressLine(site) } : row
    )
  const bes = files.map((file) => file.filename).join(', ')
  return [
    ...rows,
    {
      id: 'bes-evidence',
      label: manageSitesText(t, 'rows.besEvidence'),
      value: bes,
      missing: !bes
    }
  ].map((row) => ({
    ...row,
    value: row.missing ? text(t, 'notProvided') : row.value
  }))
}

function interimSiteLine(interimSite) {
  return [
    interimSite.siteName,
    interimSite.country,
    (interimSite.operationCodes ?? []).join(', ')
  ]
    .filter(Boolean)
    .join(', ')
}

// RA-697: a registration-only item's siteId is its ORS id's integer value,
// which need not be the accreditation's key for the same ORS, so the ORS id
// is the match whenever the item and the site both have one.
function findItemSite(view, item) {
  return view.sites?.find((entry) =>
    item.orsId && entry.orsId
      ? String(entry.orsId) === String(item.orsId)
      : String(entry.siteId) === String(item.siteId)
  )
}

function orsDetail({ view, found, year, t, currentLocale }) {
  const { request, item } = found
  // A site the accreditation no longer lists still has the item's own name.
  const entry = findItemSite(view, item) ?? {
    siteId: item.siteId,
    site: { siteId: item.siteId, orsId: item.orsId, siteName: item.siteName }
  }
  const site = {
    ...entry.site,
    country: item.effective?.country ?? entry.site.country
  }
  const files = besEvidenceFiles(entry.site, item)
  const notApplicable = t('pages.manageChangeRequests.notApplicable')
  const siteName = item.siteName ?? site.siteName
  const orsId = item.orsId ?? site.orsId
  return {
    heading: orsId ? `${siteName} (${orsId})` : siteName,
    header: {
      location: orsAddressLine(site),
      siteId: orsId,
      statusTag: applicationStatusTag(item.status, t),
      dateAdded: dateOr(request.createdAt, notApplicable, currentLocale),
      besExpiry: dateOr(latestExpiry(files), notApplicable, currentLocale)
    },
    rows: siteRows({
      t,
      entry,
      site,
      item: { ...item, effective: item.effective ?? {} },
      files
    }),
    interimSites: activeInterimSites(entry.site).map((interimSite) => ({
      siteId: interimSite.siteId,
      line: interimSiteLine(interimSite)
    })),
    isQueried: item.status === 'Queried',
    requestDetails: requestDetails({
      request,
      item,
      year,
      t,
      currentLocale
    })
  }
}

// RA-697: the bands and their labels are the accreditation journey's.
function requestedBandRow(item, t) {
  const band = item.requestedBand
  return {
    id: 'requested-band',
    label: text(t, 'tonnage.requestedBand'),
    value: TONNAGE_OPTIONS.includes(band)
      ? t(`pages.tonnage.options.${band}`)
      : text(t, 'notProvided')
  }
}

function tonnageDetail({ found, year, t, currentLocale }) {
  const { request, item } = found
  return {
    isTonnage: true,
    heading: changeTypeLabel(item.changeType, t),
    header: { statusTag: applicationStatusTag(item.status, t) },
    rows: [requestedBandRow(item, t)],
    isQueried: item.status === 'Queried',
    requestDetails: requestDetails({
      request,
      item,
      year,
      t,
      currentLocale
    })
  }
}

export const manageChangeRequestDetailController = {
  async handler(request, h) {
    const { context, t, currentLocale, response } = await loadManagePage(
      request,
      h,
      { allowRegistrationOnly: true }
    )
    if (response) {
      return response
    }

    const view = await fetchChangeRequestsView(request, context)
    if (!view) {
      return serviceProblem(request, h, t)
    }

    const found = findItem(view.requests ?? [], request.params.itemId)
    if (!found) {
      throw Boom.notFound()
    }

    const detail = (found.isTonnage ? tonnageDetail : orsDetail)({
      view,
      found,
      year: context.year,
      t,
      currentLocale
    })
    return h.view('manage/change-requests/detail', {
      pageTitle: detail.heading,
      caption: manageCaption(context, t),
      backLink: changeRequestsUrl(request.params, currentLocale),
      ...detail
    })
  }
}
