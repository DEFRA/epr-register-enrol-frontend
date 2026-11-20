import { GLASS_RECYCLING_PROCESSES } from '../../common/plugins/route-params-guard.js'

/**
 * Re/Ex links with its organisation read model's material, which names glass
 * by its recycling process (glass_re_melt or glass_other); links made before
 * that, and our own, carry the material alone (Glass). The route params guard
 * has already refused any other value and put the rest in canonical case.
 *
 * @param {string} value - the URL's materialType
 * @returns {{ materialType: string, glassRecyclingProcess: string|null }}
 *   the material as our APIs name it, and the glass recycling process the URL
 *   requires, if any
 */
export function parseUrlMaterial(value) {
  return GLASS_RECYCLING_PROCESSES.includes(value)
    ? { materialType: 'Glass', glassRecyclingProcess: value }
    : { materialType: value, glassRecyclingProcess: null }
}

// The applications API gives one value or an array of 0 or 1 elements, the
// registration status one value or null.
const recyclingProcesses = (glassRecyclingProcess) =>
  [glassRecyclingProcess].flat()

/**
 * @param {{ materialType?: string, glassRecyclingProcess?: string|string[]|null }} record
 *   an accreditation application or a registration
 * @param {{ materialType: string, glassRecyclingProcess: string|null }} urlMaterial
 *   from parseUrlMaterial
 */
export function matchesUrlMaterial(record, urlMaterial) {
  return (
    typeof record.materialType === 'string' &&
    record.materialType.toLowerCase() ===
      urlMaterial.materialType.toLowerCase() &&
    (urlMaterial.glassRecyclingProcess === null ||
      recyclingProcesses(record.glassRecyclingProcess).includes(
        urlMaterial.glassRecyclingProcess
      ))
  )
}
