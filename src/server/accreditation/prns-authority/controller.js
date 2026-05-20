import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { apiClient } from '../../common/api-client.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildHeading(materialType, siteName, t) {
  const prefix = t('pages.prnsAuthority.headingPrefix')
  const at = t('pages.prnsAuthority.headingAt')
  const material = materialType
    ? t(`pages.materialSelection.materials.${materialType}`)
    : ''
  const site = siteName || t('pages.taskList.siteNotSet')
  return `${prefix} ${material} ${at}: ${site}`
}

export function buildAuthoriserRows(authorisers, t) {
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

function prnsTonnageUrl(applicationId) {
  return `/accreditation/prns-tonnage/${applicationId}`
}

function prnsCyaUrl(applicationId) {
  return `/accreditation/prns-cya/${applicationId}`
}

function patchUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}/prns`
}

function appUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/prns-authority/index', viewData)
}

function buildViewData(application, t, applicationId, opts = {}) {
  return {
    pageTitle: t('pages.prnsAuthority.title'),
    heading: buildHeading(application.materialType, application.siteId, t),
    authoriserRows: buildAuthoriserRows(application.prns?.authorisers, t),
    backLink: prnsTonnageUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    ...opts
  }
}

export const prnsAuthorityGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsAuthority.title'),
        heading: buildHeading(null, null, t),
        authoriserRows: [],
        backLink: prnsTonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        error: t('pages.prnsAuthority.validation.fetchError')
      }).code(500)
    }

    return renderPage(h, buildViewData(application, t, applicationId))
  }
}

export const prnsAuthorityPostController = {
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
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsAuthority.title'),
        heading: buildHeading(null, null, t),
        authoriserRows: [],
        backLink: prnsTonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        error: t('pages.prnsAuthority.validation.fetchError')
      }).code(500)
    }

    const heading = buildHeading(
      application.materialType,
      application.siteId,
      t
    )
    const currentAuthorisers = application.prns?.authorisers ?? []

    if (submitAction === 'addAuthoriser') {
      const addErrors = {}
      if (!newFullName?.trim()) {
        addErrors.newFullName = {
          text: t('pages.prnsAuthority.validation.nameRequired')
        }
      }
      if (!newEmail?.trim()) {
        addErrors.newEmail = {
          text: t('pages.prnsAuthority.validation.emailRequired')
        }
      } else if (!EMAIL_RE.test(newEmail.trim())) {
        addErrors.newEmail = {
          text: t('pages.prnsAuthority.validation.emailInvalid')
        }
      }

      if (Object.keys(addErrors).length > 0) {
        return renderPage(h, {
          pageTitle: t('pages.prnsAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
          backLink: prnsTonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
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
          text: t('pages.prnsAuthority.validation.emailDuplicate')
        }
      }

      if (Object.keys(addErrors).length > 0) {
        return renderPage(h, {
          pageTitle: t('pages.prnsAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
          backLink: prnsTonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
          showAddForm: true,
          addErrors,
          newFullName: newFullName ?? '',
          newEmail: newEmail ?? ''
        }).code(400)
      }

      const updatedAuthorisers = [
        ...currentAuthorisers,
        { fullName: newFullName.trim(), email: trimmedEmail }
      ]
      try {
        await apiClient.patch(patchUrl(organisationId, applicationId), {
          authorisers: updatedAuthorisers
        })
      } catch (err) {
        request.server.logger.error(
          `Error adding authoriser for ${applicationId}: ${err.message}`
        )
        return renderPage(h, {
          pageTitle: t('pages.prnsAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
          backLink: prnsTonnageUrl(applicationId),
          taskListLink: taskListUrl(applicationId),
          showAddForm: true,
          newFullName: newFullName.trim(),
          newEmail: trimmedEmail,
          error: t('pages.prnsAuthority.validation.saveError')
        }).code(500)
      }
      return h.redirect(`/accreditation/prns-authority/${applicationId}`)
    }

    const checkedEmails = selectedEmails
      ? Array.isArray(selectedEmails)
        ? selectedEmails
        : [selectedEmails]
      : []

    if (submitAction !== 'saveAndComeLater' && checkedEmails.length === 0) {
      return renderPage(h, {
        pageTitle: t('pages.prnsAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers, t).map((r) => ({
          ...r,
          checked: checkedEmails.includes(r.email)
        })),
        backLink: prnsTonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        errors: {
          authorisers: {
            text: t('pages.prnsAuthority.validation.selectAtLeastOne')
          }
        }
      }).code(400)
    }

    const authorisersToSave = currentAuthorisers.filter((a) =>
      checkedEmails.includes(a.email)
    )

    try {
      await apiClient.patch(patchUrl(organisationId, applicationId), {
        authorisers: authorisersToSave
      })
    } catch (err) {
      request.server.logger.error(
        `Error saving authorisers for ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.prnsAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers, t).map((r) => ({
          ...r,
          checked: checkedEmails.includes(r.email)
        })),
        backLink: prnsTonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        errors: {
          authorisers: { text: t('pages.prnsAuthority.validation.saveError') }
        }
      }).code(500)
    }

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }
    return h.redirect(prnsCyaUrl(applicationId))
  }
}
