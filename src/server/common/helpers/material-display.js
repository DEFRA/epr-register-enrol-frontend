export function buildMaterialDisplay(materialType, glassRecyclingProcess, t) {
  const materialDisplay = t(`pages.materialSelection.materials.${materialType}`)

  if (materialType?.toLowerCase() !== 'glass' || !glassRecyclingProcess) {
    return materialDisplay
  }

  const processDisplay = t(
    `pages.materialSelection.glassRecyclingProcess.${glassRecyclingProcess}`
  )

  return `${materialDisplay} - ${processDisplay}`
}
