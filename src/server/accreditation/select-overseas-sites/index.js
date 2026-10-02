import {
  selectOverseasSitesGetController,
  selectOverseasSitesPostController
} from './controller.js'
import {
  selectOverseasSitesPromoteEntryGetController,
  selectOverseasSitesEditEntryGetController,
  selectOverseasSitesInterimSiteEditEntryGetController,
  selectOverseasSitesInterimSiteAddEntryGetController
} from './wizard-entry.controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const routes = [
  {
    method: 'GET',
    path: '/accreditation/select-overseas-sites/{applicationId}',
    options: requireOperator,
    ...selectOverseasSitesGetController
  },
  {
    method: 'GET',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}',
    options: requireOperator,
    ...selectOverseasSitesGetController
  },
  {
    method: 'GET',
    path: '/accreditation/select-overseas-sites/{applicationId}/promote/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesPromoteEntryGetController
  },
  {
    method: 'GET',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}/promote/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesPromoteEntryGetController
  },
  {
    method: 'GET',
    path: '/accreditation/select-overseas-sites/{applicationId}/edit/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesEditEntryGetController
  },
  {
    method: 'GET',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}/edit/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesEditEntryGetController
  },
  {
    method: 'GET',
    path: '/accreditation/select-overseas-sites/{applicationId}/interim-site/edit/{interimSiteId}',
    options: requireOperator,
    ...selectOverseasSitesInterimSiteEditEntryGetController
  },
  {
    method: 'GET',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}/interim-site/edit/{interimSiteId}',
    options: requireOperator,
    ...selectOverseasSitesInterimSiteEditEntryGetController
  },
  {
    method: 'GET',
    path: '/accreditation/select-overseas-sites/{applicationId}/interim-site/add/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesInterimSiteAddEntryGetController
  },
  {
    method: 'GET',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}/interim-site/add/{siteId}',
    options: requireOperator,
    ...selectOverseasSitesInterimSiteAddEntryGetController
  },
  {
    method: 'POST',
    path: '/accreditation/select-overseas-sites/{applicationId}',
    options: requireOperator,
    ...selectOverseasSitesPostController
  },
  {
    method: 'POST',
    path: '/{language}/accreditation/select-overseas-sites/{applicationId}',
    options: requireOperator,
    ...selectOverseasSitesPostController
  }
]

export const selectOverseasSites = {
  plugin: {
    name: 'select-overseas-sites',
    register(server) {
      server.route(routes)
    }
  }
}
