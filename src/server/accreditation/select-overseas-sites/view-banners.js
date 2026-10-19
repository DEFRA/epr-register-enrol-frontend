import { buildRegulatorQuerySummary } from '../../common/helpers/regulatorQuery.js'

// Every banner the view expects, with the value it takes when the caller says
// nothing. Held as data rather than ten `??` expressions: the branch-per-field
// version read as ten decisions when it is really one rule applied ten times.
const BANNER_DEFAULTS = {
  successBanner: false,
  queried: false,
  interimSiteSuccessBanner: false,
  promoteSuccessBanner: false,
  editSuccessBanner: false,
  withdrawnInterimSite: null,
  querySummary: null,
  regulatorQueryFields: null,
  readOnly: false,
  isQueriedApplication: false,
  incompleteSiteErrors: [],
  accreditedYear: null
}

// The accredited sites were last used the year before the application's year. Null when the
// application has no year, so the page can leave its caption out rather than print a blank.
export function accreditedYearFor(application) {
  return application?.year ? application.year - 1 : null
}

export function resolveBannerDefaults(banners) {
  return Object.fromEntries(
    Object.entries(BANNER_DEFAULTS).map(([key, fallback]) => [
      key,
      banners[key] ?? fallback
    ])
  )
}

// The regulator-query summary and the field links back to this page's accredited section,
// both of which only show while the section is under query.
export function queriedBannerData(t, queried) {
  return {
    querySummary: queried
      ? buildRegulatorQuerySummary('overseasSites', t)
      : null,
    regulatorQueryFields: queried
      ? [
          {
            label: t('pages.taskList.tasks.overseasSites'),
            href: '#accredited-sites'
          }
        ]
      : null
  }
}
