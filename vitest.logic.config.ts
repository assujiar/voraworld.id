import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
/** Pure financial arithmetic, date and environment suites; leaves the database integration suite unchanged. */
export default defineConfig({resolve:{alias:{'@':resolve(__dirname,'src')}},test:{environment:'node',include:['tests/money.test.ts','tests/dates.test.ts','tests/env.test.ts'],pool:'forks',env:{NODE_ENV:'test',APP_ENV:'test',PUBLIC_BASE_URL:'http://testserver'}}})
