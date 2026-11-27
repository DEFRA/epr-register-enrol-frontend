import { findQueriedInterimSite, loadQueriedItem } from './load.js'
import { interimSiteUrl } from './urls.js'
import { FLASH_UPDATED } from './steps.js'

// RA-698: an interim site of the queried ORS, in the layout of the ORS's own
// summary. Its name, address and contact can change; its country and
// recycling operations cannot, and interim sites are never added or removed.

const CONTACT_STEP = 'contact-details'

const ROWS = [
  {
    id: 'site-name',
    labelKey: 'siteName',
    step: 'site-name',
    fields: ['siteName']
  },
  {
    id: 'location',
    labelKey: 'location',
    step: 'location',
    fields: ['addressLine1']
  },
  {
    id: 'contact-name',
    labelKey: 'contactName',
    step: CONTACT_STEP,
    fields: ['contactName']
  },
  {
    id: 'contact-email',
    labelKey: 'contactEmail',
    step: CONTACT_STEP,
    fields: ['contactEmail']
  },
  {
    id: 'contact-phone',
    labelKey: 'contactPhone',
    step: CONTACT_STEP,
    fields: ['contactPhone']
  }
]

const locationLine = (values) =>
  [
    values.addressLine1,
    values.addressLine2,
    values.townOrCity,
    values.stateOrRegion,
    values.postcode
  ]
    .filter(Boolean)
    .join(', ')

function buildRows(ctx, interim) {
  const open = new Set(interim.editableFields ?? [])
  const label = (key) =>
    ctx.t(`pages.manageChangeRequests.respond.fieldLabels.${key}`)
  const rowValue = (row) =>
    row.id === 'location'
      ? locationLine(interim.values ?? {})
      : (interim.values?.[row.fields[0]] ?? '')
  const editable = ROWS.map((row) => ({
    id: row.id,
    label: label(row.labelKey),
    value: rowValue(row),
    changeUrl: row.fields.every((field) => open.has(field))
      ? interimSiteUrl(
          ctx.params,
          ctx.item.itemId,
          interim.siteId,
          ctx.currentLocale,
          row.step
        )
      : null
  }))
  const fixed = (id, text, value) => ({
    id,
    label: text,
    value,
    changeUrl: null
  })
  return [
    ...editable,
    fixed(
      'country',
      ctx.t('pages.manageChangeRequests.respond.rows.country'),
      interim.country ?? ''
    ),
    fixed(
      'operation-codes',
      ctx.t('pages.manageChangeRequests.respond.rows.recyclingOperation'),
      (interim.operationCodes ?? []).join(', ')
    )
  ]
}

export const interimSiteController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const interim = findQueriedInterimSite(
      ctx.item,
      request.params.interimSiteId
    )
    if (!interim) {
      return h.redirect(ctx.itemUrl)
    }
    const { t } = ctx
    const siteName = interim.values?.siteName ?? interim.siteNumber
    const updatedField = request.yar.flash(FLASH_UPDATED)[0] ?? null
    return h.view('manage/change-requests/respond/interim-site', {
      pageTitle: siteName,
      heading: siteName,
      caption: t('pages.manageChangeRequests.respond.interimSite.title'),
      backLink: ctx.itemUrl,
      continueUrl: ctx.itemUrl,
      continueLabel: t('pages.manageChangeRequests.respond.actions.continue'),
      success: updatedField
        ? {
            title: t('pages.manageChangeRequests.respond.success.title'),
            text: t('pages.manageChangeRequests.respond.success.body', {
              field: updatedField
            })
          }
        : null,
      rows: buildRows(ctx, interim)
    })
  }
}
