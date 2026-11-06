import Boom from '@hapi/boom'

import { formatDate } from '../../../config/nunjucks/filters/format-date.js'
import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { activeInterimSites } from '../../common/helpers/interimSites.js'
import {
  buildSiteDetailRows,
  findSite,
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

function requestDetails({ request, item, application, t, currentLocale }) {
  const notApplicable = t('pages.manageChangeRequests.notApplicable')
  const notSubmitted = text(t, 'notSubmitted')
  return {
    type: changeTypeLabel(item.changeType, t),
    sent: dateOr(request.submittedAt, notSubmitted, currentLocale),
    submittedBy: request.submittedAt
      ? (request.submittedBy?.fullName ?? notSubmitted)
      : notSubmitted,
    ...validity(item, application.year, notApplicable, currentLocale),
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

function siteRows({ t, entry, item, files }) {
  const rows = buildSiteDetailRows({ t, entry, requestSite: item }).filter(
    (row) => !HIDDEN_ROWS.has(row.id)
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

function orsDetail({ view, found, application, t, currentLocale }) {
  const { request, item } = found
  // A site the accreditation no longer lists still has the item's own name.
  const entry = findSite(view, item.siteId) ?? {
    siteId: item.siteId,
    site: { siteId: item.siteId, orsId: item.orsId, siteName: item.siteName }
  }
  const site = {
    ...entry.site,
    country: item.effective?.country ?? entry.site.country
  }
  const files = besEvidenceFiles(entry.site, item)
  const notApplicable = t('pages.manageChangeRequests.notApplicable')
  return {
    heading: item.siteName ?? site.siteName,
    header: {
      location: orsAddressLine(site),
      siteId: item.orsId ?? site.orsId,
      statusTag: applicationStatusTag(item.status, t),
      dateAdded: dateOr(request.createdAt, notApplicable, currentLocale),
      besExpiry: dateOr(latestExpiry(files), notApplicable, currentLocale)
    },
    rows: siteRows({
      t,
      entry,
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
      application,
      t,
      currentLocale
    })
  }
}

export const manageChangeRequestDetailController = {
  async handler(request, h) {
    const { application, t, currentLocale, response } = await loadManagePage(
      request,
      h
    )
    if (response) {
      return response
    }

    const view = await fetchChangeRequestsView(request, application)
    if (!view) {
      return serviceProblem(request, h, t)
    }

    const found = findItem(view.requests ?? [], request.params.itemId)
    // RA-697 task 008 adds the tonnage band upgrade's layout.
    if (!found || found.isTonnage) {
      throw Boom.notFound()
    }

    const detail = orsDetail({ view, found, application, t, currentLocale })
    return h.view('manage/change-requests/detail', {
      pageTitle: detail.heading,
      caption: manageCaption(application, t),
      backLink: changeRequestsUrl(request.params, currentLocale),
      ...detail
    })
  }
}
