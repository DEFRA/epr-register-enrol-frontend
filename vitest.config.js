import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      BASIC_USER: 'test-user',
      BASIC_PASSWD: 'test-pass'
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
