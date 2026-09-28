import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  isRegulatorQueryBannerVisible
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import {
  getSelection,
  setSelection,
  clearSelection
} from '../../common/helpers/tonnageAuthoritySelectionSession.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/

// Material and site are shown once, in the persistent application-header
// (see src/server/common/helpers/applicationHeader.js), so this heading no
// longer repeats them.
export function buildHeading(isExporter, t) {
  return isExporter
    ? t('pages.tonnageAuthority.headingPrefixExporter')
    : t('pages.tonnageAuthority.headingPrefix')
}

// RA-555: `checked` used to be a hardcoded `true`, so every render re-ticked
// every authoriser and an operator's untick survived nothing - not a redirect,
// not a validation error, not a failed save. Callers now pass the selection
// they want rendered: the submitted checkboxes on a re-render, or the
// session-held selection (seeded from the saved authorisers on a first visit)
// on a fresh GET.
export function buildAuthoriserRows(authorisers, selectedEmails) {
  const selected = selectedEmails ?? []
  return (authorisers ?? []).map((a, i) => ({
    index: i,
    fullName: a.fullName,
    email: a.email,
    checked: selected.includes(a.email)
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
  const { selectedEmails, ...rest } = opts
  return {
    pageTitle: isExporter
      ? t('pages.tonnageAuthority.titleExporter')
      : t('pages.tonnageAuthority.title'),
    heading: buildHeading(isExporter, t),
    authoriserRows: buildAuthoriserRows(
      application.prns?.authorisers,
      selectedEmails
    ),
    backLink: tonnageUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    isExporter,
    intro: isExporter
      ? t('pages.tonnageAuthority.introExporter')
      : t('pages.tonnageAuthority.intro'),
    selectSubHeading: isExporter
      ? t('pages.tonnageAuthority.selectSubHeadingExporter')
      : t('pages.tonnageAuthority.selectSubHeading'),
    ...rest
  }
}

// Shared by both controllers below (SonarCloud duplication): the fetch-failure page is
// identical whether the request was a GET or a POST.
function renderFetchErrorPage(h, t, applicationId) {
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

export const tonnageAuthorityGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () => renderFetchErrorPage(h, t, applicationId)
    })
    if (errorResponse) {
      return errorResponse
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
    const queried = isRegulatorQueryBannerVisible(application, { readOnly })

    // RA-555: render the operator's in-progress selection if they have one.
    // With none stored, default to every saved authoriser selected, which is
    // what this page did unconditionally before.
    const selectedEmails =
      getSelection(request, applicationId) ??
      (application.prns?.authorisers ?? []).map((a) => a.email)

    return renderPage(
      h,
      buildViewData(application, t, applicationId, {
        selectedEmails,
        queried,
        querySummary: queried
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

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () => renderFetchErrorPage(h, t, applicationId)
    })
    if (errorResponse) {
      return errorResponse
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

    // RA-555: normalised up here rather than inside the save branch, because
    // the add branch needs the operator's tick state too - both to re-render
    // it on a validation error and to carry it across the redirect.
    const checkedEmails = selectedEmails
      ? Array.isArray(selectedEmails)
        ? selectedEmails
        : [selectedEmails]
      : []

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
          authoriserRows: buildAuthoriserRows(
            currentAuthorisers,
            checkedEmails
          ),
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
          authoriserRows: buildAuthoriserRows(
            currentAuthorisers,
            checkedEmails
          ),
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

      // RA-555: this is the fix for the reported bug. The redirect below drops
      // the payload, so without this the next GET re-seeded from the saved
      // authorisers and every untick came back ticked. The newly added
      // authoriser joins the selection, matching the previous behaviour where
      // a new row always arrived ticked.
      setSelection(request, applicationId, [...checkedEmails, trimmedEmail])

      try {
        await accreditationApiService.patchTonnage(
          organisationId,
          applicationId,
          { authorisers: updatedAuthorisers }
        )
      } catch (err) {
        logStructuredError(
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
          authoriserRows: buildAuthoriserRows(
            currentAuthorisers,
            checkedEmails
          ),
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

    if (submitAction !== 'saveAndComeLater' && checkedEmails.length === 0) {
      return renderPage(h, {
        pageTitle: isExporter
          ? t('pages.tonnageAuthority.titleExporter')
          : t('pages.tonnageAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers, checkedEmails),
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
      logStructuredError(
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
        authoriserRows: buildAuthoriserRows(currentAuthorisers, checkedEmails),
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

    // RA-555: the selection has landed in the backend, and because saving
    // drops unticked authorisers the saved list now *is* the selection - so a
    // later visit re-seeds to exactly what the operator last saw. Clearing
    // also bounds how long a stale selection can sit in the session.
    clearSelection(request)

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }
    return h.redirect(tonnageCyaUrl(applicationId))
  }
}
