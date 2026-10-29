import { CORE_PAGES, LOCALES, serviceGroups } from '@/content'
import { sql } from '@/server/db'
import { absoluteUrl, getSettings } from '@/server/site'

export const dynamic = 'force-dynamic'
const CORE_SLUGS = new Set(['', 'home', 'about', 'services', 'solutions', 'network', 'insights', 'faq', 'contact', 'request-quote', 'privacy', 'terms'])
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function GET() {
  const settings = await getSettings()
  const paths = new Set<string>()
  for (const loc of LOCALES) {
    for (const p of CORE_PAGES) {
      // Legal pages stay out of the sitemap until the owner has published their text.
      if ((p === '/privacy' || p === '/terms') && !(settings[p.slice(1)] ?? '').trim()) continue
      paths.add(`/${loc}${p === '/' ? '' : p}`)
    }
    for (const [slug, group] of Object.entries(serviceGroups)) {
      paths.add(`/${loc}/services/${slug}`)
      for (const mode of group.modes) paths.add(`/${loc}/services/${slug}/${mode}`)
    }
  }
  for (const a of await sql`select locale, slug from articles where status = 'published'`) paths.add(`/${a.locale}/insights/${a.slug}`)
  for (const p of await sql`select locale, slug from pages where status = 'published'`) if (!CORE_SLUGS.has(p.slug as string)) paths.add(`/${p.locale}/${p.slug}`)
  const xml = '<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    [...paths].sort().map((p) => `<url><loc>${esc(absoluteUrl(p))}</loc></url>`).join('') + '</urlset>'
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
