export const OrganisationsViewModel = [
  {
    name: 'Glass Recycling Export Import Company',
    id: 'GB806735831',
    foo: 'fooey'
  },
  {
    name: 'Metal and Metal (UK) Ltd',
    id: 'GB26734548',
    foo: 'ipsum'
  }
]

/**
 * Organisation List controller.
 */
export const organisationListController = {
  handler(_request, h) {
    return h.view('organisation-list/index', {
      pageTitle: 'Organisation List',
      heading: 'Organisation List',
      organisationsViewModel: OrganisationsViewModel
    })
  }
}
