import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Tests that need neither a database nor Docker: `npm run test:unit`. They cover the pure parts of the document-trust system (stamp layout and drawing, QR decoding,
// policy, canonical payloads, attestation signatures, placement geometry, verification view). The suites in tests/*.test.ts need Postgres and Docker (`npm test`).
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'], testTimeout: 60_000, pool: 'forks', env: { NODE_ENV: 'test', APP_ENV: 'test', PUBLIC_BASE_URL: 'http://testserver' } },
})
