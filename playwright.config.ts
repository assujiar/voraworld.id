import { defineConfig } from '@playwright/test'

// Browser tests: `npm run test:e2e` builds the app, starts a production server on a throw-away database (see
// tests/e2e/global-setup.ts) and drives it with Chromium. They need TEST_DATABASE_ADMIN_URL, like the other suites.
//   PLAYWRIGHT_CHROMIUM_PATH   use this Chromium/Chrome binary instead of the one `npx playwright install chromium` provides
//   E2E_PORT                   port of the test server (default 3310)
const port = Number(process.env.E2E_PORT || 3310)
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,                               // the specs share one server and one database
  timeout: 300_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] },
  },
})
