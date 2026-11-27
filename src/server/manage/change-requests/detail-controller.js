import Boom from '@hapi/boom'

import { formatDate } from '../../../config/nunjucks/filters/format-date.js'
import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { ITEM_STATUSES } from '../../common/constants/changeRequests.js'
import { TONNAGE_OPTIONS } from '../../common/constants/tonnageBands.js'
import { isItemForSite } from '../../common/helpers/changeRequestSite.js'
import { endOfYear } from '../../common/helpers/currentYear.js'
import { hasValue } from '../../common/helpers/hasValue.js'
import { activeInterimSites } from '../../common/helpers/interimSites.js'
import { orsFullAddressLine } from '../../common/helpers/orsAddress.js'
import {
  buildSiteDetailRows,
  manageSitesText
} from '../../accreditation/manage-overseas-sites/view-model.js'
import { fetchChangeRequestsView } from '../helpers/change-requests-view.js'
import {
  loadManagePage,
  manageCaption,
  serviceProblem
} from '../helpers/manage-page.js'
import { changeRequestsUrl } from '../helpers/manage-urls.js'
import { changeTypeLabel, findItem } from './change-request-items.js'
import { FLASH_PROBLEM, FLASH_UPDATED } from './respond/steps.js'
import { interimSiteUrl, respondUrl } from './respond/urls.js'

const DATE_FORMAT = 'd MMM yyyy'

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
    [ITEM_STATUSES.approved]: endOfYear(year),
    [ITEM_STATUSES.withdrawn]: item.withdrawnAt
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
    // RA-739: the item's own, as Case Management makes each site its own
    // application. Null while In progress, and whenever Case Management
    // submission is off.
    reference: item.caseManagementReference ?? notApplicable
  }
}

