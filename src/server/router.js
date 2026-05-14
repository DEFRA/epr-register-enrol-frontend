import inert from '@hapi/inert'

import { home } from './home/index.js'
import { about } from './about/index.js'
import { health } from './health/index.js'
import { authRoutes } from './auth/index.js'
import { regulator } from './regulator/index.js'
import { worklistItems } from './worklist-items/index.js'
import { organisationList } from './organisation-list/index.js'
import { organisationDetails } from './organisation-details/index.js'
import { operator } from './operator/index.js'
import { operatorAccreditation } from './operator-accreditation/index.js'
import { operatorRegistration } from './operator-registration/index.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'
import { operatorDetails } from './operator-details/index.js'
import { operatorOrganisationDetails } from './operator-organisation-details/index.js'
import { taskList } from './accreditation/task-list/index.js'
import { prnsTonnage } from './accreditation/prns-tonnage/index.js'
import { businessPlan } from './accreditation/business-plan/index.js'
import { businessPlanDetail } from './accreditation/business-plan-detail/index.js'
import { businessPlanCya } from './accreditation/business-plan-cya/index.js'
import { prnsAuthority } from './accreditation/prns-authority/index.js'
import { prnsCya } from './accreditation/prns-cya/index.js'
import { submitDeclaration } from './accreditation/submit-declaration/index.js'
import { submitConfirmation } from './accreditation/submit-confirmation/index.js'
import { samplingPlanUpload } from './accreditation/sampling-plan-upload/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Auth routes (login, callback, logout, stub chooser)
      await server.register([authRoutes])

      // Application specific routes, add your own routes here
      await server.register([
        home,
        about,
        regulator,
        worklistItems,
        organisationList,
        organisationDetails,
        operator,
        operatorAccreditation,
        operatorRegistration,
        operatorDetails,
        operatorOrganisationDetails,
        taskList,
        prnsTonnage,
        businessPlan,
        businessPlanDetail,
        businessPlanCya,
        prnsAuthority,
        prnsCya,
        submitDeclaration,
        submitConfirmation,
        samplingPlanUpload
      ])

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
