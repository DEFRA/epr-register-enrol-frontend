import inert from '@hapi/inert'

import { config } from '../config/config.js'
import { stubCdp } from './stub-cdp/index.js'
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
import { tonnage } from './accreditation/tonnage/index.js'
import { businessPlan } from './accreditation/business-plan/index.js'
import { businessPlanDetail } from './accreditation/business-plan-detail/index.js'
import { businessPlanCya } from './accreditation/business-plan-cya/index.js'
import { tonnageAuthority } from './accreditation/tonnage-authority/index.js'
import { tonnageCya } from './accreditation/tonnage-cya/index.js'
import { fileUpload } from './file-upload/index.js'
import { submitDeclaration } from './accreditation/submit-declaration/index.js'
import { submitConfirmation } from './accreditation/submit-confirmation/index.js'
import { samplingPlanUpload } from './accreditation/sampling-plan-upload/index.js'
import { selectOverseasSites } from './accreditation/select-overseas-sites/index.js'
import { confirmOverseasSites } from './accreditation/confirm-overseas-sites/index.js'
import { uploadEvidenceForOverseasSite } from './accreditation/upload-evidence-for-overseas-site/index.js'
import { uploadBesEvidence } from './accreditation/upload-bes-evidence/index.js'
import { uploadMoreEvidence } from './accreditation/upload-more-evidence/index.js'
import { cyaEvidenceForOverseasSite } from './accreditation/cya-evidence-for-overseas-site/index.js'
import { checkSiteConditions } from './accreditation/check-site-conditions/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Auth routes (login, callback, logout, stub chooser)
      await server.register([authRoutes])

      if (config.get('fileUpload.uploaderStubEnabled')) {
        await server.register(stubCdp)
      }

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
        tonnage,
        businessPlan,
        businessPlanDetail,
        businessPlanCya,
        tonnageAuthority,
        tonnageCya,
        fileUpload,
        submitDeclaration,
        submitConfirmation,
        samplingPlanUpload,
        selectOverseasSites,
        confirmOverseasSites,
        uploadEvidenceForOverseasSite,
        uploadBesEvidence,
        uploadMoreEvidence,
        cyaEvidenceForOverseasSite,
        checkSiteConditions
      ])

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
