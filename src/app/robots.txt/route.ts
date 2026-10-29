export const dynamic = 'force-dynamic'

import { absoluteUrl } from '@/server/site'

export function GET() {
  const body = ['User-agent: *', 'Disallow: /admin', 'Disallow: /verify', 'Disallow: /quotation-approval', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n')
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