// The parts of the page that are the same for every type of item.
function itemDetail({ found, year, t, currentLocale }) {
  const { request, item } = found
  return {
    isQueried: item.status === ITEM_STATUSES.queried,
    requestDetails: requestDetails({ request, item, year, t, currentLocale })
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

// RA-698: the item's own answers to the ORS's fields over the ORS's values.
// The backend names the rejected loads field differently from the ORS record.
const EFFECTIVE_SITE_FIELDS = [
  'siteName',
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'stateOrRegion',
  'postcode',
  'contactName',
  'contactEmail',
  'contactPhone'
]

function withEffective(site, effective = {}) {
  const merged = { ...site }
  for (const field of EFFECTIVE_SITE_FIELDS) {
    if (hasValue(effective[field])) {
      merged[field] = effective[field]
    }
  }
  if (hasValue(effective.rejectedLoadsArrangements)) {
    merged.repatriatedLoads = effective.rejectedLoadsArrangements
  }
  return merged
}

const CONTACT_STEP = 'contact-details'

// RA-698: a queried item's row -> the page that changes it, and the field the
// backend lists as editable for it.
const ROW_STEPS = {
  'site-name': { step: 'site-name', field: 'siteName', label: 'siteName' },
  location: { step: 'location', field: 'addressLine1', label: 'location' },
  'contact-name': {
    step: CONTACT_STEP,
    field: 'contactName',
    label: 'contactName'
  },
  'contact-email': {
    step: CONTACT_STEP,
    field: 'contactEmail',
    label: 'contactEmail'
  },
  'contact-phone': {
    step: CONTACT_STEP,
    field: 'contactPhone',
    label: 'contactPhone'
  },
  'repatriated-loads': {
    step: 'rejected-loads',
    field: 'rejectedLoadsArrangements',
    label: 'repatriatedLoads'
  },
  'bes-evidence': {
    step: 'bes-evidence',
    field: 'besEvidence',
    label: 'besEvidence',
    upload: true
  }
}

const ROW_LABELS = {
  'site-name': 'siteName',
  'recycling-operation': 'recyclingOperation'
}

const respondText = (t, key, params) =>
  t(`pages.manageChangeRequests.respond.${key}`, params)

// Change links only for what the query leaves editable.
function withActions(rows, { respond, t }) {
  const editable = new Set(respond?.editableFields ?? [])
  return rows.map((row) => {
    const labelKey = ROW_LABELS[row.id]
    const labelled = labelKey
      ? { ...row, label: respondText(t, `rows.${labelKey}`) }
      : row
    const target = ROW_STEPS[row.id]
    if (!respond || !target || !editable.has(target.field)) {
      return labelled
    }
    return {
      ...labelled,
      action: {
        href: respondUrl(
          respond.params,
          respond.itemId,
          respond.locale,
          target.step
        ),
        text: respondText(
          t,
          target.upload ? 'actions.upload' : 'actions.change'
        ),
        hiddenText: labelled.label
      }
    }
  })
}

function siteRows({ t, entry, item, files, respond }) {
  const site = {
    ...withEffective(entry.site, item.effective),
    country: item.effective?.country ?? entry.site.country
  }
  const rows = buildSiteDetailRows({
    t,
    entry: { ...entry, site },
    requestSite: item
  })
    .filter((row) => !HIDDEN_ROWS.has(row.id))
    .map((row) =>
      row.id === 'location'
        ? { ...row, value: orsFullAddressLine(site) || row.value }
        : row
    )
  const bes = files.map((file) => file.filename).join(', ')
  const all = [
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
  return withActions(all, { respond, t })
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

// The operator's own edits to an interim site over the ORS's record of it.
function withInterimValues(interimSite, item) {
  const values = item.query?.interimSites?.find(
    (queried) => String(queried.siteId) === String(interimSite.siteId)
  )?.values
  const merged = { ...interimSite }
  for (const [field, value] of Object.entries(values ?? {})) {
    if (hasValue(value)) {
      merged[field] = value
    }
  }
  return merged
}

function findItemSite(view, item) {
  return view.sites?.find((entry) => isItemForSite(item, entry))
}

// RA-698: the operator may answer an accredited operator's own Queried item.
function respondDetails({ found, context, params, currentLocale }) {
  const { item } = found
  if (
    context.isRegistrationOnly ||
    item.status !== ITEM_STATUSES.queried ||
    !item.query
  ) {
    return null
  }
  return {
    params,
    itemId: item.itemId,
    locale: currentLocale,
    editableFields: item.query.editableFields ?? [],
    note: item.query.queryNote
  }
}

function orsDetail({ view, found, year, t, currentLocale, respond }) {
  const { request, item } = found
  // A site the accreditation no longer lists still has the item's own name.
  const entry = findItemSite(view, item) ?? {
    siteId: item.siteId,
    site: { siteId: item.siteId, orsId: item.orsId, siteName: item.siteName }
  }
  const site = {
    ...withEffective(entry.site, item.effective),
    country: item.effective?.country ?? entry.site.country
  }
  const files = besEvidenceFiles(entry.site, item)
  const notApplicable = t('pages.manageChangeRequests.notApplicable')
  const siteName = item.siteName ?? site.siteName
  const orsId = item.orsId ?? site.orsId
  return {
    heading: orsId ? `${siteName} (${orsId})` : siteName,
    header: {
      location: orsFullAddressLine(site),
      siteId: orsId,
      statusTag: applicationStatusTag(item.status, t),
      dateAdded: dateOr(request.createdAt, notApplicable, currentLocale),
      besExpiry: dateOr(latestExpiry(files), notApplicable, currentLocale)
    },
    rows: siteRows({
      t,
      entry,
      item: { ...item, effective: item.effective ?? {} },
      files,
      respond
    }),
    interimSites: activeInterimSites(entry.site)
      .map((interimSite) => withInterimValues(interimSite, item))
      .map((interimSite) => ({
        siteId: interimSite.siteId,
        line: interimSiteLine(interimSite),
        name: interimSite.siteName,
        changeUrl: respond
          ? interimSiteUrl(
              respond.params,
              respond.itemId,
              interimSite.siteId,
              currentLocale
            )
          : null
      })),
    ...itemDetail({ found, year, t, currentLocale })
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
  const { item } = found
  return {
    isTonnage: true,
    heading: changeTypeLabel(item.changeType, t),
    header: { statusTag: applicationStatusTag(item.status, t) },
    rows: [requestedBandRow(item, t)],
    ...itemDetail({ found, year, t, currentLocale })
  }
}

function respondView({ respond, found, params, currentLocale, t }) {
  if (!respond) {
    return respond
  }
  return {
    continueUrl: respondUrl(
      params,
      found.item.itemId,
      currentLocale,
      'declaration'
    ),
    cancelUrl: changeRequestsUrl(params, currentLocale),
    labels: {
      instruction: respondText(t, 'queryInstruction'),
      saveAndContinue: respondText(t, 'actions.saveAndContinue'),
      cancel: respondText(t, 'actions.cancel'),
      change: respondText(t, 'actions.change')
    }
  }
}

function successView(t, updatedField) {
  return (
    updatedField && {
      title: respondText(t, 'success.title'),
      text: respondText(t, 'success.body', { field: updatedField })
    }
  )
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

    const respond = found.isTonnage
      ? null
      : respondDetails({
          found,
          context,
          params: request.params,
          currentLocale
        })
    const detail = (found.isTonnage ? tonnageDetail : orsDetail)({
      view,
      found,
      year: context.year,
      t,
      currentLocale,
      respond
    })
    const updatedField = request.yar.flash(FLASH_UPDATED)[0] ?? null
    const problem = request.yar.flash(FLASH_PROBLEM)[0] ?? null
    return h.view('manage/change-requests/detail', {
      pageTitle: detail.heading,
      caption: manageCaption(context, t),
      backLink: changeRequestsUrl(request.params, currentLocale),
      ...detail,
      queryNote: respond?.note ?? null,
      respond: respondView({
        respond,
        found,
        params: request.params,
        currentLocale,
        t
      }),
      success: successView(t, updatedField),
      problem
    })
  }
}
