import { defineConfig } from '@playwright/test'

// Browser tests that need neither a database nor Next: `npm run test:visual`. PLAYWRIGHT_CHROMIUM_PATH selects the Chromium binary, as for test:e2e.
export default defineConfig({
  testDir: 'tests/visual', testMatch: '**/*.spec.ts', fullyParallel: true, timeout: 60_000, expect: { timeout: 8_000 }, reporter: [['list']], outputDir: 'test-results',
  use: { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] } },
})
