import Boom from '@hapi/boom'
import Joi from 'joi'

// M1 (2026-08-08 pentest report): the app had zero input validation anywhere,
// including on the ID-shaped path params (applicationId, siteId, etc.) that
// flow straight into backend API calls. This is a single global check rather
// than per-route Joi schemas, since every route in the app shares the same
// small set of path param names/shapes — one guard here covers all of them
// and can't be forgotten on a new route the way a per-route schema can.
//
// applicationId/organisationId/registrationId/companiesHouseNo use a lenient
// safe-charset + length cap rather than a strict format (e.g. Mongo ObjectId)
// because these ids ultimately come from external systems (ReEx, Defra ID,
// Companies House) whose exact formats this app doesn't own and shouldn't
// assume — the goal here is blocking injection/traversal/oversized values,
// not re-validating an external system's id format.
const SAFE_ID = Joi.string()
  .trim()
  .min(1)
  .max(100)
  .pattern(/^[\w.:-]+$/)

const MATERIAL_TYPES = [
  'Steel',
  'Wood',
  'Aluminium',
  'Fibre',
  'Glass',
  'Paper',
  'Plastic'
]

const PARAM_SCHEMAS = {
  applicationId: SAFE_ID,
  organisationId: SAFE_ID,
  registrationId: SAFE_ID,
  companiesHouseNo: SAFE_ID,
  siteId: Joi.number().integer().positive(),
  // Not a calendar-year range check on purpose: E2E/test tooling seeds
  // disposable accreditation years thousands of years in the future
  // (year + a large offset band) specifically to dodge collisions with
  // records Mongo persists between runs. This just bounds it to a sane
  // positive integer, not "a real year".
  year: Joi.number().integer().positive().max(999999),
  language: Joi.string().valid('en', 'cy'),
  // Insensitive: the Re-Ex frontend links here with lowercase material
  // slugs (the same casing the backend's own material field uses, e.g.
  // "paper"), while everywhere downstream in this app — translation keys,
  // the backend seed URL, STATUS_CONFIG lookups — expects the capitalised
  // form ("Paper"). Reject on shape, but let normaliseParams below fix the
  // case rather than 400ing a link this app doesn't control the source of.
  materialType: Joi.string()
    .valid(...MATERIAL_TYPES)
    .insensitive()
}

// Only materialType's schema value can differ from its raw input (case
// normalisation) — every other schema here validates shape without
// transforming the value. Scoped explicitly rather than rewriting every
// schema-having param, so this guard can't silently start coercing types
// (e.g. siteId/year strings to numbers) for params no route has asked for
// or tested that coercion against.
const NORMALISED_PARAM_KEYS = ['materialType']

export function findInvalidParam(params) {
  for (const [key, value] of Object.entries(params ?? {})) {
    const schema = PARAM_SCHEMAS[key]
    if (!schema) continue
    const { error } = schema.validate(value)
    if (error) {
      return key
    }
  }
  return null
}

// Rewrites params in place to the canonical casing their schema validated
// against. Only touches the keys in NORMALISED_PARAM_KEYS (materialType) —
// see the comment there for why the rest are left as-is.
export function normaliseParams(params) {
  for (const key of NORMALISED_PARAM_KEYS) {
    if (!(key in (params ?? {}))) continue
    const { value: normalised } = PARAM_SCHEMAS[key].validate(params[key])
    params[key] = normalised
  }
}

export const routeParamsGuard = {
  plugin: {
    name: 'route-params-guard',
    register(server) {
      server.ext('onPreHandler', (request, h) => {
        // Single pass per param (not findInvalidParam then normaliseParams)
        // so a request with N schema-having params only calls
        // schema.validate() N times, not 2N.
        for (const [key, value] of Object.entries(request.params ?? {})) {
          const schema = PARAM_SCHEMAS[key]
          if (!schema) continue
          const { error, value: normalised } = schema.validate(value)
          if (error) {
            throw Boom.badRequest(`Invalid ${key} in request path.`)
          }
          if (NORMALISED_PARAM_KEYS.includes(key)) {
            request.params[key] = normalised
          }
        }
        return h.continue
      })
    }
  }
}
