import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '../../config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'
import { getTranslator } from '../helpers/get-translation.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

let webpackManifest

export function context(request) {
  if (!webpackManifest) {
    try {
      webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Webpack ${path.basename(manifestPath)} not found`)
    }
  }

  const currentPath = request.path.replace(/^\/(en|cy)/, '') || '/'
  // Detect current locale from the request path
  const localeMatch = request.path.match(/^\/(en|cy)/)
  const currentLocale = localeMatch ? localeMatch[1] : 'en'
  // Get the translation function for the current locale
  const t = getTranslator(currentLocale)

  const user = request.auth?.credentials ?? null

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      const webpackAssetPath = webpackManifest?.[asset]
      return `${assetPath}/${webpackAssetPath ?? asset}`
    },
    currentPath,
    currentLocale,
    t,
    user,
    userType: user?.userType ?? null
  }
}
