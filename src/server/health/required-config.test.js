import { getMissingRequiredConfig } from './required-config.js'

// All fields default to a valid, present, non-local config — an all-healthy
// state — so each test only needs to say which value(s) it's blanking out.
function makeConfig(overrides = {}) {
  const values = {
    environment: 'ext-test',
    'auth.stubEnabled': false,
    'api.baseUrl': 'http://backend.test',
    'api.stubEnabled': false,
    'fileUpload.cdpUploaderUrl': 'http://uploader.test',
    'reex.frontendBaseUrl': 'http://reex-frontend.test',
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

  test('flags CDP_UPLOADER_URL when blank and api.stubEnabled is false', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'fileUpload.cdpUploaderUrl': '' }))
    ).toEqual(['CDP_UPLOADER_URL'])
  })

  test('does not flag CDP_UPLOADER_URL when api.stubEnabled is true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'fileUpload.cdpUploaderUrl': '', 'api.stubEnabled': true })
      )
    ).toEqual([])
  })

  test('flags REEX_FRONTEND_BASE_URL when blank, real auth, non-local', () => {
    expect(
      getMissingRequiredConfig(makeConfig({ 'reex.frontendBaseUrl': '' }))
    ).toEqual(['REEX_FRONTEND_BASE_URL'])
  })

  test('does not flag REEX_FRONTEND_BASE_URL when auth.stubEnabled is true', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ 'reex.frontendBaseUrl': '', 'auth.stubEnabled': true })
      )
    ).toEqual([])
  })

  test('does not flag REEX_FRONTEND_BASE_URL in local', () => {
    expect(
      getMissingRequiredConfig(
        makeConfig({ environment: 'local', 'reex.frontendBaseUrl': '' })
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
          'fileUpload.cdpUploaderUrl': '',
          'reex.frontendBaseUrl': '',
          'auth.azureEntraId.tenantId': '',
          'auth.defraId.serviceId': '',
          'auth.callbackBaseUrl': 'http://localhost:3000'
        })
      )
    ).toEqual([
      'API_BASE_URL',
      'CDP_UPLOADER_URL',
      'REEX_FRONTEND_BASE_URL',
      'ENTRA_TENANT_ID',
      'DEFRA_ID_SERVICE_ID',
      'AUTH_CALLBACK_BASE_URL'
    ])
  })
})
