import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { buildMaterialDisplay } from '../../common/helpers/material-display.js'
import { siteNameFromAddress } from '../../common/helpers/site-name.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildHeading(
  materialType,
  glassRecyclingProcess,
  siteName,
  isExporter,
  t
) {
  const prefix = isExporter
    ? t('pages.tonnageAuthority.headingPrefixExporter')
    : t('pages.tonnageAuthority.headingPrefix')
  const at = t('pages.tonnageAuthority.headingAt')
  const material = materialType
    ? buildMaterialDisplay(materialType, glassRecyclingProcess, t)
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
    heading: buildHeading(
      application.materialType,
      application.glassRecyclingProcess,
      siteNameFromAddress(application.siteAddress),
      isExporter,
      t
    ),
    authoriserRows: buildAuthoriserRows(application.prns?.authorisers, t),
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
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.tonnageAuthority.title'),
        heading: buildHeading(null, null, null, false, t),
        authoriserRows: [],
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter: false,
        intro: t('pages.tonnageAuthority.intro'),
        selectSubHeading: t('pages.tonnageAuthority.selectSubHeading'),
        error: t('pages.tonnageAuthority.validation.fetchError')
      }).code(500)
    }

    return renderPage(h, buildViewData(application, t, applicationId))
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
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.tonnageAuthority.title'),
        heading: buildHeading(null, null, null, false, t),
        authoriserRows: [],
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter: false,
        intro: t('pages.tonnageAuthority.intro'),
        selectSubHeading: t('pages.tonnageAuthority.selectSubHeading'),
        error: t('pages.tonnageAuthority.validation.fetchError')
      }).code(500)
    }

    const isExporter = application.isExporter ?? false
    const heading = buildHeading(
      application.materialType,
      application.glassRecyclingProcess,
      siteNameFromAddress(application.siteAddress),
      isExporter,
      t
    )
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
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
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
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
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
        { fullName: newFullName.trim(), email: trimmedEmail }
      ]
      try {
        await accreditationApiService.patchTonnage(
          organisationId,
          applicationId,
          { authorisers: updatedAuthorisers }
        )
      } catch (err) {
        request.server.logger.error(
          `Error adding authoriser for ${applicationId}: ${err.message}`
        )
        return renderPage(h, {
          pageTitle: isExporter
            ? t('pages.tonnageAuthority.titleExporter')
            : t('pages.tonnageAuthority.title'),
          heading,
          authoriserRows: buildAuthoriserRows(currentAuthorisers, t),
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
        authoriserRows: buildAuthoriserRows(currentAuthorisers, t).map((r) => ({
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

    try {
      await accreditationApiService.patchTonnage(
        organisationId,
        applicationId,
        {
          authorisers: authorisersToSave
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving authorisers for ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: isExporter
          ? t('pages.tonnageAuthority.titleExporter')
          : t('pages.tonnageAuthority.title'),
        heading,
        authoriserRows: buildAuthoriserRows(currentAuthorisers, t).map((r) => ({
          ...r,
          checked: checkedEmails.includes(r.email)
        })),
        backLink: tonnageUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        isExporter,
        intro,
        selectSubHeading,
        errors: {
          authorisers: { text: t('pages.prnsAuthority.validation.saveError') }
        }
      }).code(500)
    }

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }
    return h.redirect(tonnageCyaUrl(applicationId))
  }
}
