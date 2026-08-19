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
  materialType: Joi.string().valid(...MATERIAL_TYPES)
}

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

export const routeParamsGuard = {
  plugin: {
    name: 'route-params-guard',
    register(server) {
      server.ext('onPreHandler', (request, h) => {
        const invalidParam = findInvalidParam(request.params)
        if (invalidParam) {
          throw Boom.badRequest(`Invalid ${invalidParam} in request path.`)
        }
        return h.continue
      })
    }
  }
}
