import { hashPassword } from '../../src/server/auth/password'
import { startTestServer } from '../setup/server'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './credentials'

/**
 * One production-mode server and one fresh database for the whole browser run. PUBLIC_BASE_URL is https so that links in
 * emails survive the HTML sanitiser (it drops http:// links); the specs swap the host back to the test server.
 */
export default async function globalSetup() {
  const port = Number(process.env.E2E_PORT || 3310)
  const server = await startTestServer({
    port,
    prefix: 'vora_e2e',
    publicBaseUrl: `https://localhost:${port}`,
    seed: async (db) => {
      await db`insert into users (email, password_hash, role) values (${ADMIN_EMAIL}, ${await hashPassword(ADMIN_PASSWORD)}, 'admin')`
      await db`insert into leads (type, name, company, email, message, reference, public_code, status, mode, origin, destination)
               values ('RFQ', 'Dewi Lestari', 'PT Contoh Maju', 'dewi@example.invalid', 'Need FCL quote', 'RFQ-VORA-L000000AB12-202610-00001', 'L000000AB12', 'new', 'sea-export', 'Jakarta', 'Rotterdam')`
      await db`insert into articles (title, slug, excerpt, body, status, locale, category)
               values ('Peak season planning', 'peak-season-planning', 'How to plan', '<p>Plan early.</p>', 'published', 'en', 'Guides'),
                      ('Draft idea', 'draft-idea', 'x', '<p>Draft</p>', 'draft', 'en', 'Notes')`
      const [page] = await db`insert into pages (title, slug, locale, description) values ('Careers', 'careers', 'en', 'Join us') returning id`
      await db`insert into sections (page_id, position, kind, layout, visible, title, body)
               values (${page.id}, 1, 'hero', 'stack', true, 'Work with VORA', 'Open roles'), (${page.id}, 2, 'editorial', 'split', true, 'Why us', 'Because')`
      await db`insert into faqs (question, answer, position, visible) values ('How do I get a quote?', 'Use the RFQ form.', 1, true)`
    },
  })
  process.env.E2E_BASE_URL = server.base
  process.env.E2E_DATABASE_URL = server.databaseUrl
  return () => server.stop()
}
