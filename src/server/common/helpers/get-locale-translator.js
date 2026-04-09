import { getTranslator } from '../../../config/nunjucks/helpers/get-translation.js'

/**
 * Extract current locale from request path and return translator.
 * @param {Object} request - Hapi request object
 * @returns {Object} Object containing currentLocale and translator function (t)
 */
export function getLocaleAndTranslator(request) {
  const localeMatch = request.path.match(/^\/(en|cy)/)
  const currentLocale = localeMatch ? localeMatch[1] : 'en'

  const t = getTranslator(currentLocale)

  return {
    currentLocale,
    t
  }
}
