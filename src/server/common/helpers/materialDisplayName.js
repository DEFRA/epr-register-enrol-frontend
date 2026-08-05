const GLASS_RECYCLING_PROCESS_KEYS = {
  glass_re_melt: 'pages.materialSelection.glassRemelt',
  glass_other: 'pages.materialSelection.glassOther'
}

/**
 * Builds the operator-facing material name, resolving Glass's two
 * recycling-process variants to their own copy.
 * @param {object} application - must have materialType, glassRecyclingProcess
 * @param {Function} t - translator function from getLocaleAndTranslator
 * @returns {string} the display name, or '' if materialType is unset
 */
export function materialDisplayName(application, t) {
  const { materialType, glassRecyclingProcess } = application
  if (!materialType) return ''

  const glassKey = GLASS_RECYCLING_PROCESS_KEYS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassKey) return t(glassKey)

  return t(`pages.materialSelection.materials.${materialType}`)
}
