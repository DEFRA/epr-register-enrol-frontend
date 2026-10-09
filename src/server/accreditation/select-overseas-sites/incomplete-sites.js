import { findIncompleteSites } from '../../common/helpers/overseasSiteCompleteness.js'

// The site list's view of the completeness check (RA-597).

// Marks each site that is part of the application and not complete, using the
// same check as check-your-answers, the section confirmation and the submit
// declaration. Registered sites that have not been included are left alone.
export function flagIncompleteSites(sections, t, materialType) {
  const incompleteIds = new Set(
    findIncompleteSites(
      t,
      [
        ...sections.accredited,
        ...sections.newSites,
        ...sections.registeredSitesAdded
      ],
      materialType
    ).map(({ site }) => site.siteId)
  )
  const flag = (sites) =>
    sites.map((site) => ({
      ...site,
      incomplete: incompleteIds.has(site.siteId)
    }))
  return {
    ...sections,
    accredited: flag(sections.accredited),
    newSites: flag(sections.newSites),
    registeredSitesAdded: flag(sections.registeredSitesAdded)
  }
}

// One error summary entry per incomplete site, linking to its Change page,
// which opens check-your-answers with the gaps marked.
export function incompleteSiteErrors(
  t,
  applicationId,
  flaggedSections,
  editUrl
) {
  return [
    ...flaggedSections.accredited,
    ...flaggedSections.newSites,
    ...flaggedSections.registeredSitesAdded
  ]
    .filter((site) => site.incomplete)
    .map((site) => ({
      message: t('pages.selectOverseasSites.validation.incompleteSite').replace(
        '{siteName}',
        site.siteName
      ),
      href: editUrl(applicationId, site.siteId)
    }))
}
