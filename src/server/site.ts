import { cache } from 'react'
import { many, one } from './data'
import { settingMap } from './settings'
import { navDefaults, navLabels, type Locale } from '@/content'
import { publicBaseUrl } from './env'

/** Internal paths must never appear in public navigation, including legacy CMS entries. */
export function isAdminNavigation(value: string): boolean {
  const path = String(value).trim().toLowerCase().split('?')[0].split('#')[0]
  return /^\/(?:en\/|id\/)?admin(?:\/|$)/.test(path)
}

export interface NavLink { label: string; href: string }

/** Header links: administrator-managed when present, otherwise the localized defaults. */
export const getNav = cache(async (locale: Locale): Promise<NavLink[]> => {
  const labels = navLabels[locale]
  const rows = await many('navigation_items', (q) => q.eq('location', 'header').eq('visible', true).order('position').order('id'), 'label,href')
  const links = rows.filter((r) => !isAdminNavigation(r.href as string)).map((r) => ({
    // A core link keeps its localized default unless an administrator renamed it.
    label: r.label === navLabels.en[r.href as string] ? labels[r.href as string] ?? (r.label as string) : (r.label as string),
    href: r.href as string,
  }))
  return links.length ? links : navDefaults.filter(([, href]) => !isAdminNavigation(href)).map(([, href]) => ({ label: labels[href], href }))
})

export const getSettings = cache(async () => settingMap())

export interface SnapshotSection { kind: string; layout: string; visible: boolean; title: string; body: string; image: string; button_label: string; button_href: string; surface: string }
export interface PageSnapshot { title: string; description: string; seo_title: string; seo_description: string; sections: SnapshotSection[] }

/** Published (frozen) version of a CMS page; drafts never reach visitors. */
export const getPublishedPage = cache(async (slug: string, locale: Locale): Promise<PageSnapshot | null> => {
  const row = await one('pages', (q) => q.eq('slug', slug).eq('locale', locale).eq('status', 'published'), 'published_snapshot')
  return (row?.publishedSnapshot as PageSnapshot | null) ?? null
})

export async function findRedirect(oldPath: string): Promise<{ newPath: string; status: number } | null> {
  const row = await one('seo_redirects', (q) => q.eq('old_path', oldPath), 'new_path,status')
  return row ? { newPath: row.newPath as string, status: (row.status as number) || 301 } : null
}

export const absoluteUrl = (path: string) => publicBaseUrl() + path
