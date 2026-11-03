import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
/** Existing source-only editorial rules can run without the integration database. */
export default defineConfig({resolve:{alias:{'@':resolve(__dirname,'src')}},test:{environment:'node',include:['tests/copy.test.ts'],pool:'forks'}})
