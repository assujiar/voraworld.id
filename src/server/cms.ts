import { many, one, rpc } from './data'
import type { PagesRow } from './schema'
import { cleanHtml } from './sanitize'
import { slugify } from './slug'
import { ActionError, isUnique } from './errors'
import { SECTION_KINDS, SECTION_LAYOUTS, SECTION_SURFACES } from './cms-constants'

// ---------------------------------------------------------------- articles
export interface ArticleInput {
  title: string; slug: string; excerpt: string; body: string; category: string; tags: string
  locale: string; author: string; seoTitle: string; seoDescription: string; action: string
}

/** Saves (or creates) an article. Every edit first stores the previous state as a revision (inside `article_save`, in one transaction). */
export async function saveArticle(actorId: number, id: number | null, input: ArticleInput): Promise<number> {
  const title = input.title.trim().slice(0, 240)
  const slug = slugify(input.slug || title)
  if (!title || !slug) throw new ActionError('Article title and slug required')
  const locale = input.locale === 'id' ? 'id' : 'en'
  const p = {
    title, slug, excerpt: input.excerpt.slice(0, 1600), body: cleanHtml(input.body), category: input.category.slice(0, 80) || 'Updates', tags: input.tags.slice(0, 400), locale,
    author: input.author.slice(0, 120) || 'VORA Editorial', seo_title: input.seoTitle.slice(0, 200), seo_description: input.seoDescription.slice(0, 300),
  }
  try {
    return await rpc<number>('article_save', { p_actor: actorId, p_id: id, p, p_action: input.action })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Article slug already in use', 409)
    throw e
  }
}

export async function restoreArticle(actorId: number, id: number, revisionId: number): Promise<void> {
  const r = await one('revisions', (q) => q.eq('id', revisionId).eq('resource', 'article').eq('resource_id', id), 'snapshot')
  if (!r) throw new ActionError('Not found', 404)
  const snap = r.snapshot as Record<string, string>
  await rpc('article_restore', { p_actor: actorId, p_id: id, p_revision: revisionId, p_body: cleanHtml(snap.body ?? '') })
}

// ------------------------------------------------------------------- pages
/** Slugs that would shadow routes of the application itself. */
const RESERVED_SLUGS = new Set(['admin', 'preview', 'static', 'api', 'verify', 'internal', 'uploads', 'quotation-approval'])

export interface PageInput { title: string; slug: string; locale: string; description: string; seoTitle: string; action: string }

/** The frozen snapshot of a page and its sections is built inside `page_save`, in the same transaction as the publish. */
export async function savePage(actorId: number, id: number | null, input: PageInput): Promise<number> {
  const title = input.title.trim().slice(0, 200)
  const slug = slugify(input.slug || title)
  if (!title || !slug) throw new ActionError('Page title and slug required')
  if (RESERVED_SLUGS.has(slug.split('/')[0])) throw new ActionError('That slug is reserved')
  const locale = input.locale === 'id' ? 'id' : 'en'
  try {
    return await rpc<number>('page_save', {
      p_actor: actorId, p_id: id, p_action: input.action,
      p: { title, slug, locale, description: input.description.slice(0, 1200), seo_title: input.seoTitle.slice(0, 200) },
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Page slug already exists', 409)
    throw e
  }
}

export async function restorePage(actorId: number, id: number, revisionId: number): Promise<void> {
  await rpc('page_restore', { p_actor: actorId, p_id: id, p_revision: revisionId })
}

export async function addSection(actorId: number, pageId: number): Promise<void> {
  void actorId
  await rpc('section_add', { p_page: pageId })
}

export interface SectionInput {
  title: string; body: string; kind: string; layout: string; surface: string; visible: boolean
  buttonLabel: string; buttonHref: string; image: string; move: string; remove: boolean
}

/** Updates, reorders or deletes a draft section. Returns the owning page id. */
export async function saveSection(actorId: number, id: number, input: SectionInput): Promise<number> {
  const image = input.image.slice(0, 500)
  const editing = !input.remove && input.move !== 'up' && input.move !== 'down'
  if (editing && image && !(image.startsWith('/static/assets/') || image.startsWith('/uploads/') || image.startsWith('https://'))) throw new ActionError('Invalid image source')
  return rpc<number>('section_save', {
    p_actor: actorId, p_id: id, p_move: input.move, p_remove: input.remove,
    p: {
      title: input.title.slice(0, 200), body: input.body.slice(0, 6000), kind: SECTION_KINDS.includes(input.kind) ? input.kind : 'editorial',
      layout: SECTION_LAYOUTS.includes(input.layout) ? input.layout : 'split', surface: SECTION_SURFACES.includes(input.surface) ? input.surface : 'paper',
      visible: input.visible, button_label: input.buttonLabel.slice(0, 120), button_href: input.buttonHref.slice(0, 400), image,
    },
  })
}

// --------------------------------------------------------- small resources
export const cleanPath = (value: string): string => {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) throw new ActionError('Invalid relative path')
  return value
}

/** A frozen-format copy of a page and its sections, for the admin preview of a draft (publishing builds the same shape inside `page_save`). */
export async function snapshotPage(p: PagesRow) {
  const sections = await many('sections', (q) => q.eq('page_id', p.id).order('position').order('id'), 'position,kind,layout,visible,title,body,image,button_label,button_href,surface')
  return {
    title: p.title, slug: p.slug, description: p.description, seo_title: p.seoTitle, seo_description: p.seoDescription, locale: p.locale,
    sections: sections.map((s) => ({ position: s.position, kind: s.kind, layout: s.layout, visible: s.visible, title: s.title, body: s.body, image: s.image, button_label: s.buttonLabel, button_href: s.buttonHref, surface: s.surface })),
  }
}
