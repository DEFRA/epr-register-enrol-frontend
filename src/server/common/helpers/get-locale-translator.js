import { getTranslator } from '../../../config/nunjucks/helpers/get-translation.js'

/**
 * Extract current locale from request path and return translator.
 * @param {Object} request - Hapi request object
 * @returns {Object} Object containing currentLocale and translator function (t)
 */
export function getLocaleAndTranslator(request) {
  const localeMatch = request.path.match(/^\/(en|cy)/)
  const currentLocale = localeMatch ? localeMatch[1] : 'en'
  
  // Block Welsh language access
  if (currentLocale === 'cy') {
    const error = new Error('Welsh translations not available yet')
    error.status = 503
    error.isBoom = true
    error.output = {
      statusCode: 503,
      payload: {
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Welsh translations not available yet'
      },
      headers: {}
    }
    throw error
  }
  
  const t = getTranslator(currentLocale)

  return {
    currentLocale,
    t
  }
}
