import Blankie from 'blankie'
import { config } from '../../../config/config.js'
import { isAnalyticsEnabled } from '../analytics/enabled.js'
import { analyticsOrigins } from '../analytics/origins.js'

// Supports a GOV.UK frontend script bundled within Nunjucks macros
// https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
const govukInlineScriptHash =
  "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"

/**
 * Analytics widens connect, script and img sources only. frameSrc and nonces
 * stay closed: they're needed for Google Tag Manager (its noscript iframe and
 * the tags it injects), which this policy does not allow.
 * @param {{ allowAnalytics: boolean, apiBaseUrl: string }} options
 */
export const cspOptions = ({ allowAnalytics, apiBaseUrl }) => ({
  defaultSrc: ['self'],
  fontSrc: ['self', 'data:'],
  connectSrc: [
    'self',
    'wss',
    'data:',
    ...(allowAnalytics ? analyticsOrigins.connect : [])
  ],
  mediaSrc: ['self'],
  styleSrc: ['self'],
  scriptSrc: [
    'self',
    govukInlineScriptHash,
    ...(allowAnalytics ? analyticsOrigins.script : [])
  ],
  imgSrc: ['self', 'data:', ...(allowAnalytics ? analyticsOrigins.img : [])],
  frameSrc: ['self', 'data:'],
  objectSrc: ['none'],
  frameAncestors: ['none'],
  formAction: ['self', apiBaseUrl],
  manifestSrc: ['self'],
  generateNonces: false
})

/**
 * Manage content security policies.
 *
 * `options` is a getter so the policy reflects config at the point the server
 * registers the plugin, not when this module is first imported.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  get options() {
    return cspOptions({
      allowAnalytics: isAnalyticsEnabled(),
      apiBaseUrl: config.get('api.baseUrl')
    })
  }
}

export { contentSecurityPolicy }
