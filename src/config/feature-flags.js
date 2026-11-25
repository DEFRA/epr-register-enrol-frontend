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
  inYearChangesEnabled: {
    doc: 'In-year changes epic (from RA-425). Shows the operator in-year changes pages under /manage: so far the pages for viewing a current accreditation and its overseas reprocessing sites. Off by default; with it off every /manage route returns 404.',
    format: Boolean,
    default: false,
    env: 'IN_YEAR_CHANGES_ENABLED'
  }
}
