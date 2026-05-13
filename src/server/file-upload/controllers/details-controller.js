import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import {
  FILE_UPLOAD_SESSION_KEY,
  MATERIALS,
  getYearOptions
} from '../constants.js'

function renderDetails(h, viewData) {
  return h.view('file-upload/views/details', viewData)
}

function buildViewData(t, payload = {}, errors = {}) {
  return {
    pageTitle: t('pages.fileUpload.details.title'),
    heading: t('pages.fileUpload.details.heading'),
    materials: MATERIALS,
    yearOptions: getYearOptions(),
    payload,
    errors
  }
}

export const fileUploadDetailsGetController = {
  options: { auth: { mode: 'required' } },
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const session = request.yar.get(FILE_UPLOAD_SESSION_KEY) ?? {}
    return renderDetails(
      h,
      buildViewData(t, { material: session.material, year: session.year })
    )
  }
}

export const fileUploadDetailsPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { material, year } = request.payload
    const errors = {}

    if (!material) {
      errors.material = {
        text: t('pages.fileUpload.details.errors.materialRequired')
      }
    }
    if (!year) {
      errors.year = {
        text: t('pages.fileUpload.details.errors.yearRequired')
      }
    }

    if (Object.keys(errors).length > 0) {
      return renderDetails(
        h,
        buildViewData(t, { material, year }, errors)
      ).code(400)
    }

    const session = request.yar.get(FILE_UPLOAD_SESSION_KEY) ?? {}
    request.yar.set(FILE_UPLOAD_SESSION_KEY, { ...session, material, year })

    return h.redirect('/file-upload/upload')
  }
}
