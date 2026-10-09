import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'
import { requiresConditionsOfExport } from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { fromCyaQuery } from '../return-to-cya.js'

const siteNameUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/site-name`
const siteLocationUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/site-location`
const contactDetailsUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/site-contact-details`
const recyclingOperationUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/recycling-operation-details`
const baselCodeUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
const repatriatedLoadsUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/repatriated-loads`
const conditionsOfExportUrl = (applicationId) =>
  `/accreditation/add-overseas-site/${applicationId}/conditions-of-export`

function buildSiteNameRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.siteName'),
    value: session.siteName ?? '',
    changeUrl: `${siteNameUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'site-name'
  }
}

function buildLocationRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.location'),
    value: formatSiteAddress(session),
    changeUrl: `${siteLocationUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'location'
  }
}

function buildCoordinatesRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.coordinates'),
    value: session.coordinates ?? '',
    changeUrl: `${siteLocationUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'coordinates'
  }
}

function buildContactNameRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.contactName'),
    value: session.siteContactName ?? '',
    changeUrl: `${contactDetailsUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'contact-name'
  }
}

function buildContactEmailRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.contactEmail'),
    value: session.siteContactEmail ?? '',
    changeUrl: `${contactDetailsUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'contact-email'
  }
}

function buildContactPhoneRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.contactPhone'),
    value: session.siteContactPhone ?? '',
    changeUrl: `${contactDetailsUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'contact-phone'
  }
}

function buildRecyclingOperationRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.recyclingOperation'),
    value: (session.recyclingOperationCodes ?? []).join(', '),
    changeUrl: `${recyclingOperationUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'recycling-operation'
  }
}

function buildBaselCodesRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.baselCodes'),
    type: 'codeList',
    codes: (session.baselAndOecdCodes ?? []).map((value, index) => ({
      value,
      index
    })),
    changeUrl: `${baselCodeUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'basel-codes'
  }
}

function buildRepatriatedLoadsRow(t, applicationId, session) {
  return {
    key: t('pages.addOverseasSite.cya.rows.repatriatedLoads'),
    value: session.repatriatedLoads ?? '',
    changeUrl: `${repatriatedLoadsUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'repatriated-loads'
  }
}

function conditionsOfExportValue(t, conditionsOfExport) {
  if (conditionsOfExport == null) {
    return ''
  }
  return conditionsOfExport ? t('common.yes') : t('common.no')
}

// Steel and Aluminium sites must answer this, so the row stays on the page
// (as "Not provided") even when there is no answer yet.
function buildConditionsOfExportRow(t, applicationId, session, materialType) {
  if (
    session.conditionsOfExport == null &&
    !requiresConditionsOfExport(materialType)
  ) {
    return null
  }
  return {
    key: t('pages.addOverseasSite.cya.rows.conditionsOfExport'),
    value: conditionsOfExportValue(t, session.conditionsOfExport),
    changeUrl: `${conditionsOfExportUrl(applicationId)}${fromCyaQuery()}`,
    testId: 'conditions-of-export'
  }
}

export function buildRows(t, applicationId, session, materialType) {
  return [
    buildSiteNameRow(t, applicationId, session),
    buildLocationRow(t, applicationId, session),
    buildCoordinatesRow(t, applicationId, session),
    buildContactNameRow(t, applicationId, session),
    buildContactEmailRow(t, applicationId, session),
    buildContactPhoneRow(t, applicationId, session),
    buildRecyclingOperationRow(t, applicationId, session),
    buildBaselCodesRow(t, applicationId, session),
    buildRepatriatedLoadsRow(t, applicationId, session),
    buildConditionsOfExportRow(t, applicationId, session, materialType)
  ].filter(Boolean)
}

const isBlank = (row) =>
  row.type === 'codeList' ? row.codes.length === 0 : !row.value

// Attaches the problems found by the shared completeness check to the rows
// they belong to, and builds the error summary: each entry links to the page
// that fixes it, since the answers are changed there rather than on this page.
export function annotateRows(rows, issues) {
  const changeUrlByRow = Object.fromEntries(
    rows.map((row) => [row.testId, row.changeUrl])
  )
  return {
    rows: rows.map((row) => ({
      ...row,
      isBlank: isBlank(row),
      errors: issues
        .filter((found) => found.row === row.testId)
        .map((found) => found.message)
    })),
    errorSummary: issues.map((found) => ({
      message: found.message,
      href: changeUrlByRow[found.row]
    }))
  }
}
