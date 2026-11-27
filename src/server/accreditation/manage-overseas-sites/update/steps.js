import { MAX_REPATRIATED_WORDS } from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { STEP_VALIDATORS } from './validation.js'

// RA-682: the ORS detail steps, by URL slug. Each has its form, its rules, the
// summary rows its Change links sit on, and its success banner's key under
// `pages.updateOverseasSite.updated`.
export const STEPS = {
  'site-name': {
    titleKey: 'pages.addOverseasSite.siteName.heading',
    fields: [
      { name: 'siteName', labelKey: 'pages.addOverseasSite.siteName.label' }
    ],
    validate: STEP_VALIDATORS.siteName,
    rows: ['site-name'],
    updatedKey: 'siteName'
  },
  location: {
    titleKey: 'pages.addOverseasSite.siteLocation.heading',
    fields: [
      {
        name: 'addressLine1',
        labelKey: 'pages.addOverseasSite.siteLocation.addressLine1Label'
      },
      {
        name: 'addressLine2',
        labelKey: 'pages.addOverseasSite.siteLocation.addressLine2Label'
      },
      {
        name: 'townOrCity',
        labelKey: 'pages.addOverseasSite.siteLocation.townOrCityLabel',
        width: 'govuk-input--width-20'
      }
    ],
    // AC02: shown as read-only inputs from the ORS's stored values, and never
    // posted, so the update can't change them.
    readOnly: [
      {
        name: 'country',
        labelKey: 'pages.addOverseasSite.siteLocation.countryLabel'
      },
      {
        name: 'coordinates',
        labelKey: 'pages.addOverseasSite.siteLocation.coordinatesLabel',
        hintKey: 'pages.addOverseasSite.siteLocation.coordinatesHint'
      }
    ],
    validate: STEP_VALIDATORS.location,
    rows: ['location'],
    updatedKey: 'location'
  },
  'contact-details': {
    titleKey: 'pages.addOverseasSite.siteContactDetails.heading',
    fields: [
      {
        name: 'contactName',
        labelKey: 'pages.addOverseasSite.siteContactDetails.nameLabel'
      },
      {
        name: 'contactEmail',
        labelKey: 'pages.addOverseasSite.siteContactDetails.emailLabel',
        type: 'email'
      },
      {
        name: 'contactPhone',
        labelKey: 'pages.addOverseasSite.siteContactDetails.phoneLabel',
        type: 'tel',
        width: 'govuk-input--width-20'
      }
    ],
    validate: STEP_VALIDATORS.contactDetails,
    rows: ['contact-name', 'contact-email', 'contact-phone'],
    updatedKey: 'contactDetails'
  },
  'rejected-loads': {
    titleKey: 'pages.addOverseasSite.repatriatedLoads.heading',
    fields: [
      {
        name: 'repatriatedLoads',
        labelKey: 'pages.addOverseasSite.repatriatedLoads.label',
        hintKey: 'pages.addOverseasSite.repatriatedLoads.hint',
        maxwords: MAX_REPATRIATED_WORDS
      }
    ],
    validate: STEP_VALIDATORS.repatriatedLoads,
    rows: ['repatriated-loads'],
    updatedKey: 'repatriatedLoads'
  }
}

export const STEP_NAMES = Object.keys(STEPS)

export const INTERIM_SITES_UPDATED = 'interim-sites'
export const BES_EVIDENCE_UPDATED = 'bes-evidence'

/** The `?updated=` values the details page takes, and each one's banner key. */
export const UPDATED_KEYS = {
  ...Object.fromEntries(
    Object.entries(STEPS).map(([slug, step]) => [slug, step.updatedKey])
  ),
  [INTERIM_SITES_UPDATED]: 'interimSites',
  [BES_EVIDENCE_UPDATED]: 'besEvidence'
}

export const STEP_FOR_ROW = Object.fromEntries(
  Object.entries(STEPS).flatMap(([slug, step]) =>
    step.rows.map((row) => [row, slug])
  )
)
