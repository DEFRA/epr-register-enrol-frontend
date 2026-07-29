// Section-key -> translation-key lookup used to build the regulator-query
// banner's templated summary sentence (e.g. "The regulator has identified an
// issue with your sampling and inspection plan."). Mirrors the structure of
// the task-list label mapping in task-list/controller.js and
// query-task-list/controller.js (one entry per accreditation section, keyed
// the same way as the `sectionStatus` fields on the application record) but
// lives here so it can be shared across every page that renders the banner.
export const REGULATOR_QUERY_SECTION_LABEL_KEYS = {
  prns: 'common.regulatorQuery.sectionLabels.prns',
  perns: 'common.regulatorQuery.sectionLabels.perns',
  businessPlan: 'common.regulatorQuery.sectionLabels.businessPlan',
  samplingPlan: 'common.regulatorQuery.sectionLabels.samplingPlan',
  overseasSites: 'common.regulatorQuery.sectionLabels.overseasSites',
  besEvidence: 'common.regulatorQuery.sectionLabels.besEvidence'
}

/**
 * Builds the templated "The regulator has identified an issue with your
 * {section}." summary sentence for the regulator-query banner. The sentence
 * is built entirely from a frontend-owned section-key -> label lookup — it
 * never depends on officer-authored text or a CM/backend field.
 * @param {string} sectionKey - key into REGULATOR_QUERY_SECTION_LABEL_KEYS (e.g. 'prns')
 * @param {Function} t - translator function from getLocaleAndTranslator
 * @returns {string|null} the summary sentence, or null if sectionKey is unrecognised
 */
export function buildRegulatorQuerySummary(sectionKey, t) {
  const labelKey = REGULATOR_QUERY_SECTION_LABEL_KEYS[sectionKey]
  if (!labelKey) return null
  return `${t('common.regulatorQuery.summaryPrefix')} ${t(labelKey)}.`
}
