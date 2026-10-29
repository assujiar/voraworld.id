'use server'
import { randomBytes } from 'node:crypto'
import { ActionError, adminRun } from '@/server/action'
import { recordAudit } from '@/server/audit'
import { addSection, cleanPath, restoreArticle, restorePage, saveArticle, savePage, saveSection } from '@/server/cms'
import { sql } from '@/server/db'
import { maxUploadBytes } from '@/server/env'
import { int, rawStr, str } from '@/server/http'
import { detectImage } from '@/server/images'
import { StorageError, mediaUrl, putObject } from '@/server/storage'
import { isAdminNavigation } from '@/server/site'

export async function saveArticleAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record', 0) || null
    const articleId = await saveArticle(user.id, id, {
      title: str(form, 'title', 240), slug: str(form, 'slug', 160), excerpt: rawStr(form, 'excerpt', 1600), body: rawStr(form, 'body', 400_000),
      category: str(form, 'category', 80), tags: str(form, 'tags', 400), locale: str(form, 'locale', 8), author: str(form, 'author', 120),
      seoTitle: str(form, 'seo_title', 200), seoDescription: str(form, 'seo_description', 300), action: str(form, 'action', 20) || 'draft',
    })
    return { to: `/admin/articles/${articleId}`, notice: `Article ${str(form, 'action', 20) || 'draft'} saved` }
  })
}

export async function restoreArticleAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record'); await restoreArticle(user.id, id, int(form, 'revision'))
    return { to: `/admin/articles/${id}`, notice: 'Revision restored' }
  })
}

export async function savePageAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record', 0) || null
    const pageId = await savePage(user.id, id, {
      title: str(form, 'title', 200), slug: str(form, 'slug', 160), locale: str(form, 'locale', 8), description: rawStr(form, 'description', 1200),
      seoTitle: str(form, 'seo_title', 200), action: str(form, 'action', 20) || 'draft',
    })
    return { to: `/admin/pages/${pageId}`, notice: 'Page saved' }
  })
}

export async function restorePageAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record'); await restorePage(user.id, id, int(form, 'revision'))
    return { to: `/admin/pages/${id}`, notice: 'Published revision restored' }
  })
}

export async function addSectionAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record'); await addSection(user.id, id)
    return { to: `/admin/pages/${id}`, notice: 'Section added to draft' }
  })
}

export async function saveSectionAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const pageId = await saveSection(user.id, int(form, 'record'), {
      title: str(form, 'title', 200), body: rawStr(form, 'body', 6000), kind: str(form, 'kind', 20), layout: str(form, 'layout', 20), surface: str(form, 'surface', 20),
      visible: form.get('visible') === '1', buttonLabel: str(form, 'button_label', 120), buttonHref: str(form, 'button_href', 400), image: str(form, 'image', 500),
      move: str(form, 'move', 10), remove: form.get('delete') === '1',
    })
    return { to: `/admin/pages/${pageId}`, notice: 'Section draft updated. Publish page to go live' }
  })
}

export async function addFaqAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const q = str(form, 'question', 400), a = str(form, 'answer', 4000)
    if (!q || !a) throw new ActionError('Question and answer are required')
    const [row] = await sql`insert into faqs (question, answer, visible) values (${q}, ${a}, true) returning id`
    await recordAudit(sql, user.id, 'create', 'faq', row.id as number)
    return { to: '/admin/faq', notice: 'FAQ published' }
  })
}

export async function updateFaqAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const [x] = await sql`select id from faqs where id = ${id}`
    if (!x) throw new ActionError('FAQ not found', 404)
    if (form.get('delete') === '1') await sql`delete from faqs where id = ${id}`
    else await sql`update faqs set question = ${str(form, 'question', 400)}, answer = ${str(form, 'answer', 4000)} where id = ${id}`
    await recordAudit(sql, user.id, 'update', 'faq', id)
    return { to: '/admin/faq', notice: 'FAQ updated' }
  })
}

export async function addNavigationAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const href = cleanPath(str(form, 'href', 400))
    if (isAdminNavigation(href)) throw new ActionError('Internal admin routes cannot be added to public navigation')
    const label = str(form, 'label', 100)
    if (!label) throw new ActionError('A label is required')
    const [row] = await sql`insert into navigation_items (label, href, location, position, visible) values (${label}, ${href}, ${form.get('location') === 'footer' ? 'footer' : 'header'}, ${int(form, 'position', 50)}, true) returning id`
    await recordAudit(sql, user.id, 'create', 'navigation', row.id as number)
    return { to: '/admin/navigation', notice: 'Navigation item saved' }
  })
}

export async function deleteNavigationAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const id = int(form, 'record')
    const [x] = await sql`delete from navigation_items where id = ${id} returning id`
    if (!x) throw new ActionError('Not found', 404)
    await recordAudit(sql, user.id, 'delete', 'navigation', id)
    return { to: '/admin/navigation', notice: 'Navigation removed' }
  })
}

export async function uploadMediaAction(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const file = form.get('image')
    const alt = str(form, 'alt', 400)
    if (!(file instanceof File) || file.size === 0) throw new ActionError('Choose an image to upload')
    const limit = Math.min(7_000_000, maxUploadBytes())
    if (file.size > limit) throw new ActionError(`File exceeds ${Math.floor(limit / 1_000_000)} MB limit`, 413)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = detectImage(bytes)
    if (!type) throw new ActionError('Only well-formed PNG, JPEG, WEBP and AVIF images are supported', 415)
    if (!alt) throw new ActionError('Alt text required')
    const key = randomBytes(18).toString('hex') + type.ext
    try {
      await putObject('media', key, bytes, type.mime)
    } catch (e) {
      if (e instanceof StorageError) throw new ActionError(e.message, e.status)
      throw e
    }
    const [row] = await sql`insert into media (filename, storage_key, url, alt, mime, size) values (${file.name.split(/[\\/]/).pop()!.slice(0, 250) || 'upload'}, ${key}, ${mediaUrl(key)}, ${alt}, ${type.mime}, ${bytes.length}) returning id`
    await recordAudit(sql, user.id, 'upload', 'media', row.id as number)
    return { to: '/admin/media', notice: 'Image uploaded' }
  })
}
