import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      BASIC_USER: 'test-user',
      BASIC_PASSWD: 'test-pass',
      // RA-459/RA-487: REEX_FRONTEND_BASE_URL and DEFRA_ID_MANAGE_ACCOUNT_URL
      // are both unconditionally required (required-config.js) and never
      // blank in any real environment, so tests shouldn't exercise the
      // (nonsensical) blank-default case either. Placeholders, not real
      // URLs — nothing here should ever call out to them.
      REEX_FRONTEND_BASE_URL: 'https://reex.example.test',
      DEFRA_ID_MANAGE_ACCOUNT_URL: 'https://manage-account.example.test'
    },
    clearMocks: true,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        ...configDefaults.exclude,
        '.public',
        'coverage',
        'postcss.config.js',
        'stylelint.config.js',
        'vitest.config.js',
        '.sonarlint',
        'babel.config.cjs'
      ],
      // Baseline as measured on 2026-08-19 (RA-437 90%-branch-coverage follow-up)
      // — fails the build on regression. Raise these as coverage improves; do
      // not lower without a reason.
      thresholds: {
        statements: 98,
        branches: 90,
        functions: 97,
        lines: 98
      }
    }
  }
})
