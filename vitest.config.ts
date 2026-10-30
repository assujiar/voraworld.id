import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/http/**', 'node_modules/**'],
    globalSetup: ['tests/setup/global.ts'],
    setupFiles: ['tests/setup/per-file.ts', 'tests/setup/next-mocks.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    env: { NODE_ENV: 'test', APP_ENV: 'test', PUBLIC_BASE_URL: 'http://testserver' },
  },
})
