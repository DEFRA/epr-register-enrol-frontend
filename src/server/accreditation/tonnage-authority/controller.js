import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/

// Material and site are shown once, in the persistent application-header
// (see src/server/common/helpers/applicationHeader.js), so this heading no
// longer repeats them.
export function buildHeading(isExporter, t) {
  return isExporter
    ? t('pages.tonnageAuthority.headingPrefixExporter')
    : t('pages.tonnageAuthority.headingPrefix')
}

export function buildAuthoriserRows(authorisers) {
  return (authorisers ?? []).map((a, i) => ({
    index: i,
    fullName: a.fullName,
    email: a.email,
    checked: true
  }))
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function tonnageUrl(applicationId) {
  return `/accreditation/tonnage/${applicationId}`
}

function tonnageCyaUrl(applicationId) {
  return `/accreditation/tonnage-cya/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/tonnage-authority/index', viewData)
}

function buildViewData(application, t, applicationId, opts = {}) {
  const isExporter = application.isExporter ?? false
  return {
    pageTitle: isExporter
      ? t('pages.tonnageAuthority.titleExporter')
      : t('pages.tonnageAuthority.title'),
    heading: buildHeading(isExporter, t),
    authoriserRows: buildAuthoriserRows(application.prns?.authorisers),
    backLink: tonnageUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    isExporter,
    intro: isExporter
      ? t('pages.tonnageAuthority.introExporter')
      : t('pages.tonnageAuthority.intro'),
    selectSubHeading: isExporter
      ? t('pages.tonnageAuthority.selectSubHeadingExporter')
      : t('pages.tonnageAuthority.selectSubHeading'),
    ...opts
  }
}

export const tonnageAuthorityGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      logControllerError(
        request.server.logger,
        err,
        { applicationId },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        pageTitle: t('pages.tonnageAuthority.title'),
        heading: buildHeading(false, t),
        authoriserRows: [],
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter: false,
        intro: t('pages.tonnageAuthority.intro'),
        selectSubHeading: t('pages.tonnageAuthority.selectSubHeading'),
        error: t('pages.tonnageAuthority.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.prns?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    if (!application.prns?.plannedTonnageBand) {
      return h.redirect(tonnageUrl(applicationId))
    }

    const isExporter = application.isExporter ?? false
    const sectionKey = isExporter ? 'perns' : 'prns'
    const queryNote = resolveRegulatorQueryNote(application, { readOnly })

    return renderPage(
      h,
      buildViewData(application, t, applicationId, {
        queryNote,
        querySummary: queryNote
          ? buildRegulatorQuerySummary(sectionKey, t)
          : null,
        readOnly,
        // RA-481: only route back to the query task list while the
        // application itself is mid-query — a locked-but-not-queried
        // application is read-only for a different reason and belongs back
        // on the tonnage page, which renders read-only in that case too.
        backLink:
          application.applicationStatus === 'Queried'
            ? queryTaskListUrl(applicationId)
            : tonnageUrl(applicationId),
        isQueriedApplication: application.applicationStatus === 'Queried'
      })
    )
  }
}

export const tonnageAuthorityPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const {
      submitAction = 'saveAndContinue',
      selectedEmails,
      newFullName,
      newEmail
    } = request.payload

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      logControllerError(
        request.server.logger,
        err,
        { applicationId },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        pageTitle: t('pages.tonnageAuthority.title'),
        heading: buildHeading(false, t),
        authoriserRows: [],
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter: false,
        intro: t('pages.tonnageAuthority.intro'),
        selectSubHeading: t('pages.tonnageAuthority.selectSubHeading'),
        error: t('pages.tonnageAuthority.validation.fetchError')
      }).code(500)
    }

    const guardRedirect = guardSectionWrite({
      h,
      application,
      sectionStatus: application.prns?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    if (!application.prns?.plannedTonnageBand) {
      return h.redirect(tonnageUrl(applicationId))
    }

    const isExporter = application.isExporter ?? false
    const heading = buildHeading(isExporter, t)
    const intro = isExporter
      ? t('pages.tonnageAuthority.introExporter')
      : t('pages.tonnageAuthority.intro')
    const selectSubHeading = isExporter
      ? t('pages.tonnageAuthority.selectSubHeadingExporter')
      : t('pages.tonnageAuthority.selectSubHeading')
    const currentAuthorisers = application.prns?.authorisers ?? []

    if (submitAction === 'addAuthoriser') {
      const addErrors = {}
      if (!newFullName?.trim()) {
        addErrors.newFullName = {
          text: t('pages.tonnageAuthority.validation.nameRequired')
        }
      }
      if (!newEmail?.trim()) {
        addErrors.newEmail = {
          text: t('pages.tonnageAuthority.validation.emailRequired')
        }
      } else if (!EMAIL_RE.test(newEmail.trim())) {
        addErrors.newEmail = {
          text: t('pages.tonnageAuthority.validation.emailInvalid')
        }
      }

      if (Object.keys(addErrors).length > 0) {
        return renderPage(h, {
          pageTitle: isExporter
            ? t('pages.tonnageAuthority.titleExporter')
            : t('pages.tonnageAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers),
          backLink: tonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
          isExporter,
          intro,
          selectSubHeading,
          showAddForm: true,
          addErrors,
          newFullName: newFullName ?? '',
          newEmail: newEmail ?? ''
        }).code(400)
      }

      const trimmedEmail = newEmail.trim()
      const isDuplicate = currentAuthorisers.some(
        (a) => a.email.toLowerCase() === trimmedEmail.toLowerCase()
      )
      if (isDuplicate) {
        addErrors.newEmail = {
          text: t('pages.tonnageAuthority.validation.emailDuplicate')
        }
      }

      if (Object.keys(addErrors).length > 0) {
        return renderPage(h, {
          pageTitle: isExporter
            ? t('pages.tonnageAuthority.titleExporter')
            : t('pages.tonnageAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers),
          backLink: tonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
          isExporter,
          intro,
          selectSubHeading,
          showAddForm: true,
          addErrors,
          newFullName: newFullName ?? '',
          newEmail: newEmail ?? ''
        }).code(400)
      }

      const updatedAuthorisers = [
        ...currentAuthorisers,
        {
          fullName: newFullName.trim(),
          email: trimmedEmail,
          addedForAuthorityToIssue: true
        }
      ]
      try {
        await accreditationApiService.patchTonnage(
          organisationId,
          applicationId,
          { authorisers: updatedAuthorisers }
        )
      } catch (err) {
        logControllerError(
          request.server.logger,
          err,
          { applicationId },
          `Error adding authoriser for application ${applicationId}`
        )
        return renderPage(h, {
          pageTitle: isExporter
            ? t('pages.tonnageAuthority.titleExporter')
            : t('pages.tonnageAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers),
          backLink: tonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
          isExporter,
          intro,
          selectSubHeading,
          showAddForm: true,
          newFullName: newFullName.trim(),
          newEmail: trimmedEmail,
          error: t('pages.tonnageAuthority.validation.saveError')
        }).code(500)
      }
      return h.redirect(`/accreditation/tonnage-authority/${applicationId}`)
    }

    const checkedEmails = selectedEmails
      ? Array.isArray(selectedEmails)
        ? selectedEmails
        : [selectedEmails]
      : []

    if (submitAction !== 'saveAndComeLater' && checkedEmails.length === 0) {
      return renderPage(h, {
        pageTitle: isExporter
          ? t('pages.tonnageAuthority.titleExporter')
          : t('pages.tonnageAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers).map((r) => ({
          ...r,
          checked: checkedEmails.includes(r.email)
        })),
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter,
        intro,
        selectSubHeading,
        errors: {
          authorisers: {
            text: t('pages.tonnageAuthority.validation.selectAtLeastOne')
          }
        }
      }).code(400)
    }

    const authorisersToSave = currentAuthorisers.filter((a) =>
      checkedEmails.includes(a.email)
    )
    const isSaveAndComeLater = submitAction === 'saveAndComeLater'

    try {
      await accreditationApiService.patchTonnage(
        organisationId,
        applicationId,
        {
          authorisers: authorisersToSave,
          ...(isSaveAndComeLater ? { sectionStatus: 'InProgress' } : {})
        }
      )
    } catch (err) {
      logControllerError(
        request.server.logger,
        err,
        { applicationId },
        `Error saving authorisers for application ${applicationId}`
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to the
      // section's own page so it re-fetches and renders read-only.
      if (err.status === statusCodes.conflict) {
        return h.redirect(request.path)
      }
      return renderPage(h, {
        pageTitle: isExporter
          ? t('pages.tonnageAuthority.titleExporter')
          : t('pages.tonnageAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers).map((r) => ({
          ...r,
          checked: checkedEmails.includes(r.email)
        })),
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter,
        intro,
        selectSubHeading,
        errors: {
          authorisers: {
            text: t('pages.tonnageAuthority.validation.saveError')
          }
        }
      }).code(500)
    }

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }
    return h.redirect(tonnageCyaUrl(applicationId))
  }
}
