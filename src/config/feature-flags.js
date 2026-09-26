/**
 * Feature-flag convict schema, kept out of config.js.
 *
 * Its own file for two reasons: config.js had reached the 500-line limit, and
 * flags are the one part of the schema that is meant to be short-lived. A flag
 * arrives, gets flipped on, and is deleted again once the behaviour is
 * unconditional — churn that is easier to see and to review on its own than
 * buried in a 500-line schema.
 *
 * Spread into the main schema under the `featureFlags` key, so
 * `config.get('featureFlags.x')` is unchanged.
 */
export const featureFlagsSchema = {
  multipleInterimSitesEnabled: {
    doc: 'RA-603. Allow an overseas reprocessing site to carry more than one interim site: shows every one it has, and offers "Add another interim site". Off by default. The same flag name and default exist in epr-register-enrol-management-fe and the two are meant to be flipped together - with this on and that off, a regulator would see fewer interim sites than the operator entered.',
    format: Boolean,
    default: false,
    env: 'MULTIPLE_INTERIM_SITES_ENABLED'
  }
}
