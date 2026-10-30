import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { autosaveArticle, autosavePage } from '@/server/cms'
import { ActionError } from '@/server/errors'
import { errorResponse, routeId } from '@/server/http'

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replaceAll('\u0000', '').slice(0, max) : '')

/** Autosave of a draft article or page. Answers `{ updatedAt }`, which the editor sends back next time as the version it is editing. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    assertSameOrigin(request.headers)
    await requireUser(request)
    const { kind } = await params
    const b = await request.json().catch(() => ({})) as Record<string, unknown>
    const id = routeId(String(b.id ?? ''))
    const base = new Date(String(b.base ?? ''))
    if (!id || Number.isNaN(base.getTime())) throw new ActionError('Permintaan tidak lengkap', 400)
    let updatedAt: Date
    if (kind === 'article') {
      updatedAt = await autosaveArticle(id, base, {
        title: s(b.title, 240), slug: s(b.slug, 160), excerpt: s(b.excerpt, 1600), body: s(b.body, 400_000), category: s(b.category, 80), tags: s(b.tags, 400),
        locale: s(b.locale, 8), author: s(b.author, 120), seoTitle: s(b.seo_title, 200), seoDescription: s(b.seo_description, 300),
      })
    } else if (kind === 'page') {
      updatedAt = await autosavePage(id, base, { title: s(b.title, 200), slug: s(b.slug, 160), locale: s(b.locale, 8), description: s(b.description, 1200), seoTitle: s(b.seo_title, 200) })
    } else {
      return new Response('Not found', { status: 404 })
    }
    return Response.json({ updatedAt: updatedAt.toISOString() }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
