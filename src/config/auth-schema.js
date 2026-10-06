/**
 * Auth convict schema, kept out of config.js to hold that file under the
 * 500-line limit.
 *
 * Spread into the main schema under the `auth` key, so
 * `config.get('auth.x')` is unchanged.
 */
export const authSchema = {
  stubEnabled: {
    // Reads process.env directly rather than the validated `environment`
    // key: the schema is evaluated before convict() builds the config, so
    // config.get('environment') doesn't exist yet. This only affects the
    // *default* though; enforcement (assertSafeBootConfig in boot-guards.js)
    // reads both values via config.get(), fully validated.
    doc: 'Enable stub auth (bypasses real OAuth). Defaults true for non-prod.',
    format: Boolean,
    default: process.env.ENVIRONMENT !== 'prod',
    env: 'AUTH_STUB_ENABLED'
  },
  basicEnabled: {
    doc: 'Enable HTTP basic authentication. Defaults to false. Requires BASIC_USER and BASIC_PASSWD to be set — basic-auth-plugin.js throws at server registration if either is empty when this is enabled (not enforced here in config.js).',
    format: Boolean,
    default: false,
    env: 'AUTH_BASIC_ENABLED'
  },
  basicUsr: {
    doc: 'The username for HTTP basic authentication. Must be non-empty when AUTH_BASIC_ENABLED is true.',
    format: String,
    default: '',
    env: 'BASIC_USER'
  },
  basicPasswd: {
    doc: 'The password for HTTP basic authentication. Must be non-empty when AUTH_BASIC_ENABLED is true.',
    format: String,
    default: '',
    env: 'BASIC_PASSWD',
    sensitive: true
  },
  azureEntraId: {
    clientId: {
      format: String,
      default: '',
      env: 'ENTRA_CLIENT_ID',
      sensitive: true
    },
    clientSecret: {
      format: String,
      default: '',
      env: 'ENTRA_CLIENT_SECRET',
      sensitive: true
    },
    tenantId: {
      format: String,
      default: '',
      env: 'ENTRA_TENANT_ID'
    },
    regulatorRoleValue: {
      doc: 'RA-429. Entra ID app role a signed-in user must hold to be treated as a regulator.',
      format: String,
      default: 'Waste.Regulator.Standard',
      env: 'ENTRA_REGULATOR_ROLE_VALUE'
    },
    supportUserRoleValue: {
      doc: 'RA-429. Entra ID app role a signed-in user must hold to be treated as a read-only support user.',
      format: String,
      default: 'Waste.SupportUser.ReadOnly',
      env: 'ENTRA_SUPPORT_USER_ROLE_VALUE'
    }
  },
  defraId: {
    clientId: {
      format: String,
      default: '',
      env: 'DEFRA_ID_CLIENT_ID',
      sensitive: true
    },
    clientSecret: {
      format: String,
      default: '',
      env: 'DEFRA_ID_CLIENT_SECRET',
      sensitive: true
    },
    discoveryUrl: {
      doc: 'Full OIDC metadata URL for Defra ID — used to discover authorization_endpoint and token_endpoint',
      format: String,
      default: '',
      env: 'DEFRA_ID_DISCOVERY_URL'
    },
    serviceId: {
      doc: 'Defra ID service ID provided during onboarding',
      format: String,
      default: '',
      env: 'DEFRA_ID_SERVICE_ID'
    },
    // RA-487: mirrors the Re-Ex frontend's own DEFRA_ID_MANAGE_ACCOUNT_URL —
    // used for the top nav's "Manage account" link, the same Defra ID
    // account-management page Re-Ex itself links to, so the two services
    // present a single seamless identity.
    manageAccountUrl: {
      doc: 'Defra ID account-management URL, used for the top nav "Manage account" link.',
      format: String,
      default: '',
      env: 'DEFRA_ID_MANAGE_ACCOUNT_URL'
    }
  },
  callbackBaseUrl: {
    doc: 'Base URL for OAuth callback URLs (e.g. https://myapp.example.com)',
    format: String,
    default: 'http://localhost:3000',
    env: 'AUTH_CALLBACK_BASE_URL'
  },
  regulatorAccessDisabled: {
    doc: 'RA-427. Kill switch for the regulator side of the app while no regulator-facing features are built out yet. When true: the stub login chooser hides the "switch to regulator login" link, regulator login (both stub and real Entra ID) is not accessible (404), and no regulator pages are accessible (404). Operator login/pages are unaffected.',
    format: Boolean,
    default: false,
    env: 'REGULATOR_ACCESS_DISABLED'
  }
}
