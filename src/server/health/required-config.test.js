import { getMissingRequiredConfig } from './required-config.js'

// All fields default to a valid, present, non-local config — an all-healthy
// state — so each test only needs to say which value(s) it's blanking out.
function makeConfig(overrides = {}) {
  const values = {
    environment: 'ext-test',
    'auth.stubEnabled': false,
    'api.baseUrl': 'http://backend.test',
    'api.stubEnabled': false,
    'api.sharedSecret': 'shared-secret',
    'reex.frontendBaseUrl': 'http://reex-frontend.test',
    'auth.defraId.manageAccountUrl': 'http://manage-account.test',
    'auth.azureEntraId.tenantId': 'tenant-id',
    'auth.defraId.serviceId': 'service-id',
    'auth.callbackBaseUrl': 'https://app.test',
    ...overrides
  }
  return { get: (key) => values[key] }
}

describe('#getMissingRequiredConfig', () => {
  test('returns empty when all required config is present', () => {
    expect(getMissingRequiredConfig(makeConfig())).toEqual([])
  })

  test('flags API_BASE_URL when blank outside local', () => {
    expect(getMissingRequiredConfig(makeConfig({ 'api.baseUrl': '' }))).toEqual(
      ['API_BASE_URL']
    )
  })

  test('does not flag API_BASE_URL in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ environment: 'local', 'api.baseUrl': '' })
      )
    ).toEqual([])
  })

  test('flags API_BASE_URL even when api.stubEnabled is true — realApiClient always contacts the backend', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'api.baseUrl': '', 'api.stubEnabled': true })
      )
    ).toEqual(['API_BASE_URL'])
  })

  test('flags AUTH_SHARED_SECRET__BACKEND when blank, non-local', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'api.sharedSecret': '' }))
    ).toEqual(['AUTH_SHARED_SECRET__BACKEND'])
  })

  test('flags AUTH_SHARED_SECRET__BACKEND even when api.stubEnabled is true — realApiClient always contacts the backend', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'api.sharedSecret': '', 'api.stubEnabled': true })
      )
    ).toEqual(['AUTH_SHARED_SECRET__BACKEND'])
  })

  test('does not flag AUTH_SHARED_SECRET__BACKEND in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ environment: 'local', 'api.sharedSecret': '' })
      )
    ).toEqual([])
  })

  test('flags REEX_FRONTEND_BASE_URL when blank, real auth, non-local', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'reex.frontendBaseUrl': '' }))
    ).toEqual(['REEX_FRONTEND_BASE_URL'])
  })

  // RA-459: unconditionally required now — it's the fallback destination for
  // operatorHomeUrl() (accreditation session-expiry redirect, task list's
  // save-and-come-back-later link) regardless of stub/local, unlike the
  // other real-auth-only config below.
  test('flags REEX_FRONTEND_BASE_URL when blank even with auth.stubEnabled true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'reex.frontendBaseUrl': '', 'auth.stubEnabled': true })
      )
    ).toEqual(['REEX_FRONTEND_BASE_URL'])
  })

  test('flags REEX_FRONTEND_BASE_URL when blank even in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ environment: 'local', 'reex.frontendBaseUrl': '' })
      )
    ).toEqual(['REEX_FRONTEND_BASE_URL'])
  })

  test('flags DEFRA_ID_MANAGE_ACCOUNT_URL when blank, real auth, non-local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'auth.defraId.manageAccountUrl': '' })
      )
    ).toEqual(['DEFRA_ID_MANAGE_ACCOUNT_URL'])
  })

  test('does not flag DEFRA_ID_MANAGE_ACCOUNT_URL when auth.stubEnabled is true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({
          'auth.defraId.manageAccountUrl': '',
          'auth.stubEnabled': true
        })
      )
    ).toEqual([])
  })

  test('does not flag DEFRA_ID_MANAGE_ACCOUNT_URL in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({
          environment: 'local',
          'auth.defraId.manageAccountUrl': ''
        })
      )
    ).toEqual([])
  })

  test('flags ENTRA_TENANT_ID when blank, real auth, non-local', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'auth.azureEntraId.tenantId': '' }))
    ).toEqual(['ENTRA_TENANT_ID'])
  })

  test('does not flag ENTRA_TENANT_ID when auth.stubEnabled is true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({
          'auth.azureEntraId.tenantId': '',
          'auth.stubEnabled': true
        })
      )
    ).toEqual([])
  })

  test('flags DEFRA_ID_SERVICE_ID when blank, real auth, non-local', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'auth.defraId.serviceId': '' }))
    ).toEqual(['DEFRA_ID_SERVICE_ID'])
  })

  test('does not flag DEFRA_ID_SERVICE_ID when auth.stubEnabled is true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'auth.defraId.serviceId': '', 'auth.stubEnabled': true })
      )
    ).toEqual([])
  })

  test('flags AUTH_CALLBACK_BASE_URL when still the localhost default outside local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'auth.callbackBaseUrl': 'http://localhost:3000' })
      )
    ).toEqual(['AUTH_CALLBACK_BASE_URL'])
  })

  test('does not flag AUTH_CALLBACK_BASE_URL default in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({
          environment: 'local',
          'auth.callbackBaseUrl': 'http://localhost:3000'
        })
      )
    ).toEqual([])
  })

  test('lists every missing key at once', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({
          'api.baseUrl': '',
          'api.sharedSecret': '',
          'reex.frontendBaseUrl': '',
          'auth.defraId.manageAccountUrl': '',
          'auth.azureEntraId.tenantId': '',
          'auth.defraId.serviceId': '',
          'auth.callbackBaseUrl': 'http://localhost:3000'
        })
      )
    ).toEqual([
      'API_BASE_URL',
      'AUTH_SHARED_SECRET__BACKEND',
      'REEX_FRONTEND_BASE_URL',
      'DEFRA_ID_MANAGE_ACCOUNT_URL',
      'ENTRA_TENANT_ID',
      'DEFRA_ID_SERVICE_ID',
      'AUTH_CALLBACK_BASE_URL'
    ])
  })
})
