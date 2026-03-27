/**
 * Organisation List controller.
 */
export const organisationListController = {
  handler(_request, h) {
    return h.view('organisation-list/index', {
      pageTitle: 'Organisation List',
      heading: 'Organisation List'
    })
  }
}
