/**
 * Worklist Items controller.
 */
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'

export const worklistItemsController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)

    return h.view('worklist-items/index', {
      pageTitle: t('pages.worklistItems.title'),
      heading: t('pages.worklistItems.heading')
    })
  }
}
