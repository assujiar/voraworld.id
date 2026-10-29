import { sql, tx, type Db } from './db'
import { recordAudit } from './audit'
import { cleanHtml } from './sanitize'
import { slugify } from './slug'
import { ActionError, isUnique } from './errors'
import { SECTION_KINDS, SECTION_LAYOUTS, SECTION_SURFACES } from './cms-constants'
import type { ArticlesRow, PagesRow, SectionsRow } from './schema'

// ---------------------------------------------------------------- articles
const ARTICLE_FIELDS = ['title', 'slug', 'excerpt', 'body', 'category', 'tags', 'locale', 'status', 'cover', 'author', 'seoTitle', 'seoDescription'] as const

export interface ArticleInput {
  title: string; slug: string; excerpt: string; body: string; category: string; tags: string
  locale: string; author: string; seoTitle: string; seoDescription: string; action: string
}

const articleSnapshot = (a: ArticlesRow) => Object.fromEntries(ARTICLE_FIELDS.map((k) => [k, a[k]]))

/** Saves (or creates) an article. Every edit first stores the previous state as a revision. */
export async function saveArticle(actorId: number, id: number | null, input: ArticleInput): Promise<number> {
  const title = input.title.trim().slice(0, 240)
  const slug = slugify(input.slug || title)
  if (!title || !slug) throw new ActionError('Article title and slug required')
  const locale = input.locale === 'id' ? 'id' : 'en'
  const body = cleanHtml(input.body)
  try {
    return await tx(async (t) => {
      let articleId = id
      if (id) {
        const [old] = await t`select * from articles where id = ${id} for update`
        if (!old) throw new ActionError('Article not found', 404)
        await t`insert into revisions (resource, resource_id, snapshot, author_id) values ('article', ${id}, ${t.json(articleSnapshot(old as ArticlesRow) as never)}, ${actorId})`
      }
      const status = input.action === 'publish' ? 'published' : input.action === 'unpublish' ? 'draft' : null
      const common = { title, slug, excerpt: input.excerpt.slice(0, 1600), body, category: input.category.slice(0, 80) || 'Updates', tags: input.tags.slice(0, 400), locale, author: input.author.slice(0, 120) || 'VORA Editorial', seoTitle: input.seoTitle.slice(0, 200), seoDescription: input.seoDescription.slice(0, 300) }
      if (!id) {
        const values: Record<string, string> = { ...common, status: status ?? 'draft' }
        const [row] = await t`insert into articles ${t(values)} returning id`
        articleId = row.id as number
        if (status === 'published') await t`update articles set published_at = now() where id = ${articleId}`
      } else {
        await t`update articles set ${t(common as Record<string, string>)}, updated_at = now() where id = ${id}`
        if (status === 'published') await t`update articles set status = 'published', published_at = now() where id = ${id}`
        else if (status === 'draft') await t`update articles set status = 'draft' where id = ${id}`
      }
      await recordAudit(t, actorId, input.action === 'publish' ? 'publish' : 'update', 'article', articleId!, title)
      return articleId!
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Article slug already in use', 409)
    throw e
  }
}

export async function restoreArticle(actorId: number, id: number, revisionId: number): Promise<void> {
  await tx(async (t) => {
    const [a] = await t`select * from articles where id = ${id} for update`
    const [r] = await t`select * from revisions where id = ${revisionId} and resource = 'article' and resource_id = ${id}`
    if (!a || !r) throw new ActionError('Not found', 404)
    await t`insert into revisions (resource, resource_id, snapshot, author_id) values ('article', ${id}, ${t.json(articleSnapshot(a as ArticlesRow) as never)}, ${actorId})`
    const snap = r.snapshot as Record<string, string>
    await t`update articles set title = ${snap.title}, slug = ${snap.slug}, excerpt = ${snap.excerpt}, body = ${cleanHtml(snap.body)}, category = ${snap.category},
            tags = ${snap.tags}, locale = ${snap.locale}, status = ${snap.status}, cover = ${snap.cover ?? ''}, author = ${snap.author},
            seo_title = ${snap.seoTitle ?? ''}, seo_description = ${snap.seoDescription ?? ''}, updated_at = now() where id = ${id}`
    await recordAudit(t, actorId, 'restore', 'article', id, String(revisionId))
  })
}

// ------------------------------------------------------------------- pages
/** Slugs that would shadow routes of the application itself. */
const RESERVED_SLUGS = new Set(['admin', 'preview', 'static', 'api', 'verify', 'internal', 'uploads', 'quotation-approval'])

/** Frozen copy of a page and its sections: visitors only ever see published snapshots. Keys stay snake_case (stable format). */
export async function snapshotPage(db: Db, p: PagesRow) {
  const sections = await db`select position, kind, layout, visible, title, body, image, button_label, button_href, surface from sections where page_id = ${p.id} order by position, id`
  return {
    title: p.title, slug: p.slug, description: p.description, seo_title: p.seoTitle, seo_description: p.seoDescription, locale: p.locale,
    sections: sections.map((s) => ({ position: s.position, kind: s.kind, layout: s.layout, visible: s.visible, title: s.title, body: s.body, image: s.image, button_label: s.buttonLabel, button_href: s.buttonHref, surface: s.surface })),
  }
}

export interface PageInput { title: string; slug: string; locale: string; description: string; seoTitle: string; action: string }

export async function savePage(actorId: number, id: number | null, input: PageInput): Promise<number> {
  const title = input.title.trim().slice(0, 200)
  const slug = slugify(input.slug || title)
  if (!title || !slug) throw new ActionError('Page title and slug required')
  if (RESERVED_SLUGS.has(slug.split('/')[0]) ) throw new ActionError('That slug is reserved')
  const locale = input.locale === 'id' ? 'id' : 'en'
  const description = input.description.slice(0, 1200)
  try {
    return await tx(async (t) => {
      let pageId = id
      if (id) {
        const [exists] = await t`select id from pages where id = ${id} for update`
        if (!exists) throw new ActionError('Page not found', 404)
        await t`update pages set title = ${title}, slug = ${slug}, locale = ${locale}, description = ${description}, seo_title = ${input.seoTitle.slice(0, 200)}, seo_description = ${description}, updated_at = now() where id = ${id}`
      } else {
        const [row] = await t`insert into pages (title, slug, locale, description, seo_title, seo_description) values (${title}, ${slug}, ${locale}, ${description}, ${input.seoTitle.slice(0, 200)}, ${description}) returning id`
        pageId = row.id as number
      }
      const [page] = await t`select * from pages where id = ${pageId!}`
      if (input.action === 'publish') {
        await t`insert into revisions (resource, resource_id, snapshot, author_id) values ('page', ${pageId!}, ${t.json((page.publishedSnapshot ?? {}) as never)}, ${actorId})`
        await t`update pages set published_snapshot = ${t.json((await snapshotPage(t, page as PagesRow)) as never)}, status = 'published' where id = ${pageId!}`
      } else if (input.action === 'unpublish') {
        await t`update pages set status = 'draft' where id = ${pageId!}`
      }
      await recordAudit(t, actorId, input.action || 'draft', 'page', pageId!, slug)
      return pageId!
    })
  } catch (e) {
    if (isUnique(e)) throw new ActionError('Page slug already exists', 409)
    throw e
  }
}

export async function restorePage(actorId: number, id: number, revisionId: number): Promise<void> {
  await tx(async (t) => {
    const [r] = await t`select * from revisions where id = ${revisionId} and resource = 'page' and resource_id = ${id}`
    if (!r) throw new ActionError('Not found', 404)
    const snap = r.snapshot as { sections?: unknown } | null
    if (!snap || !snap.sections) throw new ActionError('Previous revision is empty', 409)
    await t`update pages set published_snapshot = ${t.json(snap as never)}, status = 'published' where id = ${id}`
    await recordAudit(t, actorId, 'restore', 'page', id, String(revisionId))
  })
}

export async function addSection(actorId: number, pageId: number): Promise<void> {
  const [page] = await sql`select id from pages where id = ${pageId}`
  if (!page) throw new ActionError('Page not found', 404)
  const [{ max }] = await sql`select coalesce(max(position), 0)::int as max from sections where page_id = ${pageId}`
  await sql`insert into sections (page_id, position, kind, layout, visible, title, body) values (${pageId}, ${max + 1}, 'editorial', 'split', true, 'New editorial block', 'Edit this text before publishing')`
  void actorId
}

export interface SectionInput {
  title: string; body: string; kind: string; layout: string; surface: string; visible: boolean
  buttonLabel: string; buttonHref: string; image: string; move: string; remove: boolean
}

/** Updates, reorders or deletes a draft section. Returns the owning page id. */
export async function saveSection(actorId: number, id: number, input: SectionInput): Promise<number> {
  return tx(async (t) => {
    const [s] = await t`select * from sections where id = ${id} for update`
    if (!s) throw new ActionError('Section not found', 404)
    const pid = s.pageId as number
    if (input.remove) {
      await t`delete from sections where id = ${id}`
    } else if (input.move === 'up' || input.move === 'down') {
      const others = await t`select id from sections where page_id = ${pid} order by position, id`
      const ids = others.map((o) => o.id as number)
      const i = ids.indexOf(id)
      const j = i + (input.move === 'up' ? -1 : 1)
      if (j >= 0 && j < ids.length) {
        ;[ids[i], ids[j]] = [ids[j], ids[i]]
        for (let n = 0; n < ids.length; n++) await t`update sections set position = ${n} where id = ${ids[n]}`
      }
    } else {
      const image = input.image.slice(0, 500)
      if (image && !(image.startsWith('/static/assets/') || image.startsWith('/uploads/') || image.startsWith('https://'))) throw new ActionError('Invalid image source')
      await t`update sections set title = ${input.title.slice(0, 200)}, body = ${input.body.slice(0, 6000)},
              kind = ${SECTION_KINDS.includes(input.kind) ? input.kind : 'editorial'}, layout = ${SECTION_LAYOUTS.includes(input.layout) ? input.layout : 'split'},
              surface = ${SECTION_SURFACES.includes(input.surface) ? input.surface : 'paper'}, visible = ${input.visible},
              button_label = ${input.buttonLabel.slice(0, 120)}, button_href = ${input.buttonHref.slice(0, 400)}, image = ${image} where id = ${id}`
    }
    await recordAudit(t, actorId, 'update', 'section', id, 'section draft')
    return pid
  })
}

// --------------------------------------------------------- small resources
export const cleanPath = (value: string): string => {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) throw new ActionError('Invalid relative path')
  return value
}
