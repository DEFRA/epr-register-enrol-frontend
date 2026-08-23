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
  if (!materialType) {
    return ''
  }

  // glassRecyclingProcess is an array containing 0 or 1 elements from the
  // ReEx API; an empty array means no recycling process was specified.
  const glassRecyclingType = Array.isArray(glassRecyclingProcess)
    ? glassRecyclingProcess[0]
    : glassRecyclingProcess

  const glassKey = GLASS_RECYCLING_PROCESS_KEYS[glassRecyclingType]
  if (materialType === 'Glass' && glassKey) {
    return t(glassKey)
  }

  return t(`pages.materialSelection.materials.${materialType}`)
}
