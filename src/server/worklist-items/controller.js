/**
 * Worklist Items controller.
 */
export const worklistItemsController = {
  handler(_request, h) {
    return h.view('worklist-items/index', {
      pageTitle: 'Worklist Items',
      heading: 'Worklist Items'
    })
  }
}
