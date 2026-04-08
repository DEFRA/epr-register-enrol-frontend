import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

/**
 * Worklist Items controller.
 */

export const WorklistItemsViewModel = [
  {
    task: 'Re-Accreditation',
    orgname: 'Glass Recycling Export Import Company',
    orgid: '087654321', //company number
    regid: 'EN2712300000001',
    dtOfApplication: '2026-04-01Z15:00:00',
    material: 'Glass',
    risk: 'low',
    role: 'Exporter',
    status: 'New',
    assignedTo: 'Reginald Regulator'
  },
  {
    task: 'Re-Accreditation',
    orgname: 'Metal and Metal (UK) Ltd',
    orgid: '023456789',
    regid: 'EN2712300000002',
    dtOfApplication: '2026-03-04Z11:03:12',
    material: 'Metal',
    risk: 'medium',
    role: 'Reprocessor',
    status: 'In-progress',
    assignedTo: 'Ironman'
  }
]

export const worklistItemsController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('worklist-items/index', {
      pageTitle: t('pages.worklistItems.title'),
      heading: t('pages.worklistItems.heading'),
      worklistItemsViewModel: WorklistItemsViewModel
    })
  }
}
