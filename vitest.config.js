import { loadEnv } from 'vite'
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? 'test', process.cwd(), '')
  return {
    test: {
      globals: true,
      environment: 'node',
      env,
      clearMocks: true,
      hookTimeout: 30000,
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.js'],
        exclude: [
          ...configDefaults.exclude,
          '.public',
          'coverage',
          'postcss.config.js',
          'stylelint.config.js',
          'vitest.config.js',
          '.sonarlint',
          'babel.config.cjs',
          'src/server/common/api-client.example.js'
        ]
      }
    }
  }
})
