/**
 * Regulator dashboard controller.
 */
export const regulatorController = {
  handler(_request, h) {
    return h.view('regulator/index', {
      pageTitle: 'Regulator',
      heading: 'Regulator'
    })
  }
}
