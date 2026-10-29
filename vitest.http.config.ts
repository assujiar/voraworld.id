import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// End-to-end HTTP tests: a real `next start` server on a throw-away database. Run `npm run test:http`
// (it builds first). Files run one after another because they share that single server and database.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/http/**/*.test.ts'],
    globalSetup: ['tests/http/global.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
})
